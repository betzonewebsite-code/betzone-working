import type { MarketType, SelectionResult } from "@prisma/client";

export type SettlementResult = Exclude<SelectionResult, "PENDING">;

const sgn = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);

const parts = (line: number) =>
  Math.abs((line * 4) % 2) === 1
    ? [line - 0.25, line + 0.25]
    : [line];

const fromAvg = (average: number): SettlementResult =>
  average >= 1 ? "WON" :
  average > 0 ? "HALF_WON" :
  average === 0 ? "VOID" :
  average > -1 ? "HALF_LOST" : "LOST";

const lineRes = (margins: number[]): SettlementResult =>
  fromAvg(margins.reduce((sum, value) => sum + sgn(value), 0) / margins.length);

const outcome = (home: number, away: number) =>
  home > away ? "1" : home < away ? "2" : "X";

const totalResult = (key: string, line: number, total: number) =>
  lineRes(parts(line).map((value) =>
    key === "over" ? total - value : value - total
  ));

export function resultFor(
  type: MarketType,
  key: string,
  line: number | null,
  homeScore: number,
  awayScore: number,
  marketName = "",
  halfTimeHome?: number,
  halfTimeAway?: number
): SettlementResult {
  const win = (correct: boolean): SettlementResult => correct ? "WON" : "LOST";
  const finalOutcome = outcome(homeScore, awayScore);

  switch (type) {
    case "ONE_X_TWO":
      return win(key === finalOutcome);

    case "DOUBLE_CHANCE":
      return win(
        key === "1x" ? homeScore >= awayScore :
        key === "12" ? homeScore !== awayScore :
        key === "x2" ? homeScore <= awayScore : false
      );

    case "MONEYLINE":
      if (homeScore === awayScore) return "VOID";
      return win(key === "h" ? homeScore > awayScore : key === "a" && awayScore > homeScore);

    case "BTTS": {
      const both = homeScore > 0 && awayScore > 0;
      return win(key === "gg" ? both : key === "ng" && !both);
    }

    case "OVER_UNDER":
      if (line === null || (key !== "over" && key !== "under")) return "VOID";
      return totalResult(key, line, homeScore + awayScore);

    case "TEAM_TOTALS": {
      if (line === null || (key !== "over" && key !== "under")) return "VOID";
      const isHome = marketName.toLowerCase().startsWith("home");
      const teamGoals = isHome ? homeScore : awayScore;
      return totalResult(key, line, teamGoals);
    }

    case "ASIAN_HANDICAP":
      if (line === null || (key !== "h" && key !== "a")) return "VOID";
      return key === "h"
        ? lineRes(parts(line).map((value) => homeScore + value - awayScore))
        : lineRes(parts(-line).map((value) => awayScore + value - homeScore));

    case "CORRECT_SCORE": {
      if (key === "other") return win(
        !(homeScore <= 5 && awayScore <= 5)
      );
      const match = /^(\d+)-(\d+)$/.exec(key);
      if (!match) return "VOID";
      return win(homeScore === Number(match[1]) && awayScore === Number(match[2]));
    }

    case "HALF_TIME_RESULT":
      if (halfTimeHome === undefined || halfTimeAway === undefined) return "VOID";
      return win(key === outcome(halfTimeHome, halfTimeAway));

    case "HALF_TIME_FULL_TIME": {
      if (halfTimeHome === undefined || halfTimeAway === undefined) return "VOID";
      const expected = `${outcome(halfTimeHome, halfTimeAway)}/${finalOutcome}`;
      return win(key === expected);
    }

    case "WIN_MARGIN": {
      const difference = homeScore - awayScore;
      const margin = Math.abs(difference);
      if (key === "h1") return win(difference > 0 && margin === 1);
      if (key === "h2") return win(difference > 0 && margin === 2);
      if (key === "h3") return win(difference > 0 && margin >= 3);
      if (key === "a1") return win(difference < 0 && margin === 1);
      if (key === "a2") return win(difference < 0 && margin === 2);
      if (key === "a3") return win(difference < 0 && margin >= 3);
      return "VOID";
    }

    case "NEXT_GOAL":
      return "VOID";

    default:
      return "VOID";
  }
}