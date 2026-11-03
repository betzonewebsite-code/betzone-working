export type InstantFootballLeague = {
  id: string;
  name: string;
  sportId: string;
  route: string;
};

export type InstantFootballSelection = {
  id: string;
  name: string;
  odds: number | null;
  suspended: boolean;
};

export type InstantFootballMarket = {
  id: string;
  name: string;
  selections: InstantFootballSelection[];
};

export type InstantFootballMatch = {
  id: string;
  eventCode: string;
  leagueId: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string | null;
  countdown: number | null;
  status: "upcoming" | "countdown" | "live" | "finished" | "suspended";
  markets: InstantFootballMarket[];
};

export const INSTANT_FOOTBALL_LEAGUES: InstantFootballLeague[] = [
  {
    id: "african-cup",
    name: "Instant African Cup",
    sportId: "sr:sport:1-3-1",
    route: "/instant-virtuals/quickgame?sportId=sr%3Asport%3A1-3-1",
  },
  {
    id: "world-cup",
    name: "Instant World Cup",
    sportId: "sr:sport:1-3-2",
    route: "/instant-virtuals/quickgame?sportId=sr%3Asport%3A1-3-2",
  },
];

export const DEFAULT_INSTANT_FOOTBALL_LEAGUE =
  INSTANT_FOOTBALL_LEAGUES[0].id;

export function getInstantFootballLeague(leagueId: string) {
  return INSTANT_FOOTBALL_LEAGUES.find(
    (league) => league.id === leagueId,
  );
}

export function getInstantFootballMatches(
  matches: InstantFootballMatch[],
  leagueId: string,
) {
  return matches.filter(
    (match) => match.leagueId === leagueId,
  );
}

export function getAvailableInstantFootballMarkets(
  match: InstantFootballMatch,
) {
  return match.markets.filter(
    (market) => market.selections.length > 0,
  );
}

export function isInstantFootballSelectionAvailable(
  selection: InstantFootballSelection,
) {
  return (
    !selection.suspended &&
    selection.odds !== null &&
    Number.isFinite(selection.odds) &&
    selection.odds > 1
  );
}