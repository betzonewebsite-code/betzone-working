import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { handler, json, HttpError } from "@/lib/server/http";

const querySchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "BET_STAKE", "BET_PAYOUT", "BET_REFUND", "CASHOUT", "BONUS", "ADJUSTMENT"]).optional(),
  status: z.enum(["PENDING", "PROCESSING", "SUCCESSFUL", "FAILED", "REVERSED"]).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = handler(async (req) => {
  await requireAdmin(req);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  }

  const { type, status, q, limit } = parsed.data;

  const where: Prisma.TransactionWhereInput = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { providerRef: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q, mode: "insensitive" } } },
        { user: { firstName: { contains: q, mode: "insensitive" } } },
        { user: { lastName: { contains: q, mode: "insensitive" } } },
      ],
    } : {}),
  };

  const [transactions, count, walletSummary] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        amount: true,
        balanceAfter: true,
        currency: true,
        provider: true,
        providerRef: true,
        counterparty: true,
        failureReason: true,
        createdAt: true,
        completedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    db.transaction.count({ where }),
    db.wallet.aggregate({
      _count: { id: true },
      _sum: { balance: true },
    }),
  ]);

  return json({
    transactions: transactions.map((tx) => ({
      ...tx,
      amount: Number(tx.amount),
      balanceAfter: tx.balanceAfter === null ? null : Number(tx.balanceAfter),
    })),
    count,
    limit,
    walletSummary: {
      walletCount: walletSummary._count.id,
      totalBalance: Number(walletSummary._sum.balance ?? 0),
    },
  });
});
