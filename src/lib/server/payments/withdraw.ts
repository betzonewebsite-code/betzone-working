import { randomUUID } from "crypto";
import { db } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { notifyBalance, post } from "../ledger";
import { D, type Dec } from "../money";
import { verifyPassword } from "../password";
import { rateLimit } from "../ratelimit";
import { queues, retryOpts } from "../queues";
import { NETWORK_CODES } from "./paystack";

const local = (e164: string) => `0${e164.replace(/^\+233/, "")}`;   // +233241234567 -> 0241234567
const maskedPhone = (e164: string) => `${e164.slice(0, 6)}****${e164.slice(-3)}`;

export async function setPin(userId: string, password: string, pin: string) {
  const { default: bcrypt } = await import("bcryptjs");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || !(await verifyPassword(password, u.passwordHash))) throw new HttpError(403, "Wrong password.", "BAD_PASSWORD");
  if (/^(\d)\1{3}$/.test(pin) || pin === "1234" || pin === "0000") throw new HttpError(400, "Pick a PIN that is harder to guess.");
  await db.user.update({ where: { id: userId }, data: { withdrawalPinHash: await bcrypt.hash(pin, 12) } });
}

/**
 * Debits the wallet first (so the money cannot be spent twice), then queues the payout.
 * Payouts go only to the player's own verified phone number, a basic anti-fraud and anti-laundering rule.
 */
export async function startWithdrawal(userId: string, amount: Dec, network: string, pin: string) {
  const code = NETWORK_CODES[network];
  if (!code) throw new HttpError(400, "Choose MTN, Telecel or AirtelTigo.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") throw new HttpError(403, "Your account cannot withdraw.");
  if (!user.phoneVerifiedAt) throw new HttpError(403, "Verify your phone number before withdrawing.", "PHONE_NOT_VERIFIED");
  if (!user.withdrawalPinHash) throw new HttpError(403, "Create a withdrawal PIN first.", "PIN_NOT_SET");
  if (amount.lt(env.WITHDRAWAL_MIN)) throw new HttpError(400, `The minimum withdrawal is ${env.WITHDRAWAL_MIN} ${env.DEFAULT_CURRENCY}.`, "WITHDRAW_MIN");
  if (amount.gt(env.WITHDRAWAL_KYC_ABOVE) && user.kycStatus !== "VERIFIED") throw new HttpError(403, "Identity verification is required for this amount.", "KYC_REQUIRED");

  await rateLimit(`pin-${userId}`, 5, 900);                              // 5 PIN tries per 15 minutes, right or wrong
  const { default: bcrypt } = await import("bcryptjs");
  if (!(await bcrypt.compare(pin, user.withdrawalPinHash))) throw new HttpError(403, "Wrong PIN.", "BAD_PIN");

  const since = new Date(Date.now() - 86_400_000);
  const today = await db.transaction.aggregate({ where: { userId, type: "WITHDRAWAL", status: { in: ["PROCESSING", "SUCCESSFUL"] }, createdAt: { gte: since } }, _sum: { amount: true } });
  if (D(today._sum.amount ?? 0).abs().plus(amount).gt(env.WITHDRAWAL_DAILY_MAX)) throw new HttpError(403, "This would pass your daily withdrawal limit.", "WITHDRAW_LIMIT");

  const reference = `bz-wd-${randomUUID()}`;
  const auto = amount.lte(env.WITHDRAWAL_AUTO_APPROVE_MAX);
  const { row } = await db.$transaction((tx) => post(tx, {
    userId, type: "WITHDRAWAL", amount: amount.neg(), status: "PROCESSING", provider: "PAYSTACK", providerRef: reference,
    idempotencyKey: `withdraw-${reference}`, counterparty: maskedPhone(user.phone), metadata: { network, needsApproval: !auto },
  }));
  await notifyBalance(userId);
  if (auto) await queues().payouts.add("payout", { txId: row.id }, { ...retryOpts, jobId: `payout-${row.id}` });
  return { id: row.id, needsApproval: !auto };
}

export async function sendPayout(txId: string) {
  const { createRecipient, initiateTransfer } = await import("./paystack");
  const tx = await db.transaction.findUnique({ where: { id: txId } });
  if (!tx || tx.type !== "WITHDRAWAL" || tx.status !== "PROCESSING") return;
  const meta = (tx.metadata ?? {}) as { network?: string; transferCode?: string };
  if (meta.transferCode) return;                                         // already sent, waiting for the webhook
  const user = await db.user.findUnique({ where: { id: tx.userId } });
  if (!user || !meta.network) throw new Error("Withdrawal data missing");
  const recipient = await createRecipient({ name: user.firstName ?? "BetZone player", phone: local(user.phone), bankCode: NETWORK_CODES[meta.network] });
  const t = await initiateTransfer({ amountPesewas: Math.round(tx.amount.abs().mul(100).toNumber()), recipient: recipient.recipient_code, reference: tx.providerRef! });
  await db.transaction.update({ where: { id: tx.id }, data: { metadata: { ...meta, transferCode: t.transfer_code, transferStatus: t.status } } });
}

export async function completeWithdrawal(reference: string) {
  await db.transaction.updateMany({ where: { providerRef: reference, type: "WITHDRAWAL", status: "PROCESSING" }, data: { status: "SUCCESSFUL", completedAt: new Date() } });
}

/** Marks a withdrawal failed and gives the money back, exactly once. */
export async function failWithdrawal(reference: string, reason: string) {
  const row = await db.transaction.findUnique({ where: { providerRef: reference } });
  if (!row || row.type !== "WITHDRAWAL" || row.status === "FAILED" || row.status === "REVERSED") return;
  await db.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({ where: { id: row.id, status: { in: ["PROCESSING", "SUCCESSFUL"] } }, data: { status: row.status === "SUCCESSFUL" ? "REVERSED" : "FAILED", failureReason: reason } });
    if (claimed.count !== 1) return;
    await post(tx, { userId: row.userId, type: "ADJUSTMENT", amount: row.amount.abs(), idempotencyKey: `refund-${row.id}`, metadata: { refundOf: row.id, reason } });
  });
  await notifyBalance(row.userId);
}
