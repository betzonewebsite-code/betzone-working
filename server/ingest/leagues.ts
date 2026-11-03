import { env } from "../../src/lib/server/env";
import type { LeagueDef } from "./types";

// Keep these stable keys: they identify existing BETZONE league records.
const ALL: LeagueDef[] = [
  { key: "EPL", sport: "SOCCER", country: "England", name: "Premier League", popular: true, sort: 1, sgo: "EPL", oddsApi: "soccer_epl" },
  { key: "UCL", sport: "SOCCER", country: "Europe", name: "Champions League", popular: true, sort: 2, sgo: "UEFA_CHAMPIONS_LEAGUE", oddsApi: "soccer_uefa_champs_league" },
  { key: "LALIGA", sport: "SOCCER", country: "Spain", name: "La Liga", popular: true, sort: 3, sgo: "LA_LIGA", oddsApi: "soccer_spain_la_liga" },
  { key: "SERIEA", sport: "SOCCER", country: "Italy", name: "Serie A", popular: true, sort: 4, sgo: "IT_SERIE_A", oddsApi: "soccer_italy_serie_a" },
  { key: "BUNDESLIGA", sport: "SOCCER", country: "Germany", name: "Bundesliga", popular: false, sort: 5, sgo: "BUNDESLIGA", oddsApi: "soccer_germany_bundesliga" },
  { key: "LIGUE1", sport: "SOCCER", country: "France", name: "Ligue 1", popular: false, sort: 6, sgo: "FR_LIGUE_1", oddsApi: "soccer_france_ligue_one" },
  { key: "NBA", sport: "BASKETBALL", country: "USA", name: "NBA", popular: true, sort: 7, sgo: "NBA", oddsApi: "basketball_nba" },
];

const enabled = new Set(
  env.SPORTS_LEAGUES.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
);

const fallbackLeagues = ALL.filter((league) => enabled.has(league.key));

/** Active registry used by fixture ingestion and result reconciliation. */
export let LEAGUES: LeagueDef[] = [...fallbackLeagues];

export const leagueByKey = (key: string) =>
  ALL.find((league) => league.key === key) ??
  LEAGUES.find((league) => league.key === key);

export const leagueBySgo = (sgoId: string) =>
  ALL.find((league) => league.sgo?.toUpperCase() === sgoId.toUpperCase()) ??
  LEAGUES.find((league) => league.sgo?.toUpperCase() === sgoId.toUpperCase());

/**
 * Replace the active list after successful provider discovery.
 * Known leagues retain their original keys; configured fallback leagues
 * remain available if the provider omits them temporarily.
 */
export function updateDiscoveredLeagues(discovered: LeagueDef[]): void {
  const merged = new Map<string, LeagueDef>();

  for (const league of fallbackLeagues) {
    merged.set(league.key, league);
  }

  for (const league of discovered) {
    const known = leagueBySgo(league.sgo ?? "");

    if (known) {
      merged.set(known.key, {
        ...known,
        ...league,
        key: known.key,
        sgo: league.sgo ?? known.sgo,
        oddsApi: known.oddsApi,
      });
    } else {
      merged.set(league.key, league);
    }
  }

  LEAGUES = [...merged.values()].sort((a, b) => a.sort - b.sort);
}

