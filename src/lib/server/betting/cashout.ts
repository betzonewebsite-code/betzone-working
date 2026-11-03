import { Prisma } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { notifyBalance, post } from "../ledger";
import { publishUser } from "../events";
import { D, down2, fixed, type Dec } from "../money";

export const cashoutInclude = { legs: { include: { odds: true, market: true, fixture: true } } } satisfies Prisma.BetTicketInclude;
export type TicketFull = Prisma.BetTicketGetPayload<{ include: typeof cashoutInclude }>;
export type Offer = { available: true; amount: string; maxPayout: string } | { available: false; reason: string };

/**
 * offer = remaining stake x product(odds taken on won legs) x product(odds taken / current odds on open legs) x (1 - margin)
 * Current odds move with the score and the clock, so the offer follows the match.
 */
export function computeOffer(t: TicketFull): { offer: Offer; amount: Dec } {
  const no = (reason: string) => ({ offer: { available: false, reason } as Offer, amount: D(0) });
  if (t.status !== "OPEN") return no("This bet is settled.");
  if (t.type === "FLEXI" || t.type === "SYSTEM") return no("Cash out is not available on Flexi or System bets.");
  if (t.legs.some((l) => l.fixture.source === "virtual")) return no("Cash out is not available on virtual games.");   // the result is decided before it is shown, so an offer would be unfair

  let factor = D(1), maxFactor = D(1);
  for (const l of t.legs) {
    if (l.result === "LOST") return no("This bet has a losing leg.");
    if (l.result === "HALF_WON" || l.result === "HALF_LOST") return no("Cash out is not available on this bet.");
    if (l.result === "VOID") continue;
    maxFactor = maxFactor.mul(l.oddsTaken);
    if (l.result === "WON") { factor = factor.mul(l.oddsTaken); continue; }
    const f = l.fixture;
    if (!f.bettingOpen || l.market.status !== "OPEN" || l.odds.status !== "OPEN" || f.status === "FINISHED") return no("Cash out is paused while markets are locked.");
    factor = factor.mul(l.oddsTaken.div(l.odds.odds));
  }
  const maxPayout = down2(t.remainingStake.mul(maxFactor));
  let amount = down2(t.remainingStake.mul(factor).mul(1 - env.CASHOUT_MARGIN_PCT / 100));
  if (amount.gt(maxPayout.mul(0.99))) amount = down2(maxPayout.mul(0.99));
  if (amount.lt(0.05)) return no("No cash out offer right now.");
  return { offer: { available: true, amount: fixed(amount), maxPayout: fixed(maxPayout) }, amount };
}

export async function executeCashout(userId: string, ticketId: string, fraction: number, expected: number, key: string) {
  const out = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "BetTicket" WHERE "id" = ${ticketId} FOR UPDATE`;
    const t = await tx.betTicket.findFirst({ where: { id: ticketId, userId }, include: cashoutInclude });
    if (!t) throw new HttpError(404, "Bet not found.");
    const { offer, amount } = computeOffer(t);
    if (!offer.available) throw new HttpError(409, offer.reason, "CASHOUT_UNAVAILABLE");
    if (amount.lt(D(expected).mul(0.98))) throw new HttpError(409, "The cash out offer changed.", "OFFER_CHANGED", { amount: offer.amount });

    let f = Math.min(1, Math.max(0.05, fraction));
    if (t.remainingStake.mul(1 - f).lt(0.5)) f = 1;                    // leftover would be tiny: close the bet
    const pay = down2(amount.mul(f));
    const { replayed } = await post(tx, { userId, type: "CASHOUT", amount: pay, idempotencyKey: `cashout-${ticketId}-${key}`, ticketId });
    if (replayed) return { amount: pay, closed: f >= 1 };
    const full = f >= 1;
    await tx.betTicket.update({
      where: { id: ticketId },
      data: full
        ? { status: "CASHED_OUT", cashedOutAmount: t.cashedOutAmount.plus(pay), payout: t.cashedOutAmount.plus(pay), remainingStake: 0, autoCashoutTarget: null, settledAt: new Date() }
        : { cashedOutAmount: t.cashedOutAmount.plus(pay), remainingStake: down2(t.remainingStake.mul(1 - f)), autoCashoutTarget: null },
    });
    return { amount: pay, closed: full };
  }, { timeout: 15_000 });
  await notifyBalance(userId);
  await publishUser(userId, "bet", { ticketId });
  return { amount: fixed(out.amount), closed: out.closed };
}

/** Fires auto cash-out targets. Run every few seconds by the platform server. */
export async function runAutoCashouts() {
  const open = await db.betTicket.findMany({ where: { status: "OPEN", autoCashoutTarget: { not: null } }, include: cashoutInclude, take: 500 });
  for (const t of open) {
    const { offer, amount } = computeOffer(t);
    if (offer.available && t.autoCashoutTarget && amount.gte(t.autoCashoutTarget)) {
      await executeCashout(t.userId, t.id, 1, Number(amount), `auto-${Date.now()}`).catch((e) => console.warn("[auto-cashout]", t.publicId, (e as Error).message));
    }
  }
}
