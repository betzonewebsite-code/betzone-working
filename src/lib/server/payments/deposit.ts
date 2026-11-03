import { randomUUID } from "crypto";
import { db } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { lockWallet, notifyBalance, post } from "../ledger";
import { D, toPesewas, type Dec } from "../money";
import { initializeTransaction, verifyTransaction } from "./paystack";

async function checkDepositLimits(userId: string, amount: Dec) {
  const lim = await db.responsibleLimits.findUnique({ where: { userId } });
  if (!lim) return;
  const sum = async (days: number) => {
    const since = new Date(Date.now() - days * 86_400_000);
    return (await db.transaction.aggregate({ where: { userId, type: "DEPOSIT", status: "SUCCESSFUL", createdAt: { gte: since } }, _sum: { amount: true } }))._sum.amount ?? D(0);
  };
  for (const [limit, days, label] of [[lim.dailyDeposit, 1, "daily"], [lim.weeklyDeposit, 7, "weekly"], [lim.monthlyDeposit, 30, "monthly"]] as const)
    if (limit && (await sum(days)).plus(amount).gt(limit)) throw new HttpError(403, `This would pass your ${label} deposit limit.`, "DEPOSIT_LIMIT");
}

export async function startDeposit(userId: string, amount: Dec) {
  if (amount.lt(env.DEPOSIT_MIN) || amount.gt(env.DEPOSIT_MAX)) throw new HttpError(400, `Deposits must be between ${env.DEPOSIT_MIN} and ${env.DEPOSIT_MAX} ${env.DEFAULT_CURRENCY}.`, "DEPOSIT_RANGE");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") throw new HttpError(403, "Your account cannot deposit.");
  await checkDepositLimits(userId, amount);

  const reference = `bz-dep-${randomUUID()}`;
  await db.$transaction((tx) => post(tx, { userId, type: "DEPOSIT", amount, status: "PENDING", provider: "PAYSTACK", providerRef: reference, idempotencyKey: `deposit-${reference}` }));
  try {
    const init = await initializeTransaction({ email: user.email, amountPesewas: toPesewas(amount), reference, metadata: { userId } });
    return { authorizationUrl: init.authorization_url, reference };
  } catch (e) {
    await db.transaction.updateMany({ where: { providerRef: reference, status: "PENDING" }, data: { status: "FAILED", failureReason: "Could not start payment" } });
    throw e;
  }
}

/**
 * Credits a deposit once, and only after asking Paystack directly whether it was paid.
 * Called by both the webhook and the page the player returns to, so whichever arrives first wins and the other is a no-op.
 */
export async function finalizeDeposit(reference: string) {
  const row = await db.transaction.findUnique({ where: { providerRef: reference } });
  if (!row || row.type !== "DEPOSIT") throw new HttpError(404, "Deposit not found.", "NOT_FOUND");
  if (row.status === "SUCCESSFUL") return { status: "SUCCESSFUL" as const, amount: row.amount.toFixed(2) };
  if (row.status !== "PENDING") return { status: row.status, amount: row.amount.toFixed(2) };

  const v = await verifyTransaction(reference);
  if (v.status === "failed" || v.status === "abandoned") {
    await db.transaction.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "FAILED", failureReason: v.status } });
    return { status: "FAILED" as const, amount: row.amount.toFixed(2) };
  }
  if (v.status !== "success") return { status: "PENDING" as const, amount: row.amount.toFixed(2) };
  if (v.amount !== toPesewas(row.amount) || v.currency !== row.currency) {
    console.error(`[deposit] amount mismatch on ${reference}: paid ${v.amount} ${v.currency}, expected ${toPesewas(row.amount)} ${row.currency}`);
    await db.transaction.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "FAILED", failureReason: "Amount mismatch, needs review" } });
    throw new HttpError(409, "Payment amount did not match. Support has been alerted.", "AMOUNT_MISMATCH");
  }

  await db.$transaction(async (tx) => {
    const w = await lockWallet(tx, row.userId);
    const claimed = await tx.transaction.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "SUCCESSFUL", completedAt: new Date(), balanceAfter: w.balance.plus(row.amount) } });
    if (claimed.count !== 1) return;                                       // the other path already credited it
    await tx.wallet.update({ where: { userId: row.userId }, data: { balance: w.balance.plus(row.amount), version: { increment: 1 } } });
  });
  await notifyBalance(row.userId);
  return { status: "SUCCESSFUL" as const, amount: row.amount.toFixed(2) };
}
