import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { validProviderSignature, verifyPlayerToken } from "@/lib/server/games";
import { HttpError } from "@/lib/server/http";
import { balanceOf, notifyBalance, post } from "@/lib/server/ledger";
import { D, fixed } from "@/lib/server/money";

/**
 * Generic "seamless wallet" endpoint for a licensed game provider (virtual sports, crash games, slots).
 * Money stays in BetZone's ledger; the provider asks us to check the balance, debit a bet, credit a win, or undo a bet.
 * Every call is idempotent on txId. A real provider will have its own message format: adapt the parsing below to its spec.
 */
const schema = z.object({
  action: z.enum(["balance", "bet", "win", "rollback"]),
  token: z.string().min(10),
  txId: z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/).optional(),
  roundId: z.string().max(80).optional(),
  amount: z.number().positive().max(1_000_000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (!validProviderSignature(raw, req.headers.get("x-signature"))) return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
    const m = schema.parse(JSON.parse(raw));
    const userId = await verifyPlayerToken(m.token);
    const user = await db.user.findUnique({ where: { id: userId }, include: { limits: true } });
    if (!user || user.status !== "ACTIVE") throw new HttpError(403, "Player blocked.", "BLOCKED");

    if (m.action === "balance") return NextResponse.json({ balance: fixed(await balanceOf(userId)) });
    if (!m.txId) throw new HttpError(400, "txId required");
    const meta = { game: true, roundId: m.roundId ?? null };

    if (m.action === "bet") {
      if (!m.amount) throw new HttpError(400, "amount required");
      const now = new Date();
      if (user.limits?.selfExcludedUntil && user.limits.selfExcludedUntil > now) throw new HttpError(403, "Self-excluded.", "SELF_EXCLUDED");
      await db.$transaction((tx) => post(tx, { userId, type: "BET_STAKE", amount: D(m.amount!).neg(), idempotencyKey: `game-bet-${m.txId}`, metadata: meta }));
    } else if (m.action === "win") {
      if (!m.amount) throw new HttpError(400, "amount required");
      await db.$transaction((tx) => post(tx, { userId, type: "BET_PAYOUT", amount: D(m.amount!), idempotencyKey: `game-win-${m.txId}`, metadata: meta }));
    } else {
      const bet = await db.transaction.findUnique({ where: { idempotencyKey: `game-bet-${m.txId}` } });
      if (bet && bet.userId === userId) await db.$transaction((tx) => post(tx, { userId, type: "BET_REFUND", amount: bet.amount.abs(), idempotencyKey: `game-rollback-${m.txId}`, metadata: meta }));
    }
    await notifyBalance(userId);
    return NextResponse.json({ balance: fixed(await balanceOf(userId)), txId: m.txId });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.code ?? "ERROR", message: e.message }, { status: e.status });
    if (e instanceof z.ZodError || e instanceof SyntaxError) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    console.error("[games wallet]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
