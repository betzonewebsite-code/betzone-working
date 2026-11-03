import { randomInt } from "crypto";
import { Prisma, type TicketType } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { balanceOf, notifyBalance, post } from "../ledger";
import { publishUser } from "../events";
import { D, down2, fixed, type Dec } from "../money";
import { bonusPctFor, flexiMax, product } from "./odds";

export type PlaceInput = {
  tab: "single" | "multiple" | "system";
  selections: { oddsId: string; odds: number }[];
  stake?: number;
  stakes?: Record<string, number>;
  flexiCut: 0 | 1 | 2;
  systemSize?: number;
  acceptOddsChange: boolean;
  idempotencyKey: string;
};

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const publicId = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rowInclude = { market: { include: { fixture: true } } } satisfies Prisma.MarketOddsInclude;
type Row = Prisma.MarketOddsGetPayload<{ include: typeof rowInclude }>;
const isLive = (r: Row) => r.market.fixture.status === "LIVE" || r.market.fixture.status === "HALFTIME";

export async function placeBets(userId: string, input: PlaceInput) {
  const ids = input.selections.map((s) => s.oddsId);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "The same selection is in your slip twice.");

  const user = await db.user.findUnique({ where: { id: userId }, include: { limits: true } });
  if (!user || user.status !== "ACTIVE") throw new HttpError(403, "Your account cannot place bets.", "ACCOUNT_BLOCKED");
  const lim = user.limits, now = new Date();
  if (lim?.selfExcludedUntil && lim.selfExcludedUntil > now) throw new HttpError(403, "You have self-excluded. Betting is blocked.", "SELF_EXCLUDED");
  if (lim?.coolOffUntil && lim.coolOffUntil > now) throw new HttpError(403, "You are in a cool-off period.", "COOL_OFF");

  // A retry of a request that already succeeded returns the same tickets, never a second bet.
  const prior = await db.betTicket.findMany({ where: { userId, idempotencyKey: { startsWith: input.idempotencyKey } } });
  if (prior.length) return { replayed: true, tickets: prior.map((t) => ({ id: t.id, publicId: t.publicId, stake: fixed(t.stake), potentialPayout: fixed(t.potentialPayout), totalOdds: t.totalOdds.toFixed(2) })), balance: fixed(await balanceOf(userId)) };

  const load = () => db.marketOdds.findMany({ where: { id: { in: ids } }, include: rowInclude });
  let rows = await load();
  if (rows.length !== ids.length) throw new HttpError(404, "One of your selections no longer exists.", "SELECTION_GONE");

  // In-play bets wait a few seconds and are re-checked, so nobody can bet on a goal they have already seen.
  if (rows.some(isLive) && env.LIVE_BET_DELAY_SEC > 0) { await sleep(env.LIVE_BET_DELAY_SEC * 1000); rows = await load(); }

  for (const r of rows) {
    const f = r.market.fixture;
    const open = f.status === "LIVE" || f.status === "HALFTIME" || (f.status === "SCHEDULED" && f.kickoffAt > now);
    if (!open || !f.bettingOpen || r.market.status !== "OPEN" || r.status !== "OPEN")
      throw new HttpError(409, `Betting is closed on ${f.homeTeam} v ${f.awayTeam}.`, "MARKET_LOCKED", { oddsId: r.id });
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  const moved = input.selections.filter((s) => Math.abs(Number(byId.get(s.oddsId)!.odds) - s.odds) > 0.0005);
  if (moved.length && !input.acceptOddsChange)
    throw new HttpError(409, "Some odds have changed.", "ODDS_CHANGED", { changes: moved.map((s) => ({ oddsId: s.oddsId, old: s.odds, odds: Number(byId.get(s.oddsId)!.odds) })) });

  const virt = rows.map((r) => r.market.fixture.source === "virtual");
  if (virt.some(Boolean)) {
    if (!virt.every(Boolean)) throw new HttpError(400, "Virtual games cannot be combined with other sports.", "MIXED_VIRTUAL");
  }

  // ── build the tickets
  type Draft = { type: TicketType; cut: number; stake: Dec; legs: Row[]; key: string; total: Dec; pct: number; potential: Dec };
  const drafts: Draft[] = [];
  const mk = (type: TicketType, cut: number, stake: Dec, legs: Row[], key: string): Draft => {
    const odds = legs.map((l) => l.odds);
    const total = product(odds);
    let pct = 0, potential: Dec;
    if (type === "FLEXI" || type === "SYSTEM") potential = flexiMax(odds, stake, cut);
    else { pct = type === "MULTIPLE" ? bonusPctFor(odds) : 0; potential = stake.mul(total).plus(stake.mul(total).minus(stake).mul(pct).div(100)); }
    return { type, cut, stake, legs, key, total, pct, potential: down2(potential) };
  };
  if (input.tab === "single") {
    input.selections.forEach((s, i) => {
      const v = input.stakes?.[s.oddsId];
      if (v && v > 0) drafts.push(mk("SINGLE", 0, D(v), [byId.get(s.oddsId)!], `${input.idempotencyKey}.${i}`));
    });
    if (!drafts.length) throw new HttpError(400, "Enter a stake.");
  } else if (input.tab === "system") {
    const legs = input.selections.map((s) => byId.get(s.oddsId)!);
    const systemSize = input.systemSize;

    if (legs.length < 3) throw new HttpError(400, "A System bet needs at least 3 selections.");
    if (new Set(legs.map((l) => l.market.fixtureId)).size !== legs.length)
      throw new HttpError(400, "A System bet can have only one selection per match.", "SAME_MATCH");
    if (!systemSize || !Number.isInteger(systemSize) || systemSize < 2 || systemSize >= legs.length)
      throw new HttpError(400, "Choose a valid System combination size.");
    if (!input.stake) throw new HttpError(400, "Enter a System bet stake.");

    const cut = legs.length - systemSize;
    drafts.push(mk("SYSTEM", cut, D(input.stake), legs, input.idempotencyKey));
  } else {
    const legs = input.selections.map((s) => byId.get(s.oddsId)!);
    if (legs.length < 2) throw new HttpError(400, "A multiple needs at least 2 selections.");
    if (new Set(legs.map((l) => l.market.fixtureId)).size !== legs.length) throw new HttpError(400, "A multiple can have only one selection per match.", "SAME_MATCH");
    if (legs.length - input.flexiCut < 2) throw new HttpError(400, `Add more selections to use Cut ${input.flexiCut}.`);
    if (!input.stake) throw new HttpError(400, "Enter a stake.");
    drafts.push(mk(input.flexiCut ? "FLEXI" : "MULTIPLE", input.flexiCut, D(input.stake), legs, input.idempotencyKey));
  }

  let total = D(0);
  for (const d of drafts) {
    if (d.stake.lt(env.MIN_STAKE) || d.stake.gt(env.MAX_STAKE)) throw new HttpError(400, `Stake must be between ${env.MIN_STAKE} and ${env.MAX_STAKE}.`, "STAKE_RANGE");
    if (d.potential.gt(env.MAX_PAYOUT)) throw new HttpError(400, `The maximum payout is ${env.MAX_PAYOUT}. Lower your stake.`, "MAX_PAYOUT");
    total = total.plus(d.stake);
  }
  if (lim?.dailyStake) {
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const spent = await db.betTicket.aggregate({ where: { userId, placedAt: { gte: startOfDay } }, _sum: { stake: true } });
    if ((spent._sum.stake ?? D(0)).plus(total).gt(lim.dailyStake)) throw new HttpError(403, "This would pass your daily stake limit.", "STAKE_LIMIT");
  }

  // ── one atomic step: tickets + stake debits, or nothing at all
  const created = await db.$transaction(async (tx) => {
    const out = [];
    for (const d of drafts) {
      const t = await tx.betTicket.create({
        data: {
          publicId: publicId(), userId, type: d.type, flexiCut: d.cut, stake: d.stake, remainingStake: d.stake,
          isVirtual: virt.every(Boolean),
          virtualSession: virt.every(Boolean)
            ? {
                create: {
                  userId,
                  fixtureIds: [...new Set(d.legs.map((r) => r.market.fixtureId))],
                },
              }
            : undefined,
          totalOdds: d.total, bonusPct: d.pct, potentialPayout: d.potential, idempotencyKey: d.key,
          legs: { create: d.legs.map((r) => ({
            fixtureId: r.market.fixtureId, marketId: r.marketId, oddsId: r.id, oddsTaken: r.odds,
            matchName: `${r.market.fixture.homeTeam} v ${r.market.fixture.awayTeam}`, marketName: r.market.name, pickLabel: r.label,
            line: r.market.line, placedLive: isLive(r),
          })) },
        },
      });
      await post(tx, { userId, type: "BET_STAKE", amount: d.stake.neg(), idempotencyKey: `stake-${t.id}`, ticketId: t.id });
      out.push(t);
    }
    return out;
  }, { timeout: 15_000 });

  await notifyBalance(userId);
  await publishUser(userId, "bet", { publicIds: created.map((t) => t.publicId) });
  return {
    replayed: false, balance: fixed(await balanceOf(userId)),
    tickets: created.map((t) => ({ id: t.id, publicId: t.publicId, stake: fixed(t.stake), potentialPayout: fixed(t.potentialPayout), totalOdds: t.totalOdds.toFixed(2) })),
  };
}
