import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "../../src/lib/server/db";
import { env } from "../../src/lib/server/env";
import { redisReady } from "../../src/lib/server/redis";
import { loop } from "../workers/settlement";
import {
  PREMIER_LEAGUE_TEAMS,
  CHAMPIONSHIP_TEAMS,
  lambdas,
  marketProbs,
  price,
  simulate,
  type Goal,
  type Team,
} from "./sim";

type LeagueKey = "VIRTUAL-PL" | "VIRTUAL-CHAMPIONSHIP";

export type RoundMatch = {
  i: number;
  fixtureId: string;
  leagueKey: LeagueKey;
  home: string;
  away: string;
  lamH: number;
  lamA: number;
  hs?: number;
  as?: number;
  goals?: Goal[];
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function poissonProbability(lambda: number, goals: number): number {
  let probability = Math.exp(-lambda);
  for (let i = 1; i <= goals; i++) probability *= lambda / i;
  return probability;
}

function totalGoalsProbability(lamH: number, lamA: number, line: number) {
  const lambda = lamH + lamA;
  const probabilities = Array.from({ length: 16 }, (_, goals) =>
    poissonProbability(lambda, goals)
  );
  const over = probabilities.reduce(
    (sum, probability, goals) => sum + (goals > line ? probability : 0),
    0
  );
  return { over, under: 1 - over };
}

function scoreGrid(lamH: number, lamA: number, maxGoals = 10) {
  const home = Array.from({ length: maxGoals + 1 }, (_, goals) => poissonProbability(lamH, goals));
  const away = Array.from({ length: maxGoals + 1 }, (_, goals) => poissonProbability(lamA, goals));
  const raw = home.flatMap((ph, h) =>
    away.map((pa, a) => ({ h, a, probability: ph * pa }))
  );
  const total = raw.reduce((sum, item) => sum + item.probability, 0);
  return raw.map((item) => ({ ...item, probability: item.probability / total }));
}

function longOdds(probability: number, margin: number) {
  if (!(probability > 0)) return 100;
  return Math.min(100, Math.max(1.01, Number((1 / (probability * (1 - margin))).toFixed(2))));
}

function asianOdds(
  grid: ReturnType<typeof scoreGrid>,
  handicap: number,
  side: "h" | "a",
  margin: number
) {
  let won = 0, halfWon = 0, voided = 0, halfLost = 0;
  for (const item of grid) {
    const adjusted = side === "h"
      ? item.h + handicap - item.a
      : item.a - handicap - item.h;
    const outcomes = Math.abs((handicap * 4) % 2) === 1
      ? [adjusted - 0.25, adjusted + 0.25]
      : [adjusted];
    const average = outcomes.reduce((sum, value) => sum + (value > 0 ? 1 : value < 0 ? -1 : 0), 0) / outcomes.length;
    if (average === 1) won += item.probability;
    else if (average > 0) halfWon += item.probability;
    else if (average === 0) voided += item.probability;
    else if (average > -1) halfLost += item.probability;
  }
  const denominator = won + halfWon / 2;
  if (denominator <= 0) return 100;
  const target = 1 / (1 - margin);
  const value = (target - halfWon / 2 - voided - halfLost / 2) / denominator;
  return Math.min(100, Math.max(1.01, Number(value.toFixed(2))));
}

function totalOverProbability(lambda: number, line: number) {
  return Array.from({ length: 16 }, (_, goals) =>
    goals > line ? poissonProbability(lambda, goals) : 0
  ).reduce((sum, value) => sum + value, 0);
}

function resultKey(home: number, away: number) {
  return home > away ? "1" : home < away ? "2" : "X";
}

function halfFullProbabilities(lamH: number, lamA: number) {
  const halfH = lamH * 0.5;
  const halfA = lamA * 0.5;
  const first = scoreGrid(halfH, halfA, 8);
  const second = scoreGrid(halfH, halfA, 8);
  const probabilities: Record<string, number> = {};
  for (const ht of first) {
    for (const sh of second) {
      const key = `${resultKey(ht.h, ht.a)}/${resultKey(ht.h + sh.h, ht.a + sh.a)}`;
      probabilities[key] = (probabilities[key] ?? 0) + ht.probability * sh.probability;
    }
  }
  return probabilities;
}
const POOLS: {
  key: LeagueKey;
  name: string;
  country: string;
  teams: Team[];
  fixtures: number;
  sortOrder: number;
}[] = [
  {
    key: "VIRTUAL-PL",
    name: "Instant Virtual Premier League",
    country: "England",
    teams: PREMIER_LEAGUE_TEAMS,
    fixtures: 10,
    sortOrder: 1000,
  },
  {
    key: "VIRTUAL-CHAMPIONSHIP",
    name: "Instant Virtual Championship",
    country: "England",
    teams: CHAMPIONSHIP_TEAMS,
    fixtures: 12,
    sortOrder: 1001,
  },
];

type ScheduledPair = {
  home: Team;
  away: Team;
};

function buildRoundRobinSchedule(
  teams: Team[],
  pinnedPairs: Array<{ home: string; away: string }>,
): ScheduledPair[][] {
  if (teams.length < 2 || teams.length % 2 !== 0) {
    throw new Error("Round-robin scheduling requires an even number of teams.");
  }

  const teamByName = new Map(teams.map((team) => [team.name, team]));
  const used = new Set<string>();
  const firstDay: ScheduledPair[] = [];

  for (const pair of pinnedPairs) {
    const home = teamByName.get(pair.home);
    const away = teamByName.get(pair.away);

    if (!home || !away || home.name === away.name) continue;
    if (used.has(home.name) || used.has(away.name)) continue;

    firstDay.push({ home, away });
    used.add(home.name);
    used.add(away.name);
  }

  const remaining = teams.filter((team) => !used.has(team.name));
  const remainingPairs: ScheduledPair[] = [];

  for (let i = 0; i < remaining.length; i += 2) {
    remainingPairs.push({
      home: remaining[i],
      away: remaining[i + 1],
    });
  }

  firstDay.push(...remainingPairs);

  const homeTeams = firstDay.map((pair) => pair.home);
  const awayTeams = firstDay.map((pair) => pair.away);

  let rotation = [...homeTeams, ...awayTeams.reverse()];
  const schedule: ScheduledPair[][] = [];

  for (let matchday = 0; matchday < teams.length - 1; matchday++) {
    const fixtures: ScheduledPair[] = [];

    for (let i = 0; i < teams.length / 2; i++) {
      const first = rotation[i];
      const second = rotation[teams.length - 1 - i];

      if (matchday === 0 || (matchday + i) % 2 === 0) {
        fixtures.push({ home: first, away: second });
      } else {
        fixtures.push({ home: second, away: first });
      }
    }

    schedule.push(fixtures);

    const fixed = rotation[0];
    const moving = rotation.slice(1);
    moving.unshift(moving.pop()!);
    rotation = [fixed, ...moving];
  }

  return schedule;
}
async function getLeague(pool: (typeof POOLS)[number]) {
  return db.league.upsert({
    where: { source_externalId: { source: "betzone", externalId: pool.key } },
    update: {
      name: pool.name,
      country: pool.country,
      sport: "SOCCER",
      isPopular: false,
      sortOrder: pool.sortOrder,
    },
    create: {
      source: "betzone",
      externalId: pool.key,
      name: pool.name,
      country: pool.country,
      sport: "SOCCER",
      isPopular: false,
      sortOrder: pool.sortOrder,
    },
  });
}

async function nextRoundNumber() {
  const last = await db.virtualRound.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

async function createFixture(
  pool: (typeof POOLS)[number],
  leagueId: string,
  home: Team,
  away: Team,
  season: number,
  matchday: number,
) {
  const number = await nextRoundNumber();
  const seed = randomBytes(32).toString("hex");
  const { lamH, lamA } = lambdas(home, away);
  const p = marketProbs(lamH, lamA);
  const margin = env.VIRTUALS_MARGIN_PCT / 100;
  const odds = (probability: number) => price(probability, margin);

  // These dates are placeholders until a customer starts this individual match.
  const notStarted = new Date(Date.now() + 365 * 86_400_000);
  const externalId = `virtual-${pool.key.toLowerCase()}-${number}`;

  const fixture = await db.fixture.create({
    data: {
      source: "virtual",
      externalId,
      leagueId,
      sport: "SOCCER",
      homeTeam: home.name,
      awayTeam: away.name,
      kickoffAt: notStarted,
      status: "SCHEDULED",
      bettingOpen: true,
      markets: {
        create: [
          {
            type: "ONE_X_TWO",
            line: null,
            lineKey: "",
            name: "1X2",
            odds: {
              create: [
                { key: "1", label: "Home", odds: odds(p.p1) },
                { key: "X", label: "Draw", odds: odds(p.px) },
                { key: "2", label: "Away", odds: odds(p.p2) },
              ],
            },
          },
          ...[0.5, 1.5, 2.5, 3.5, 4.5].map((line) => {
            const probabilities = line === 2.5
              ? { over: p.over, under: p.under }
              : totalGoalsProbability(lamH, lamA, line);
            return {
              type: "OVER_UNDER" as const,
              line,
              lineKey: String(line),
              name: `Over/Under ${line}`,
              odds: {
                create: [
                  { key: "over", label: `Over ${line}`, odds: odds(probabilities.over) },
                  { key: "under", label: `Under ${line}`, odds: odds(probabilities.under) },
                ],
              },
            };
          }),
          ...[-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2].map((line) => ({
            type: "ASIAN_HANDICAP" as const,
            line,
            lineKey: String(line),
            name: `Asian Handicap ${line > 0 ? "+" : ""}${line}`,
            odds: {
              create: [
                { key: "h", label: `Home ${line > 0 ? "+" : ""}${line}`, odds: asianOdds(scoreGrid(lamH, lamA), line, "h", margin) },
                { key: "a", label: `Away ${line > 0 ? "-" : "+"}${Math.abs(line)}`, odds: asianOdds(scoreGrid(lamH, lamA), line, "a", margin) },
              ],
            },
          })),
          {
            type: "DOUBLE_CHANCE",
            line: null,
            lineKey: "",
            name: "Double Chance",
            odds: {
              create: [
                { key: "1x", label: "1X", odds: odds(p.p1 + p.px) },
                { key: "12", label: "12", odds: odds(p.p1 + p.p2) },
                { key: "x2", label: "X2", odds: odds(p.px + p.p2) },
              ],
            },
          },
          {
            type: "MONEYLINE",
            line: null,
            lineKey: "",
            name: "Draw No Bet",
            odds: {
              create: [
                { key: "h", label: "Home", odds: odds(p.p1 / (p.p1 + p.p2)) },
                { key: "a", label: "Away", odds: odds(p.p2 / (p.p1 + p.p2)) },
              ],
            },
          },
          {
            type: "BTTS",
            line: null,
            lineKey: "",
            name: "GG/NG",
            odds: {
              create: [
                { key: "gg", label: "GG (Yes)", odds: odds(p.gg) },
                { key: "ng", label: "NG (No)", odds: odds(p.ng) },
              ],
            },
          },          ...[0.5, 1.5, 2.5].flatMap((line) => {
            const homeOver = totalOverProbability(lamH, line);
            const awayOver = totalOverProbability(lamA, line);
            return [
              {
                type: "TEAM_TOTALS" as const,
                line,
                lineKey: String(line),
                name: `Home Team Total ${line}`,
                odds: { create: [
                  { key: "over", label: `Home Over ${line}`, odds: odds(homeOver) },
                  { key: "under", label: `Home Under ${line}`, odds: odds(1 - homeOver) },
                ] },
              },
              {
                type: "TEAM_TOTALS" as const,
                line,
                lineKey: String(line),
                name: `Away Team Total ${line}`,
                odds: { create: [
                  { key: "over", label: `Away Over ${line}`, odds: odds(awayOver) },
                  { key: "under", label: `Away Under ${line}`, odds: odds(1 - awayOver) },
                ] },
              },
            ];
          }),
          {
            type: "CORRECT_SCORE" as const,
            line: null,
            lineKey: "",
            name: "Correct Score",
            odds: {
              create: (() => {
                const grid = scoreGrid(lamH, lamA, 10);
                const listed = grid.filter((item) => item.h <= 5 && item.a <= 5);
                const listedProbability = listed.reduce((sum, item) => sum + item.probability, 0);
                return [
                  ...listed.map((item) => ({
                    key: `${item.h}-${item.a}`,
                    label: `${item.h}-${item.a}`,
                    odds: longOdds(item.probability, margin),
                  })),
                  {
                    key: "other",
                    label: "Any Other Score",
                    odds: longOdds(Math.max(0.000001, 1 - listedProbability), margin),
                  },
                ];
              })(),
            },
          },
          {
            type: "HALF_TIME_RESULT" as const,
            line: null,
            lineKey: "",
            name: "Half-Time Result",
            odds: {
              create: (() => {
                const halfGrid = scoreGrid(lamH * 0.5, lamA * 0.5, 8);
                const probabilities = { "1": 0, X: 0, "2": 0 };
                for (const item of halfGrid) {
                  probabilities[resultKey(item.h, item.a) as keyof typeof probabilities] += item.probability;
                }
                return [
                  { key: "1", label: "Home", odds: odds(probabilities["1"]) },
                  { key: "X", label: "Draw", odds: odds(probabilities.X) },
                  { key: "2", label: "Away", odds: odds(probabilities["2"]) },
                ];
              })(),
            },
          },
          {
            type: "HALF_TIME_FULL_TIME" as const,
            line: null,
            lineKey: "",
            name: "Half-Time/Full-Time",
            odds: {
              create: Object.entries(halfFullProbabilities(lamH, lamA)).map(([key, probability]) => ({
                key,
                label: key,
                odds: longOdds(probability, margin),
              })),
            },
          },
          {
            type: "WIN_MARGIN" as const,
            line: null,
            lineKey: "",
            name: "Win Margin",
            odds: {
              create: (() => {
                const probabilities = { h1: 0, h2: 0, h3: 0, a1: 0, a2: 0, a3: 0 };
                for (const item of scoreGrid(lamH, lamA, 10)) {
                  const difference = item.h - item.a;
                  const key = difference > 0
                    ? difference === 1 ? "h1" : difference === 2 ? "h2" : "h3"
                    : difference < 0
                      ? difference === -1 ? "a1" : difference === -2 ? "a2" : "a3"
                      : null;
                  if (key) probabilities[key] += item.probability;
                }
                return [
                  { key: "h1", label: "Home by 1", odds: longOdds(probabilities.h1, margin) },
                  { key: "h2", label: "Home by 2", odds: longOdds(probabilities.h2, margin) },
                  { key: "h3", label: "Home by 3+", odds: longOdds(probabilities.h3, margin) },
                  { key: "a1", label: "Away by 1", odds: longOdds(probabilities.a1, margin) },
                  { key: "a2", label: "Away by 2", odds: longOdds(probabilities.a2, margin) },
                  { key: "a3", label: "Away by 3+", odds: longOdds(probabilities.a3, margin) },
                ];
              })(),
            },
          },
        ],
      },
    },
  });

  const match: RoundMatch = {
    i: 0,
    fixtureId: fixture.id,
    leagueKey: pool.key,
    home: home.name,
    away: away.name,
    lamH,
    lamA,
  };

  await db.virtualRound.create({
    data: {
      number,
      season,
      matchday,
      seed,
      seedHash: sha(seed),
      betsCloseAt: notStarted,
      endsAt: notStarted,
      status: "BETTING",
      matches: [match] as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`[virtuals] created ${pool.key}: ${home.name} v ${away.name}`);
  return true;
}


async function addMissingMarketsToOpenFixtures() {
  const rounds = await db.virtualRound.findMany({
    where: { status: "BETTING" },
    select: { matches: true },
  });

  const margin = env.VIRTUALS_MARGIN_PCT / 100;
  const odds = (probability: number) => price(probability, margin);

  for (const round of rounds) {
    for (const match of round.matches as RoundMatch[]) {
      const fixture = await db.fixture.findUnique({
        where: { id: match.fixtureId },
        select: {
          bettingOpen: true,
          markets: { select: { type: true, name: true, lineKey: true } },
        },
      });

      if (!fixture || !fixture.bettingOpen) continue;

      const existing = new Set(
        fixture.markets.map((market) =>
          [market.type, market.lineKey].join("|")
        )
      );

      const missing: Prisma.MarketCreateWithoutFixtureInput[] = [];

      for (const line of [0.5, 1.5, 2.5]) {
        const homeName = `Home Team Total ${line}`;
        const awayName = `Away Team Total ${line}`;
        const homeOver = totalOverProbability(match.lamH, line);
        const awayOver = totalOverProbability(match.lamA, line);

        if (!existing.has(["TEAM_TOTALS", `HOME_${line}`].join("|")) && !existing.has(["TEAM_TOTALS", String(line)].join("|"))) {
          missing.push({
            type: "TEAM_TOTALS",
            line,
            lineKey: `HOME_${line}`,
            name: homeName,
            odds: { create: [
              { key: "over", label: `Home Over ${line}`, odds: odds(homeOver) },
              { key: "under", label: `Home Under ${line}`, odds: odds(1 - homeOver) },
            ] },
          });
        }

        if (!existing.has(["TEAM_TOTALS", `AWAY_${line}`].join("|")) && !existing.has(["TEAM_TOTALS", String(line)].join("|"))) {
          missing.push({
            type: "TEAM_TOTALS",
            line,
            lineKey: `AWAY_${line}`,
            name: awayName,
            odds: { create: [
              { key: "over", label: `Away Over ${line}`, odds: odds(awayOver) },
              { key: "under", label: `Away Under ${line}`, odds: odds(1 - awayOver) },
            ] },
          });
        }
      }

      if (!existing.has(["CORRECT_SCORE", ""].join("|"))) {
        const grid = scoreGrid(match.lamH, match.lamA, 10);
        const listed = grid.filter((item) => item.h <= 5 && item.a <= 5);
        const listedProbability = listed.reduce((sum, item) => sum + item.probability, 0);

        missing.push({
          type: "CORRECT_SCORE",
          line: null,
          lineKey: "",
          name: "Correct Score",
          odds: { create: [
            ...listed.map((item) => ({
              key: `${item.h}-${item.a}`,
              label: `${item.h}-${item.a}`,
              odds: longOdds(item.probability, margin),
            })),
            {
              key: "other",
              label: "Any Other Score",
              odds: longOdds(Math.max(0.000001, 1 - listedProbability), margin),
            },
          ] },
        });
      }

      if (!existing.has(["HALF_TIME_RESULT", ""].join("|"))) {
        const halfGrid = scoreGrid(match.lamH * 0.5, match.lamA * 0.5, 8);
        const probabilities = { "1": 0, X: 0, "2": 0 };

        for (const item of halfGrid) {
          probabilities[resultKey(item.h, item.a) as keyof typeof probabilities] += item.probability;
        }

        missing.push({
          type: "HALF_TIME_RESULT",
          line: null,
          lineKey: "",
          name: "Half-Time Result",
          odds: { create: [
            { key: "1", label: "Home", odds: odds(probabilities["1"]) },
            { key: "X", label: "Draw", odds: odds(probabilities.X) },
            { key: "2", label: "Away", odds: odds(probabilities["2"]) },
          ] },
        });
      }

      if (!existing.has(["HALF_TIME_FULL_TIME", ""].join("|"))) {
        missing.push({
          type: "HALF_TIME_FULL_TIME",
          line: null,
          lineKey: "",
          name: "Half-Time/Full-Time",
          odds: {
            create: Object.entries(halfFullProbabilities(match.lamH, match.lamA)).map(([key, probability]) => ({
              key,
              label: key,
              odds: longOdds(probability, margin),
            })),
          },
        });
      }

      if (!existing.has(["WIN_MARGIN", ""].join("|"))) {
        const probabilities = { h1: 0, h2: 0, h3: 0, a1: 0, a2: 0, a3: 0 };

        for (const item of scoreGrid(match.lamH, match.lamA, 10)) {
          const difference = item.h - item.a;
          const key = difference > 0
            ? difference === 1 ? "h1" : difference === 2 ? "h2" : "h3"
            : difference < 0
              ? difference === -1 ? "a1" : difference === -2 ? "a2" : "a3"
              : null;

          if (key) probabilities[key] += item.probability;
        }

        missing.push({
          type: "WIN_MARGIN",
          line: null,
          lineKey: "",
          name: "Win Margin",
          odds: { create: [
            { key: "h1", label: "Home by 1", odds: longOdds(probabilities.h1, margin) },
            { key: "h2", label: "Home by 2", odds: longOdds(probabilities.h2, margin) },
            { key: "h3", label: "Home by 3+", odds: longOdds(probabilities.h3, margin) },
            { key: "a1", label: "Away by 1", odds: longOdds(probabilities.a1, margin) },
            { key: "a2", label: "Away by 2", odds: longOdds(probabilities.a2, margin) },
            { key: "a3", label: "Away by 3+", odds: longOdds(probabilities.a3, margin) },
          ] },
        });
      }

      if (missing.length) {
        await db.fixture.update({
          where: { id: match.fixtureId },
          data: { markets: { create: missing } },
        });
      }
    }
  }
}
async function ensureFixturePools() {
  await addMissingMarketsToOpenFixtures();

  const historyRounds = await db.virtualRound.findMany({
    select: {
      id: true,
      number: true,
      season: true,
      matchday: true,
      status: true,
      matches: true,
    },
  });

  for (const pool of POOLS) {
    const records: {
      id: string;
      season: number;
      matchday: number;
      status: string;
      match: RoundMatch;
    }[] = [];

    for (const round of historyRounds) {
      const matches = Array.isArray(round.matches)
        ? round.matches as unknown as RoundMatch[]
        : [];

      const match = matches.find((item) => item.leagueKey === pool.key);
      if (!match) continue;

      const season = round.season ?? 1;
      const matchday = round.matchday ?? 1;

      if (round.season == null || round.matchday == null) {
        await db.virtualRound.update({
          where: { id: round.id },
          data: { season, matchday },
        });
      }

      records.push({
        id: round.id,
        season,
        matchday,
        status: round.status,
        match,
      });
    }

    let season = Math.max(1, ...records.map((item) => item.season));

    let matchday = Math.max(
      1,
      ...records
        .filter((item) => item.season === season)
        .map((item) => item.matchday),
    );

    const totalMatchdays = pool.teams.length - 1;

    let currentRounds = records.filter(
      (item) => item.season === season && item.matchday === matchday,
    );

    // Advance only when every expected fixture in the current matchday is finished.
    while (
      currentRounds.length >= pool.fixtures &&
      currentRounds.every((item) => item.status === "DONE")
    ) {
      if (matchday < totalMatchdays) {
        matchday++;
      } else {
        season++;
        matchday = 1;
      }

      currentRounds = records.filter(
        (item) => item.season === season && item.matchday === matchday,
      );
    }

    // Preserve the already completed first-matchday pairings.
    const pinnedPairs = season === 1
      ? records
          .filter((item) => item.season === 1 && item.matchday === 1)
          .map((item) => ({
            home: item.match.home,
            away: item.match.away,
          }))
      : [];

    const schedule = buildRoundRobinSchedule(pool.teams, pinnedPairs);
    const scheduledFixtures = schedule[matchday - 1] ?? [];

    const pairKey = (home: string, away: string) =>
      [home, away].sort().join("|");

    const existingPairs = new Set(
      currentRounds.map((item) => pairKey(item.match.home, item.match.away)),
    );

    const missingFixtures = scheduledFixtures.filter(
      (pair) => !existingPairs.has(pairKey(pair.home.name, pair.away.name)),
    );

    const missingCount = Math.max(0, pool.fixtures - currentRounds.length);

    if (missingCount === 0) continue;

    const league = await getLeague(pool);

    for (const pair of missingFixtures.slice(0, missingCount)) {
      await createFixture(
        pool,
        league.id,
        pair.home,
        pair.away,
        season,
        matchday,
      );
    }

    console.log(
      `[virtuals] ${pool.key}: season ${season}, matchday ${matchday}, created ${Math.min(missingFixtures.length, missingCount)} fixture(s)`,
    );
  }
}

/**
 * Starts one fixture for the entire platform.
 * The result is generated from its secret seed, but remains hidden until full time.
 */
export async function kickOffVirtualFixture(fixtureId: string) {
  const round = await db.virtualRound.findFirst({
    where: {
      status: "BETTING",
      matches: { array_contains: [{ fixtureId }] },
    },
  });

  if (!round) {
    throw new Error("This virtual fixture is no longer available to start.");
  }

  const matches = round.matches as RoundMatch[];
  const match = matches.find((item) => item.fixtureId === fixtureId);

  if (!match) {
    throw new Error("Virtual fixture not found.");
  }

  const result = simulate(round.seed, round.number, match.i, match.lamH, match.lamA);
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + env.VIRTUALS_PLAY_SEC * 1000);
  const updatedMatch = { ...match, ...result };

  const started = await db.$transaction(async (tx) => {
    const claimed = await tx.virtualRound.updateMany({
      where: { id: round.id, status: "BETTING" },
      data: {
        status: "PLAYING",
        betsCloseAt: startedAt,
        endsAt,
        matches: [updatedMatch] as unknown as Prisma.InputJsonValue,
      },
    });

    if (!claimed.count) return false;

    const fixtureUpdate = await tx.fixture.updateMany({
      where: {
        id: fixtureId,
        source: "virtual",
        status: "SCHEDULED",
        bettingOpen: true,
      },
      data: {
        status: "LIVE",
        kickoffAt: startedAt,
        minute: 0,
        bettingOpen: false,
      },
    });

    if (!fixtureUpdate.count) {
      throw new Error("This virtual fixture has already started.");
    }

    await tx.market.updateMany({
      where: { fixtureId },
      data: { status: "CLOSED" },
    });

    return true;
  });

  if (!started) {
    throw new Error("This virtual fixture has already started.");
  }

  console.log(`[virtuals] kicked off ${match.home} v ${match.away}`);
  return { fixtureId, startedAt: startedAt.toISOString(), endsAt: endsAt.toISOString() };
}

async function finishMatch(round: {
  id: string;
  number: number;
  seedHash: string;
  matches: unknown;
}) {
  const match = (round.matches as RoundMatch[])[0];
  if (!match || match.hs === undefined || match.as === undefined) return;

  const finished = await db.$transaction(async (tx) => {
    const claimed = await tx.virtualRound.updateMany({
      where: { id: round.id, status: "PLAYING" },
      data: { status: "DONE" },
    });

    if (!claimed.count) return false;

    await tx.fixture.update({
      where: { id: match.fixtureId },
      data: {
        status: "FINISHED",
        homeScore: match.hs!,
        awayScore: match.as!,
        minute: 90,
        result: {
          final: [match.hs!, match.as!],
          halfTime: [
            (match.goals ?? []).filter((goal) => goal.minute <= 45 && goal.side === "h").length,
            (match.goals ?? []).filter((goal) => goal.minute <= 45 && goal.side === "a").length,
          ],
          source: "virtual",
          agreed: null,
          seedHash: round.seedHash,
        },
      },
    });

    return true;
  });

  if (finished) {
    console.log(`[virtuals] finished ${match.home} ${match.hs}-${match.as} ${match.away}`);
  }
}

let lastPoolCheck = 0;

async function tick() {
  const client = await redisReady();

  if (!(await client.set("virt:lock", "1", "EX", 10, "NX"))) return;

  try {
    const now = new Date();

    const playing = await db.virtualRound.findMany({
      where: { status: "PLAYING", endsAt: { lte: now } },
    });

    for (const round of playing) {
      await finishMatch(round);
    }

    // Keep one full set of upcoming fixtures per league.
    // A replacement is created only after its previous fixture finishes.
    if (Date.now() - lastPoolCheck >= 30_000) {
      lastPoolCheck = Date.now();
      await ensureFixturePools();
    }
  } finally {
    await client.del("virt:lock");
  }
}

export function startVirtuals() {
  if (!env.VIRTUALS_ENABLED) {
    console.log("[virtuals] switched off (VIRTUALS_ENABLED=false)");
    return () => {};
  }

  console.log(
    `[virtuals] on: independent ${env.VIRTUALS_PLAY_SEC}s matches, ${env.VIRTUALS_MARGIN_PCT}% margin`
  );

  return loop("virtuals", 1000, tick);
}














