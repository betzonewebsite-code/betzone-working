export type MarketCategoryId =
  | "all"
  | "main"
  | "goals"
  | "half"
  | "corners"
  | "bookings"
  | "specials"
  | "players";

export const MARKET_CATEGORIES: {
  id: MarketCategoryId;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "main", label: "Main" },
  { id: "goals", label: "Goals" },
  { id: "half", label: "Half" },
  { id: "corners", label: "Corners" },
  { id: "bookings", label: "Bookings" },
  { id: "specials", label: "Specials" },
  { id: "players", label: "Players" },
];

export const FOOTBALL_MARKET_CATALOG = {
  main: [
    "3 Way", "Match Result", "Double Chance", "Draw No Bet",
    "Asian Handicap", "European Handicap", "Both Teams to Score",
    "Correct Score",
  ],
  goals: [
    "Over/Under", "Total Goals", "Team Total Goals", "Exact Goals",
    "Goal Range", "Odd/Even Goals", "First Goal", "Last Goal",
    "Next Goals", "Winning Margin",
  ],
  half: [
    "Half Time Result", "First Half Result", "Second Half Result",
    "Half Time/Full Time", "First Half Over/Under",
    "Second Half Over/Under", "First Half Both Teams to Score",
    "Second Half Both Teams to Score",
  ],
  corners: [
    "Total Corners", "Corner Handicap", "Corner Over/Under",
    "First Half Corners", "Second Half Corners", "Home Team Corners",
    "Away Team Corners", "First Corner", "Race to Corners",
  ],
  bookings: [
    "Total Cards", "Yellow Cards", "Red Card", "Booking Points",
    "First Half Cards", "Second Half Cards", "Home Team Cards",
    "Away Team Cards",
  ],
  specials: [
    "Penalty Awarded", "Own Goal", "Clean Sheet", "Win to Nil",
    "Team to Score", "Highest Scoring Half", "Exact Score",
  ],
  players: [
    "First Goalscorer", "Anytime Goalscorer", "Last Goalscorer",
    "Player to Score", "Player Shots", "Player Shots on Target",
    "Player Assists", "Player to Receive a Card",
  ],
} as const;

export function getMarketCategory(
  marketName: string,
): Exclude<MarketCategoryId, "all"> {
  const name = marketName.toLowerCase();

  if (/half|1st half|2nd half|first half|second half|half-time/.test(name)) {
    return "half";
  }

  if (/corner/.test(name)) return "corners";

  if (/card|booking|yellow|red card/.test(name)) return "bookings";

  if (/player|goalscorer|shots on target|assists/.test(name)) {
    return "players";
  }

  if (/goal|over\s*\/\s*under|over under|total goals|odd\s*\/\s*even/.test(name)) {
    return "goals";
  }

  if (/penalty|own goal|clean sheet|win to nil|highest scoring/.test(name)) {
    return "specials";
  }

  return "main";
}
