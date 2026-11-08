import type { FixtureStatus, MarketType, Sport } from "@prisma/client";

export type LeagueDef = {
key: string;
sport: Sport;
country: string;
name: string;
popular: boolean;
sort: number;
sgo?: string;
oddsApi?: string;
};

export type NSelection = {
key: string;
label: string;
odds: number;
available: boolean;
};

export type NMarket = {
type: MarketType;
line: number | null;
name: string;
selections: NSelection[];
};

export type NFixture = {
source: string;
externalId: string;
leagueKey: string;
home: string;
away: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
kickoff: Date;
status: FixtureStatus;
minute: number | null;
period: string | null;
score: [number, number] | null;
finalized: boolean;
markets: NMarket[];
};

export type FinalScore = {
source: string;
externalId: string;
leagueKey: string;
home: string;
away: string;
kickoff: Date;
score: [number, number];
};

export interface Provider {
name: string;

/** Discover leagues supported by this provider when available. */
discoverLeagues?(): Promise<LeagueDef[]>;

/** Fetch live fixtures or upcoming fixtures with odds. */
fetchFixtures(
leagues: LeagueDef[],
opts: { live: boolean }
): Promise<NFixture[]>;

/** Fetch final scores for result verification before settlement. */
fetchFinals(leagues: LeagueDef[]): Promise<FinalScore[]>;
}