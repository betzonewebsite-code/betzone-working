import { db } from "./db";
import { fixtureInclude, toClientFixture } from "./fixtureDto";

type Goal = { minute: number; side: "h" | "a" };

type Match = {
  i: number;
  fixtureId: string;
  leagueKey?: string;
  home: string;
  away: string;
  homeStrength?: number;
  awayStrength?: number;
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  hs?: number;
  as?: number;
  goals?: Goal[];
};

export async function virtualState() {
  const now = Date.now();

  const [activeRounds, doneRounds] = await Promise.all([
    db.virtualRound.findMany({
      where: { status: { in: ["BETTING", "PLAYING"] } },
      orderBy: { number: "asc" },
    }),
    db.virtualRound.findMany({
      where: { status: "DONE" },
      orderBy: { number: "desc" },
      take: 30,
    }),
  ]);

  const activeMatches = activeRounds.flatMap((round) =>
    (round.matches as Match[]).map((match) => ({ round, match }))
  );

  const fixtureIds = activeMatches.map(({ match }) => match.fixtureId);

  const fixtures = fixtureIds.length
    ? await db.fixture.findMany({
        where: { id: { in: fixtureIds }, source: "virtual" },
        include: fixtureInclude,
      })
    : [];

  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));

  const available = activeMatches.flatMap(({ round, match }) => {
    const fixture = fixtureById.get(match.fixtureId);
    if (!fixture) return [];

    const playing = round.status === "PLAYING";
    const elapsed = playing
      ? Math.max(0, now - round.betsCloseAt.getTime())
      : 0;

    const minute = playing
      ? Math.min(
          90,
          Math.floor(
            (elapsed /
              Math.max(
                1,
                round.endsAt.getTime() - round.betsCloseAt.getTime()
              )) *
              90
          )
        )
      : 0;

    const shownGoals = playing
      ? (match.goals ?? []).filter((goal) => goal.minute <= minute)
      : [];

    return [{
      roundNumber: round.number,
      status: playing ? "PLAYING" : "BETTING",
      seedHash: round.seedHash,
      startedAt: playing ? round.betsCloseAt.toISOString() : null,
      endsAt: playing ? round.endsAt.toISOString() : null,
      minute,
      score: playing
        ? [
            shownGoals.filter((goal) => goal.side === "h").length,
            shownGoals.filter((goal) => goal.side === "a").length,
          ]
        : null,
      goals: shownGoals,
      leagueKey: match.leagueKey ?? fixture.league.externalId,
      homeStrength: match.homeStrength ?? null,
      awayStrength: match.awayStrength ?? null,
      homeWin: match.homeWin ?? null,
      draw: match.draw ?? null,
      awayWin: match.awayWin ?? null,
      fixture: toClientFixture(fixture),
    }];
  });

  const results = doneRounds.flatMap((round) =>
    (round.matches as Match[]).map((match) => ({
      number: round.number,
      seed: round.seed,
      seedHash: round.seedHash,
      leagueKey: match.leagueKey ?? "",
      home: match.home,
      away: match.away,
      hs: match.hs ?? 0,
      as: match.as ?? 0,
    }))
  );

  return {
    enabled: true,
    serverTime: new Date(now).toISOString(),
    fixtures: available,
    results,
  };
}
