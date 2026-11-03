import type { Prisma } from "@prisma/client";
import { db } from "../../src/lib/server/db";
import { redisReady } from "../../src/lib/server/redis";
import { LEAGUES } from "./leagues";
import { lineKey } from "./normalize";
import type { LeagueDef, NFixture, Provider } from "./types";

export const UPDATES_CHANNEL = "betzone:updates";   // Phase 5's Socket.io gateway subscribes to this
const GOAL_LOCK_SEC = 15;

export type OddsChange = { marketId: string; key: string; odds: number; previous: number | null; status: "OPEN" | "SUSPENDED" };
export type FixtureChange = {
  fixtureId: string; status?: string; minute?: number | null; score?: [number, number];
  bettingOpen?: boolean; reason?: string; odds: OddsChange[];
};

const leagueIds = new Map<string, string>();
async function leagueId(def: LeagueDef) {
  const cached = leagueIds.get(def.key);
  if (cached) return cached;
  const l = await db.league.upsert({
    where: { source_externalId: { source: "betzone", externalId: def.key } },
    update: { name: def.name, country: def.country, sport: def.sport, isPopular: def.popular, sortOrder: def.sort },
    create: { source: "betzone", externalId: def.key, name: def.name, country: def.country, sport: def.sport, isPopular: def.popular, sortOrder: def.sort },
  });
  leagueIds.set(def.key, l.id);
  return l.id;
}

export async function publish(changes: FixtureChange[]) {
  if (!changes.length) return;
  try {
    const client = await redisReady();
    await client.publish(UPDATES_CHANNEL, JSON.stringify({ ts: Date.now(), changes }));
  }
  catch (e) { console.warn("[publish] Redis unavailable:", (e as Error).message); }
}

/** Locks every open market on a fixture for a few seconds (goal / VAR check). */
export async function suspendFixture(fixtureId: string, seconds: number, reason: string) {
  await db.$transaction([
    db.market.updateMany({ where: { fixtureId, status: "OPEN" }, data: { status: "SUSPENDED", suspendedReason: reason } }),
    db.fixture.update({ where: { id: fixtureId }, data: { bettingOpen: false } }),
  ]);
  try {
    const client = await redisReady();
    await client.set(`susp:${fixtureId}`, reason, "EX", seconds);
  } catch {
    // Redis unavailable; database market suspension remains in effect.
  }
}

/** Reopens fixtures whose automatic lock has expired. Admin locks (susp:manual:<id>) are never reopened here. */
export async function sweepReopen(): Promise<FixtureChange[]> {
  const closed = await db.fixture.findMany({ where: { bettingOpen: false, status: { in: ["LIVE", "HALFTIME"] } }, select: { id: true } });
  const changes: FixtureChange[] = [];
  const client = await redisReady();
  for (const { id } of closed) {
    if ((await client.exists(`susp:${id}`)) || (await client.exists(`susp:manual:${id}`))) continue;
    await db.$transaction([
      db.market.updateMany({ where: { fixtureId: id, status: "SUSPENDED", suspendedReason: "Goal check" }, data: { status: "OPEN", suspendedReason: null } }),
      db.fixture.update({ where: { id }, data: { bettingOpen: true } }),
    ]);
    changes.push({ fixtureId: id, bettingOpen: true, odds: [] });
  }
  await publish(changes);
  return changes;
}

async function upsertOne(n: NFixture, def: LeagueDef): Promise<FixtureChange | null> {
  const change: FixtureChange = { fixtureId: "", odds: [] };
  const lid = await leagueId(def);
  const score = n.score;

  let fx = await db.fixture.findUnique({ where: { source_externalId: { source: n.source, externalId: n.externalId } } });
  if (!fx) {
    fx = await db.fixture.create({
      data: {
        source: n.source, externalId: n.externalId, leagueId: lid, sport: def.sport, homeTeam: n.home, awayTeam: n.away, kickoffAt: n.kickoff,
        status: n.status, minute: n.minute, period: n.period, homeScore: score?.[0] ?? 0, awayScore: score?.[1] ?? 0, lastSyncedAt: new Date(),
      },
    });
    change.status = n.status;
  } else {
    // A stale feed must never drag a finished match back to live.
    const status = fx.status === "FINISHED" && n.status !== "FINISHED" ? fx.status : n.status;
    const hs = score?.[0] ?? fx.homeScore, as = score?.[1] ?? fx.awayScore;
    const finishing = status === "FINISHED" && fx.status !== "FINISHED";
    const confirmedFinal = status === "FINISHED" && n.finalized === true;
    const goal = def.sport === "SOCCER" && fx.status === "LIVE" && status === "LIVE" && hs + as > fx.homeScore + fx.awayScore;
    const changed = fx.status !== status || fx.minute !== n.minute || fx.period !== n.period || fx.homeScore !== hs || fx.awayScore !== as || fx.kickoffAt.getTime() !== n.kickoff.getTime();
    if (changed || confirmedFinal) {
      fx = await db.fixture.update({
        where: { id: fx.id },
        data: {
          status, minute: n.minute, period: n.period, homeScore: hs, awayScore: as, kickoffAt: n.kickoff, lastSyncedAt: new Date(),
          ...(confirmedFinal ? { result: { final: [hs, as], source: n.source, finalizedAt: new Date().toISOString() } as Prisma.InputJsonValue } : {}),
          ...(status === "FINISHED" ? { bettingOpen: false } : {}),
        },
      });
      Object.assign(change, { status, minute: n.minute, score: [hs, as] as [number, number] });
    }
    if (status === "FINISHED") await db.market.updateMany({ where: { fixtureId: fx.id }, data: { status: "CLOSED" } });
    if (goal) { await suspendFixture(fx.id, GOAL_LOCK_SEC, "Goal check"); change.bettingOpen = false; change.reason = "Goal check"; }
  }
  change.fixtureId = fx.id;
  if (fx.status === "FINISHED") return change.status ? change : null;

  // â”€â”€ markets and odds: write only what changed
  const existing = await db.market.findMany({ where: { fixtureId: fx.id }, include: { odds: true } });
  const byKey = new Map(existing.map((m) => [`${m.type}|${m.lineKey}`, m]));
  const seen = new Set<string>();

  for (const nm of n.markets) {
    const lk = lineKey(nm.line), k = `${nm.type}|${lk}`;
    seen.add(k);
    const m = byKey.get(k);
    if (!m) {
      const created = await db.market.create({
        data: {
          fixtureId: fx.id, type: nm.type, line: nm.line, lineKey: lk, name: nm.name,
          status: fx.bettingOpen ? "OPEN" : "SUSPENDED", suspendedReason: fx.bettingOpen ? null : "Goal check",
          odds: { create: nm.selections.map((s) => ({ key: s.key, label: s.label, odds: s.odds, status: s.available ? "OPEN" : "SUSPENDED" })) },
        },
        include: { odds: true },
      });
      for (const o of created.odds) change.odds.push({ marketId: created.id, key: o.key, odds: Number(o.odds), previous: null, status: o.status });
      continue;
    }
    if (m.status === "SUSPENDED" && m.suspendedReason === "Not offered") await db.market.update({ where: { id: m.id }, data: { status: "OPEN", suspendedReason: null } });   // its selections reopen below, because their stored status is SUSPENDED
    for (const s of nm.selections) {
      const o = m.odds.find((x) => x.key === s.key);
      const st = s.available ? "OPEN" : "SUSPENDED";
      if (!o) {
        const c = await db.marketOdds.create({ data: { marketId: m.id, key: s.key, label: s.label, odds: s.odds, status: st } });
        change.odds.push({ marketId: m.id, key: s.key, odds: s.odds, previous: null, status: st });
        void c;
      } else if (Number(o.odds) !== s.odds || o.status !== st) {
        const cur = Number(o.odds);
        await db.marketOdds.update({ where: { id: o.id }, data: { odds: s.odds, previousOdds: cur !== s.odds ? cur : o.previousOdds, status: st, label: s.label } });
        change.odds.push({ marketId: m.id, key: s.key, odds: s.odds, previous: cur !== s.odds ? cur : null, status: st });
      }
    }
  }
  // Do not suspend a market just because one provider omits it.
  // Other configured providers may still supply this market.
  return change.status || change.score || change.bettingOpen !== undefined || change.odds.length ? change : null;
}


/* BETZONE_STALE_LIVE_CLEANUP */
async function cleanupStaleLiveFixtures(): Promise<void> {
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);

  const result = await db.fixture.updateMany({
    where: {
      status: { in: ["LIVE", "HALFTIME"] },
      OR: [
        { minute: { gte: 90 } },
        { kickoffAt: { lt: cutoff } },
      ],
    },
    data: {
      status: "FINISHED",
      bettingOpen: false,
    },
  });

  if (result.count > 0) {
    console.log(
      `[sync] Marked ${result.count} expired live fixtures FINISHED.`,
    );
  }
}

export async function syncOnce(
  provider: Provider,
  opts: { live: boolean },
  leagues: LeagueDef[] = LEAGUES,
) {
  await cleanupStaleLiveFixtures();
  const t0 = Date.now();
  const fixtures = await provider.fetchFixtures(leagues, opts);
  const changes: FixtureChange[] = [];
  let failed = 0;
  for (const n of fixtures) {
    const def = leagues.find((l) => l.key === n.leagueKey) ?? LEAGUES.find((l) => l.key === n.leagueKey);
    if (!def) continue;
    try { const c = await upsertOne(n, def); if (c) changes.push(c); }
    catch (e) { failed++; console.error(`[sync] ${n.home} v ${n.away}:`, (e as Error).message); }
  }
  await publish(changes);
  console.log(`[sync:${opts.live ? "live" : "upcoming"}] ${provider.name}: ${fixtures.length} fixtures, ${changes.length} changed, ${failed} failed, ${Date.now() - t0}ms`);
  return { fetched: fixtures.length, changed: changes.length, failed };
}




