import { Prisma, type PaymentProvider, type TxStatus, type TxType } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
import { publishUser } from "./events";
import { D, fixed, type Dec } from "./money";

type Tx = Prisma.TransactionClient;
export type PostArgs = {
  userId: string; type: TxType; amount: Dec;            // amount is signed: + credit, - debit
  status?: TxStatus; idempotencyKey: string;
  provider?: PaymentProvider; providerRef?: string; ticketId?: string; counterparty?: string;
  metadata?: Prisma.InputJsonValue; failureReason?: string;
};

/** Locks the wallet row until the surrounding DB transaction ends, so two requests can never spend the same money. */
export async function lockWallet(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal; currency: string }[]>`SELECT "id","balance","currency" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
  if (!rows[0]) throw new HttpError(404, "Wallet not found.", "NO_WALLET");
  return rows[0];
}

/**
 * Writes one ledger row and moves the balance, inside the caller's transaction.
 * SUCCESSFUL and PROCESSING rows move money. PENDING and FAILED rows do not.
 * Retrying with the same idempotencyKey returns the first row and changes nothing.
 */
export async function post(tx: Tx, a: PostArgs) {
  const existing = await tx.transaction.findUnique({ where: { idempotencyKey: a.idempotencyKey } });
  if (existing) return { row: existing, replayed: true };

  const w = await lockWallet(tx, a.userId);
  const status = a.status ?? "SUCCESSFUL";
  const moves = status === "SUCCESSFUL" || status === "PROCESSING";
  const next = moves ? w.balance.plus(a.amount) : w.balance;
  if (next.lt(0)) throw new HttpError(402, "Insufficient balance.", "INSUFFICIENT_FUNDS");
  if (moves) await tx.wallet.update({ where: { userId: a.userId }, data: { balance: next, version: { increment: 1 } } });

  const row = await tx.transaction.create({
    data: {
      userId: a.userId, walletId: w.id, type: a.type, status, amount: a.amount, balanceAfter: next, currency: w.currency,
      provider: a.provider, providerRef: a.providerRef, idempotencyKey: a.idempotencyKey, ticketId: a.ticketId,
      counterparty: a.counterparty, metadata: a.metadata, failureReason: a.failureReason,
      completedAt: status === "SUCCESSFUL" ? new Date() : null,
    },
  });
  return { row, replayed: false };
}

export async function balanceOf(userId: string): Promise<Dec> {
  return (await db.wallet.findUnique({ where: { userId } }))?.balance ?? D(0);
}

/** Call after the DB transaction has committed. */
export async function notifyBalance(userId: string) {
  await publishUser(userId, "balance", { balance: fixed(await balanceOf(userId)) });
}
