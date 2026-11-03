import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { handler, json } from "@/lib/server/http";
import { fixed } from "@/lib/server/money";
import { requireUser } from "@/lib/server/session";

const GROUPS = { deposit: ["DEPOSIT"], withdrawal: ["WITHDRAWAL"], bets: ["BET_STAKE", "BET_PAYOUT", "BET_REFUND"], cashout: ["CASHOUT"] } as const;

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const sp = new URL(req.url).searchParams;
  const group = z.enum(["all", "deposit", "withdrawal", "bets", "cashout"]).catch("all").parse(sp.get("type"));
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(sp.get("limit"));
  const where: Prisma.TransactionWhereInput = { userId: user.id, ...(group === "all" ? {} : { type: { in: [...GROUPS[group]] } }) };
  const rows = await db.transaction.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });
  return json({ transactions: rows.map((t) => ({ id: t.id, type: t.type, status: t.status, amount: fixed(t.amount), balanceAfter: fixed(t.balanceAfter), currency: t.currency, method: t.provider, counterparty: t.counterparty, failureReason: t.failureReason, createdAt: t.createdAt.toISOString() })) });
});
