import { db } from "@/lib/server/db";
import { handler, json } from "@/lib/server/http";

type HistoryMatch = {
  leagueKey?: string;
  home?: string;
  away?: string;
  hs?: number;
  as?: number;
};

export const GET = handler(async (req) => {
  const url = new URL(req.url);

  const requestedLeague = url.searchParams.get("league");
  const leagueKey =
    requestedLeague === "VIRTUAL-PL" ||
    requestedLeague === "VIRTUAL-CHAMPIONSHIP"
      ? requestedLeague
      : null;

  const seasonParam = Number(url.searchParams.get("season"));
  const matchdayParam = Number(url.searchParams.get("matchday"));
  const cursorParam = Number(url.searchParams.get("cursor"));
  const limitParam = Number(url.searchParams.get("limit"));

  const season =
    Number.isInteger(seasonParam) && seasonParam > 0
      ? seasonParam
      : null;

  const matchday =
    Number.isInteger(matchdayParam) && matchdayParam > 0
      ? matchdayParam
      : null;

  const cursor =
    Number.isInteger(cursorParam) && cursorParam > 0
      ? cursorParam
      : null;

  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, 50)
      : 20;

  const where = {
    status: "DONE" as const,
    season: { not: null },
    ...(season !== null ? { season } : {}),
    ...(matchday !== null ? { matchday } : {}),
    ...(cursor !== null ? { number: { lt: cursor } } : {}),
    ...(leagueKey
      ? {
          matches: {
            array_contains: [{ leagueKey }],
          },
        }
      : {}),
  };

  const rounds = await db.virtualRound.findMany({
    where,
    orderBy: { number: "desc" },
    take: limit + 1,
    select: {
      number: true,
      season: true,
      matchday: true,
      seed: true,
      seedHash: true,
      matches: true,
    },
  });

  const hasMore = rounds.length > limit;
  const page = rounds.slice(0, limit);

  const results = page.flatMap((round) => {
    if (!Array.isArray(round.matches)) return [];

    return (round.matches as HistoryMatch[]).flatMap((match) => {
      if (
        !match ||
        typeof match.home !== "string" ||
        typeof match.away !== "string" ||
        (leagueKey && match.leagueKey !== leagueKey)
      ) {
        return [];
      }

      return [{
        number: round.number,
        season: round.season,
        matchday: round.matchday,
        seed: round.seed,
        seedHash: round.seedHash,
        leagueKey: match.leagueKey ?? "",
        home: match.home,
        away: match.away,
        hs: Number.isFinite(match.hs) ? match.hs : 0,
        as: Number.isFinite(match.as) ? match.as : 0,
      }];
    });
  });

  return json({
    results,
    limit,
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]?.number ?? null : null,
  });
});
