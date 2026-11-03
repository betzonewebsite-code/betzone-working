import type { Fixture, Prisma } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { HttpError } from "./http";
import { publishUser } from "./events";
import { notifyBalance, post } from "./ledger";
import { D, down2, fixed, type Dec } from "./money";

const TIER_SHARE = [0.7, 0.3];      // share of the prize pool: all correct, then all but one
const MAX_ENTRIES_PER_USER = 10;
const PICKS = ["1", "X", "2"];

export const roundInclude = {
  matches: { include: { fixture: { include: { league: true } } }, orderBy: { position: "asc" } },
  _count: { select: { entries: true } },
} satisfies Prisma.JackpotRoundInclude;
type RoundFull = Prisma.JackpotRoundGetPayload<{ include: typeof roundInclude }>;

export const netPool = (seed: Dec, fee: Dec, count: number) => seed.plus(fee.mul(count).mul(1 - env.JACKPOT_HOUSE_PCT / 100));
const resultOf = (f: Fixture) => (f.homeScore > f.awayScore ? "1" : f.homeScore < f.awayScore ? "2" : "X");

export function roundDto(r: RoundFull) {
  return {
    id: r.id, title: r.title, status: r.status, entryFee: fixed(r.entryFee), closesAt: r.closesAt.toISOString(),
    pool: fixed(netPool(r.seed, r.entryFee, r._count.entries)), entries: r._count.entries,
    matches: r.matches.map((m) => ({
      fixtureId: m.fixtureId, position: m.position, home: m.fixture.homeTeam, away: m.fixture.awayTeam, league: m.fixture.league.name,
      kickoff: m.fixture.kickoffAt.toISOString(), status: m.fixture.status,
      score: m.fixture.status === "FINISHED" ? [m.fixture.homeScore, m.fixture.awayScore] : null,
    })),
  };
}

export async function enterJackpot(userId: string, roundId: string, picks: Record<string, string>, key: string) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { limits: true } });
  if (!user || user.status !== "ACTIVE") throw new HttpError(403, "Your account cannot play.", "ACCOUNT_BLOCKED");
  const now = new Date();
  if (user.limits?.selfExcludedUntil && user.limits.selfExcludedUntil > now) throw new HttpError(403, "You have self-excluded.", "SELF_EXCLUDED");
  if (user.limits?.coolOffUntil && user.limits.coolOffUntil > now) throw new HttpError(403, "You are in a cool-off period.", "COOL_OFF");

  const prior = await db.jackpotEntry.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
  if (prior) return { id: prior.id, replayed: true };

  const round = await db.jackpotRound.findUnique({ where: { id: roundId }, include: { matches: { include: { fixture: true } } } });
  if (!round || round.status !== "OPEN" || round.closesAt <= now) throw new HttpError(409, "This jackpot is closed.", "ROUND_CLOSED");
  if (round.matches.some((m) => m.fixture.status !== "SCHEDULED" || m.fixture.kickoffAt <= now)) throw new HttpError(409, "A match has already started.", "ROUND_CLOSED");
  const ids = round.matches.map((m) => m.fixtureId);
  if (Object.keys(picks).length !== ids.length || !ids.every((id) => PICKS.includes(picks[id]))) throw new HttpError(400, "Pick 1, X or 2 for every match.", "BAD_PICKS");
  const mine = await db.jackpotEntry.count({ where: { roundId, userId } });
  if (mine >= MAX_ENTRIES_PER_USER) throw new HttpError(403, `You can enter up to ${MAX_ENTRIES_PER_USER} times per jackpot.`, "ENTRY_LIMIT");

  const entry = await db.$transaction(async (tx) => {
    const e = await tx.jackpotEntry.create({ data: { roundId, userId, picks: Object.fromEntries(ids.map((id) => [id, picks[id]])), idempotencyKey: key } });
    await post(tx, { userId, type: "BET_STAKE", amount: round.entryFee.neg(), idempotencyKey: `jp-stake-${e.id}`, metadata: { jackpotRound: roundId } });
    return e;
  });
  await notifyBalance(userId);
  return { id: entry.id, replayed: false };
}

/** Closes rounds at their deadline, then settles or refunds the closed ones. Run every 30 s by the platform server. */
export async function settleJackpots() {
  const now = new Date();
  await db.jackpotRound.updateMany({ where: { status: "OPEN", closesAt: { lte: now } }, data: { status: "CLOSED" } });
  const rounds = await db.jackpotRound.findMany({ where: { status: "CLOSED" }, include: { matches: { include: { fixture: true } } } });
  const stale = new Date(now.getTime() - 48 * 3_600_000);
  for (const r of rounds) {
    const fx = r.matches.map((m) => m.fixture);
    if (fx.some((f) => f.status === "CANCELLED" || f.status === "ABANDONED" || (f.status === "POSTPONED" && f.kickoffAt < stale))) { await cancelRound(r.id); continue; }
    if (!fx.every((f) => f.status === "FINISHED")) continue;
    const agreed = fx.map((f) => (f.result as { agreed?: boolean | null } | null)?.agreed);
    if (agreed.some((a) => a === undefined || a === false)) continue;            // wait for confirmed results
    await settleRound(r.id);
  }
}

async function settleRound(roundId: string) {
  const winners = new Set<string>();
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "JackpotRound" WHERE "id" = ${roundId} FOR UPDATE`;
    const r = await tx.jackpotRound.findUnique({ where: { id: roundId }, include: { matches: { include: { fixture: true } }, entries: true } });
    if (!r || r.status !== "CLOSED") return;
    const results = new Map(r.matches.map((m) => [m.fixtureId, resultOf(m.fixture)]));
    const n = r.matches.length;
    const scored = r.entries.map((e) => {
      const p = e.picks as Record<string, string>;
      return { e, c: [...results].filter(([id, res]) => p[id] === res).length };
    });
    const pool = netPool(r.seed, r.entryFee, r.entries.length);
    const pay = new Map<string, Dec>();
    let paid = D(0);
    [scored.filter((s) => s.c === n), scored.filter((s) => s.c === n - 1)].forEach((group, i) => {
      if (!group.length) return;
      const each = down2(pool.mul(TIER_SHARE[i]).div(group.length));
      if (each.lte(0)) return;
      group.forEach((s) => { pay.set(s.e.id, each); paid = paid.plus(each); });
    });
    for (const { e, c } of scored) {
      const win = pay.get(e.id) ?? D(0);
      if (win.gt(0)) { await post(tx, { userId: e.userId, type: "BET_PAYOUT", amount: win, idempotencyKey: `jp-win-${e.id}`, metadata: { jackpotRound: r.id } }); winners.add(e.userId); }
      await tx.jackpotEntry.update({ where: { id: e.id }, data: { correct: c, payout: win } });
    }
    await tx.jackpotRound.update({ where: { id: r.id }, data: { status: "SETTLED", settledAt: new Date(), carryOver: pool.minus(paid) } });   // unclaimed prize rolls into the next round
  }, { timeout: 60_000 });
  for (const u of winners) { await notifyBalance(u); await publishUser(u, "bet", { jackpot: roundId }); }
}

async function cancelRound(roundId: string) {
  const users = new Set<string>();
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "JackpotRound" WHERE "id" = ${roundId} FOR UPDATE`;
    const r = await tx.jackpotRound.findUnique({ where: { id: roundId }, include: { entries: true } });
    if (!r || r.status !== "CLOSED") return;
    for (const e of r.entries) { await post(tx, { userId: e.userId, type: "BET_REFUND", amount: r.entryFee, idempotencyKey: `jp-refund-${e.id}`, metadata: { jackpotRound: r.id } }); users.add(e.userId); }
    await tx.jackpotRound.update({ where: { id: r.id }, data: { status: "CANCELLED", settledAt: new Date() } });
  }, { timeout: 60_000 });
  for (const u of users) await notifyBalance(u);
}
