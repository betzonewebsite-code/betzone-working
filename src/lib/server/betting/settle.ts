import { Prisma, type SelectionResult } from "@prisma/client";
import { db } from "../db";
import { balanceOf, notifyBalance, post } from "../ledger";
import { publishUser } from "../events";
import { D, down2, type Dec } from "../money";
import { combinations, product } from "./odds";
import { resultFor } from "./settlement-calculations";

const factor = (r: SelectionResult, odds: Dec): Dec =>
  r === "WON" ? odds : r === "VOID" ? D(1) : r === "HALF_WON" ? D(1).plus(odds.minus(1).div(2)) : r === "HALF_LOST" ? D(0.5) : D(0);

/** Settles every open leg on one finished (or cancelled) match, then re-evaluates each ticket those legs belong to. */
export async function settleFixture(fixtureId: string) {
  const f = await db.fixture.findUnique({ where: { id: fixtureId } });
  if (!f) return 0;
  const voidAll = f.status === "CANCELLED" || f.status === "ABANDONED" || f.status === "POSTPONED";
  if (!voidAll && f.status !== "FINISHED") return 0;
  if (!voidAll && (f.result as { agreed?: boolean | null } | null)?.agreed === false) { console.error(`[settle] ${f.homeTeam} v ${f.awayTeam}: providers disagree, waiting for a human`); return 0; }

  const legs = await db.betLeg.findMany({ where: { fixtureId, result: "PENDING" }, include: { market: true, odds: true } });
  const virtualResult = f.result as {
    halfTime?: [number, number];
  } | null;

  for (const l of legs) {
    const res = voidAll ? "VOID" : resultFor(
      l.market.type,
      l.odds.key,
      l.market.line !== null ? Number(l.market.line) : null,
      f.homeScore,
      f.awayScore,
      l.market.name,
      virtualResult?.halfTime?.[0],
      virtualResult?.halfTime?.[1]
    );
    await db.betLeg.updateMany({ where: { id: l.id, result: "PENDING" }, data: { result: res, settledAt: new Date() } });
  }
  await db.market.updateMany({ where: { fixtureId, status: { not: "SETTLED" } }, data: { status: "SETTLED", settledAt: new Date() } });

  const ticketIds = [...new Set(legs.map((l) => l.ticketId))];
  for (const id of ticketIds) await evaluateTicketTx(id);
  return ticketIds.length;
}

export async function evaluateTicketTx(ticketId: string) {
  const userId = await db.$transaction((tx) => evaluateTicket(tx, ticketId), { timeout: 15_000 });
  if (userId) { await notifyBalance(userId); await publishUser(userId, "bet", { ticketId }); }
}

async function evaluateTicket(tx: Prisma.TransactionClient, ticketId: string): Promise<string | null> {
  await tx.$queryRaw`SELECT "id" FROM "BetTicket" WHERE "id" = ${ticketId} FOR UPDATE`;
  const t = await tx.betTicket.findUnique({ where: { id: ticketId }, include: { legs: true } });
  if (!t || t.status !== "OPEN") return null;

  const lost = t.legs.filter((l) => l.result === "LOST").length;
  const pending = t.legs.filter((l) => l.result === "PENDING").length;
  const combinationBet = t.type === "FLEXI" || t.type === "SYSTEM";
  const finish = async (status: "WON" | "LOST" | "VOID", win: Dec) => {
    const done = await tx.betTicket.updateMany({
      where: { id: t.id, status: "OPEN" },
      data: { status, payout: t.cashedOutAmount.plus(win), remainingStake: 0, autoCashoutTarget: null, settledAt: new Date() },
    });
    if (done.count !== 1) return null;                                    // someone else settled it first
    if (status === "WON") await post(tx, { userId: t.userId, type: "BET_PAYOUT", amount: win, idempotencyKey: `payout-${t.id}`, ticketId: t.id });
    if (status === "VOID") await post(tx, { userId: t.userId, type: "BET_REFUND", amount: win, idempotencyKey: `refund-${t.id}`, ticketId: t.id });
    return t.userId;
  };

  if (combinationBet ? lost > t.flexiCut : lost > 0) return finish("LOST", D(0));       // a lost leg ends a normal multiple at once
  if (pending > 0) return null;

  let win: Dec;
  if (combinationBet && t.legs.every((l) => l.result === "VOID"))
    return finish("VOID", t.remainingStake);
  if (combinationBet) {
    const cs = combinations(t.legs, t.legs.length - t.flexiCut);
    const unit = t.stake.div(cs.length);
    win = cs.reduce((s, c) => s.plus(unit.mul(product(c.map((l) => factor(l.result, l.oddsTaken))))), D(0));
  } else {
    win = t.remainingStake.mul(product(t.legs.map((l) => factor(l.result, l.oddsTaken))));
    if (t.legs.every((l) => l.result === "WON") && t.bonusPct.gt(0)) win = win.plus(win.minus(t.remainingStake).mul(t.bonusPct).div(100));   // Super Bonus only when every leg won outright
    if (t.legs.every((l) => l.result === "VOID")) return finish("VOID", t.remainingStake);
  }
  win = down2(win);
  return win.gt(0) ? finish("WON", win) : finish("LOST", D(0));
}

