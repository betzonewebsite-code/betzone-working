
import type {
  FixtureStatus,
  MarketType,
  Sport,
} from "@prisma/client";

import { fetchSportmonksSnapshot } from "../../sportmonksAdapter";
import type {
  FinalScore,
  LeagueDef,
  NFixture,
  NMarket,
  Provider,
} from "../types";

type Row = Record<string, unknown>;

const KNOWN_LEAGUES: Record<
  string,
  { name: string; country: string }
> = {
  "271": { name: "Superliga", country: "Denmark" },
  "501": { name: "Premiership", country: "Scotland" },
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function leagueId(row: Row): string {
  return String(row.league_id ?? "");
}

function leagueKey(id: string): string {
  return `SPORTMONKS_${id}`;
}

function parseTeams(name: string): [string, string] | null {
  const parts = name.split(/\s+vs\.?\s+/i);

  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    return null;
  }

  return [parts[0].trim(), parts[1].trim()];
}

function marketType(description: string): MarketType | null {
  const value = description.toLowerCase();

  if (
    value.includes("fulltime result") ||
    value.includes("match winner") ||
    value.includes("1x2") ||
    value === "winner"
  ) {
    return "ONE_X_TWO";
  }

  if (
    value.includes("goal line") ||
    value.includes("over/under") ||
    value.includes("total goals") ||
    value.includes("totals")
  ) {
    return "OVER_UNDER";
  }

  if (
    value.includes("handicap") ||
    value.includes("spread")
  ) {
    return "ASIAN_HANDICAP";
  }

  return null;
}

function selectionKey(label: string): string {
  const value = label.toLowerCase().trim();

  if (["home", "1", "1st"].includes(value)) return "home";
  if (["draw", "x"].includes(value)) return "draw";
  if (["away", "2", "2nd"].includes(value)) return "away";

  return value.replace(/\s+/g, "_");
}

function convertMarkets(rows: Row[]): NMarket[] {
  const grouped = new Map<string, NMarket>();

  for (const row of rows) {
    const description =
      text(row.market_description) ||
      text(row.name) ||
      text(row.label);

    const type = marketType(description);
    const label = text(row.label) || text(row.name);
    const odds = Number(row.value);

    if (
      !type ||
      !label ||
      !Number.isFinite(odds) ||
      odds <= 1 ||
      row.stopped === true
    ) {
      continue;
    }

    const lineValue = row.handicap ?? row.total;
    const parsedLine =
      lineValue === null || lineValue === undefined
        ? null
        : Number(lineValue);

    const line =
      parsedLine !== null && Number.isFinite(parsedLine)
        ? parsedLine
        : null;

    const groupKey = `${type}:${line ?? "none"}`;
    let market = grouped.get(groupKey);

    if (!market) {
      market = {
        type,
        line,
        name: description,
        selections: [],
      };

      grouped.set(groupKey, market);
    }

    const key = selectionKey(label);

    if (market.selections.some((item) => item.key === key)) {
      continue;
    }

    market.selections.push({
      key,
      label,
      odds,
      available: true,
    });
  }

  return [...grouped.values()];
}

function discoverLeagueDefinitions(
  fixtures: Row[],
): LeagueDef[] {
  const found = new Map<string, LeagueDef>();

  for (const fixture of fixtures) {
    const id = leagueId(fixture);

    if (!id) continue;

    const known = KNOWN_LEAGUES[id];

    found.set(id, {
      key: leagueKey(id),
      sport: "SOCCER" as Sport,
      country: known?.country ?? "Unknown",
      name: known?.name ?? `Sportmonks League ${id}`,
      popular: false,
      sort: 1000 + Number(id),
    });
  }

  return [...found.values()];
}

export const sportmonks: Provider = {
  name: "sportmonks",

  async discoverLeagues(): Promise<LeagueDef[]> {
    const snapshot = await fetchSportmonksSnapshot();

    if (!snapshot) return [];

    return discoverLeagueDefinitions(snapshot.fixtures);
  },

  async fetchFixtures(
    leagues: LeagueDef[],
    _opts: { live: boolean },
  ): Promise<NFixture[]> {
    const snapshot = await fetchSportmonksSnapshot();

    if (!snapshot) return [];

    const allowedKeys = new Set(leagues.map((league) => league.key));

    const oddsByFixture = new Map<string, Row[]>();

    for (const odd of snapshot.odds) {
      const id = String(odd.fixture_id ?? "");
      if (!id) continue;

      const rows = oddsByFixture.get(id) ?? [];
      rows.push(odd);
      oddsByFixture.set(id, rows);
    }

    const results: NFixture[] = [];

    for (const fixture of snapshot.fixtures) {
      const id = String(fixture.id ?? "");
      const idForLeague = leagueId(fixture);
      const key = leagueKey(idForLeague);
      const name = text(fixture.name);
      const teams = parseTeams(name);
      const kickoff = new Date(
        text(fixture.starting_at).replace(" ", "T") + "Z",
      );

      if (
        !id ||
        !idForLeague ||
        !allowedKeys.has(key) ||
        !teams ||
        !Number.isFinite(kickoff.getTime())
      ) {
        continue;
      }

      results.push({
        source: "sportmonks",
        externalId: id,
        leagueKey: key,
        home: teams[0],
        away: teams[1],
        kickoff,
        status: "SCHEDULED" as FixtureStatus,
        minute: null,
        period: null,
        score: null,
        finalized: false,
        markets: convertMarkets(oddsByFixture.get(id) ?? []),
      });
    }

    return results;
  },

  async fetchFinals(_leagues: LeagueDef[]): Promise<FinalScore[]> {
    // Final-score ingestion remains with the existing results provider.
    return [];
  },
};
