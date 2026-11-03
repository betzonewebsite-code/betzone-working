/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FixtureStatus } from "@prisma/client";
import { env } from "../../../src/lib/server/env";
import { clampOdds, deriveDoubleChance, fmtLine, median, num, round3 } from "../normalize";
import type { FinalScore, LeagueDef, NFixture, NMarket, Provider } from "../types";

const BASE = "https://api.the-odds-api.com/v4";

async function get(path: string, params: Record<string, string>) {
  if (!env.THE_ODDS_API_KEY) throw new Error("THE_ODDS_API_KEY is not set");
  const url = new URL(BASE + path);
  url.searchParams.set("apiKey", env.THE_ODDS_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  console.log(`[the-odds-api] ${path} used=${r.headers.get("x-requests-used")} remaining=${r.headers.get("x-requests-remaining")}`);
  if (r.status === 401 || r.status === 429) throw new Error(`The Odds API ${r.status}: key invalid or quota used up`);
  if (!r.ok) throw new Error(`The Odds API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as any;
}

const scoreOf = (ev: any, team: string) => num(ev?.scores?.find((s: any) => s.name === team)?.score);

function mainKey(groups: Map<number, number>, target: number | null) {
  // the line most bookmakers agree on; ties go to the one nearest the target
  let best: number | null = null, bestN = -1;
  for (const [k, n] of groups) {
    if (n > bestN || (n === bestN && target !== null && best !== null && Math.abs(k - target) < Math.abs(best - target))) { best = k; bestN = n; }
  }
  return best;
}

export function parseOddsApiEvent(ev: any, league: LeagueDef, scoreEv: any, now = new Date()): NFixture | null {
  const home = ev?.home_team, away = ev?.away_team;
  if (!ev?.id || !home || !away || !ev.commence_time) return null;
  const kickoff = new Date(ev.commence_time);

  const h2h = { home: [] as number[], away: [] as number[], draw: [] as number[] };
  const totals = new Map<number, { over: number[]; under: number[] }>();
  const spreads = new Map<number, { home: number[]; away: number[] }>();
  for (const bk of ev.bookmakers ?? []) for (const m of bk.markets ?? []) {
    for (const o of m.outcomes ?? []) {
      const p = num(o.price); if (p === null) continue;
      if (m.key === "h2h") (o.name === home ? h2h.home : o.name === away ? h2h.away : h2h.draw).push(p);
      if (m.key === "totals" && num(o.point) !== null) {
        const t = totals.get(o.point) ?? { over: [], under: [] }; (o.name === "Over" ? t.over : t.under).push(p); totals.set(o.point, t);
      }
      if (m.key === "spreads" && num(o.point) !== null) {
        const key = o.name === home ? o.point : -o.point;           // keyed by the home team's line
        const s = spreads.get(key) ?? { home: [], away: [] }; (o.name === home ? s.home : s.away).push(p); spreads.set(key, s);
      }
    }
  }

  const sel = (key: string, label: string, ps: number[]) => ({ key, label, odds: clampOdds(round3(median(ps))), available: true });
  const markets: NMarket[] = [];
  if (league.sport === "SOCCER" && h2h.home.length && h2h.away.length && h2h.draw.length) {
    const h = median(h2h.home), d = median(h2h.draw), a = median(h2h.away);
    markets.push({ type: "ONE_X_TWO", line: null, name: "1X2", selections: [sel("1", "Home", h2h.home), sel("X", "Draw", h2h.draw), sel("2", "Away", h2h.away)] });
    const dc = deriveDoubleChance(h, d, a);
    markets.push({ type: "DOUBLE_CHANCE", line: null, name: "Double Chance", selections: [sel("1x", "1X", [dc["1x"]]), sel("12", "12", [dc["12"]]), sel("x2", "X2", [dc.x2])] });
  } else if (league.sport === "BASKETBALL" && h2h.home.length && h2h.away.length) {
    markets.push({ type: "MONEYLINE", line: null, name: "Moneyline", selections: [sel("h", home, h2h.home), sel("a", away, h2h.away)] });
  }
  const tCount = new Map([...totals].filter(([, v]) => v.over.length && v.under.length).map(([k, v]) => [k, Math.min(v.over.length, v.under.length)]));
  const tKey = mainKey(tCount, league.sport === "SOCCER" ? 2.5 : null);
  if (tKey !== null) { const t = totals.get(tKey)!; markets.push({ type: "OVER_UNDER", line: tKey, name: `Over/Under ${tKey}`, selections: [sel("over", `Over ${tKey}`, t.over), sel("under", `Under ${tKey}`, t.under)] }); }
  const sCount = new Map([...spreads].filter(([, v]) => v.home.length && v.away.length).map(([k, v]) => [k, Math.min(v.home.length, v.away.length)]));
  const sKey = mainKey(sCount, 0);
  if (sKey !== null) { const s = spreads.get(sKey)!; markets.push({ type: "ASIAN_HANDICAP", line: sKey, name: `Handicap ${fmtLine(sKey)}`, selections: [sel("h", `${home} ${fmtLine(sKey)}`, s.home), sel("a", `${away} ${fmtLine(-sKey)}`, s.away)] }); }

  let status: FixtureStatus = "SCHEDULED";
  let score: [number, number] | null = null;
  const sh = scoreOf(scoreEv, home), sa = scoreOf(scoreEv, away);
  if (sh !== null && sa !== null) { score = [sh, sa]; status = scoreEv.completed ? "FINISHED" : "LIVE"; }
  const minute = status === "LIVE" && league.sport === "SOCCER" ? Math.max(0, Math.min(120, Math.floor((now.getTime() - kickoff.getTime()) / 60_000))) : null; // estimate only

  return { source: "the-odds-api", externalId: ev.id, leagueKey: league.key, home, away, kickoff, status, minute, period: null, score, finalized: status === "FINISHED" && !!scoreEv?.completed, markets };
}

export const theOddsApi: Provider = {
  name: "the-odds-api",

  async fetchFixtures(leagues) {
    const out: NFixture[] = [];
    for (const def of leagues.filter((l) => l.oddsApi)) {
      // credits: markets x regions per odds call (3 x 2 = 6) plus 2 for scores
      const odds = await get(`/sports/${def.oddsApi}/odds`, { regions: env.ODDS_API_REGIONS, markets: "h2h,spreads,totals", oddsFormat: "decimal", dateFormat: "iso" });
      const scores = await get(`/sports/${def.oddsApi}/scores`, { daysFrom: "1", dateFormat: "iso" });
      const byId = new Map<string, any>((scores as any[]).map((s) => [s.id, s]));
      for (const ev of odds as any[]) { const p = parseOddsApiEvent(ev, def, byId.get(ev.id)); if (p) out.push(p); }
    }
    return out;
  },

  async fetchFinals(leagues): Promise<FinalScore[]> {
    const out: FinalScore[] = [];
    for (const def of leagues.filter((l) => l.oddsApi)) {
      const scores = await get(`/sports/${def.oddsApi}/scores`, { daysFrom: "2", dateFormat: "iso" });
      for (const ev of scores as any[]) {
        const h = scoreOf(ev, ev.home_team), a = scoreOf(ev, ev.away_team);
        if (ev.completed && h !== null && a !== null) out.push({ source: "the-odds-api", externalId: ev.id, leagueKey: def.key, home: ev.home_team, away: ev.away_team, kickoff: new Date(ev.commence_time), score: [h, a] });
      }
    }
    return out;
  },
};
