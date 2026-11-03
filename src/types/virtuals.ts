import type { Market, Selection } from "./index";

export type MatchMarket = Market;
export type MatchSelection = Selection;

export type VirtualSport =
  | "football"
  | "basketball"
  | "dog-racing";

export type VirtualMatchStatus =
  | "upcoming"
  | "countdown"
  | "live"
  | "finished"
  | "suspended";

export type VirtualMatch = {
  id: string;
  eventCode: string;
  sport: VirtualSport;
  competitionId: string;
  competitionName: string;
  roundId: string;
  roundNumber: number;
  homeCompetitor: string;
  awayCompetitor: string;
  scheduledAt: string;
  startTime: string | null;
  status: VirtualMatchStatus;
  markets: MatchMarket[];
  result?: {
    homeScore: number;
    awayScore: number;
    winnerId?: string;
  };
  provider: string;
  lastUpdatedAt: string;
};

export type VirtualCompetition = {
  id: string;
  name: string;
  sport: VirtualSport;
  providerCompetitionId: string;
  enabled: boolean;
};

export type VirtualRound = {
  id: string;
  competitionId: string;
  roundNumber: number;
  matches: VirtualMatch[];
};
