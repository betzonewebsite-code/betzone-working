import type { Prisma } from "@prisma/client";

export const fixtureInclude = { league: true, markets: { include: { odds: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } } } satisfies Prisma.FixtureInclude;
export type FixtureFull = Prisma.FixtureGetPayload<{ include: typeof fixtureInclude }>;

const MARKET_ID: Record<string, (lk: string, name: string) => string> = {
  ONE_X_TWO: () => "1x2",
  OVER_UNDER: (lk) => `ou_${lk}`,
  DOUBLE_CHANCE: () => "dc",
  BTTS: () => "btts",
  NEXT_GOAL: () => "next",
  ASIAN_HANDICAP: (lk) => `hcp_${lk}`,
  MONEYLINE: () => "ml",
  CORRECT_SCORE: () => "correct_score",
  TEAM_TOTALS: (lk, name) => `team_totals_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${lk}`,
  HALF_TIME_RESULT: () => "half_time_result",
  HALF_TIME_FULL_TIME: () => "half_time_full_time",
  WIN_MARGIN: () => "win_margin",
};

const ORDER = [
  "ONE_X_TWO",
  "DOUBLE_CHANCE",
  "MONEYLINE",
  "OVER_UNDER",
  "ASIAN_HANDICAP",
  "BTTS",
  "TEAM_TOTALS",
  "CORRECT_SCORE",
  "HALF_TIME_RESULT",
  "HALF_TIME_FULL_TIME",
  "WIN_MARGIN",
  "NEXT_GOAL",
];

/** Same shape as the front end's Fixture type, so the UI can switch from mock data without changes. */
export function toClientFixture(f: FixtureFull) {
  const live = f.status === "LIVE" || f.status === "HALFTIME";
  return {
    id: f.id, sport: f.sport.toLowerCase(), country: f.league.country, league: f.league.name, leagueKey: f.league.externalId,
    home: f.homeTeam, away: f.awayTeam, kickoff: f.kickoffAt.toISOString(),
    live, status: f.status, minute: f.minute, period: f.period, score: live || f.status === "FINISHED" ? [f.homeScore, f.awayScore] : undefined,
    bettingOpen: f.bettingOpen, marketCount: f.markets.length,
    markets: [...f.markets].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type)).map((m) => ({
      id: (MARKET_ID[m.type] ?? ((lk, name) => `${m.type.toLowerCase()}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${lk}`))(m.lineKey, m.name), dbId: m.id, name: m.name, line: m.line === null ? null : Number(m.line), lineKey: m.lineKey,
      selections: m.odds.map((o) => ({
        id: o.key, dbId: o.id, label: o.label, odds: Number(o.odds),
        previous: o.previousOdds === null ? null : Number(o.previousOdds),
        locked: o.status !== "OPEN",
      })),
    })),
  };
}


