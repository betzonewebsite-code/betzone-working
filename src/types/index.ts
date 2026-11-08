export type Selection = { id: string; dbId: string; label: string; odds: number; previous?: number | null; locked?: boolean; suspended?: boolean };
export type Market = { id: string; dbId: string; name: string; line?: number | null; lineKey?: string; selections: Selection[] };
export type Fixture = {
  id: string; sport: string; country: string; league: string; leagueKey?: string; home: string; away: string; homeLogo?: string | null; awayLogo?: string | null;
  kickoff: string; live: boolean; status?: string; minute?: number | null; period?: string | null;
  score?: [number, number]; bettingOpen?: boolean; marketCount: number; markets: Market[];
};
export type SlipItem = {
  key: string;                // fixtureId:marketId:selectionKey, used by the UI
  oddsId: string;             // database id of the selection, what the server bets on
  fixtureId: string; marketId: string; selectionId: string;
  match: string; marketName: string; pick: string;
  pickedOdds: number;         // odds when added
  odds: number;               // latest odds
  selLocked?: boolean; fixtureClosed?: boolean; suspended?: boolean; live?: boolean;
};
export type LoadedLeg = SlipItem & { status: "ok" | "suspended" | "unavailable" };

