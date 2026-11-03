import type { Market, Selection } from "@/types";

const RESULT_ORDER = ["home", "draw", "away"];

function resultRank(selection: Selection): number {
  const values = [selection.label, selection.id]
    .map((value) => value.trim().toLowerCase());

  const index = RESULT_ORDER.findIndex((result) =>
    values.some((value) =>
      value === result ||
      value.startsWith(`${result} `) ||
      value.startsWith(`${result}_`) ||
      value.startsWith(`${result}-`)
    )
  );

  return index === -1 ? RESULT_ORDER.length : index;
}

export function isOverUnderMarket(market: Market): boolean {
  return market.id.startsWith("ou_");
}

export function orderMarketSelections(market: Market): Selection[] {
  if (market.id === "1x2") {
    return market.selections
      .map((selection, index) => ({ selection, index }))
      .sort((a, b) =>
        resultRank(a.selection) - resultRank(b.selection) ||
        a.index - b.index
      )
      .map(({ selection }) => selection);
  }

  if (isOverUnderMarket(market)) {
    return market.selections
      .map((selection, index) => ({ selection, index }))
      .sort((a, b) => {
        const rank = (selection: Selection) => {
          const key = selection.id.trim().toLowerCase();
          const label = selection.label.trim().toLowerCase();
          if (key === "over" || label.startsWith("over ")) return 0;
          if (key === "under" || label.startsWith("under ")) return 1;
          return 2;
        };
        return rank(a.selection) - rank(b.selection) || a.index - b.index;
      })
      .map(({ selection }) => selection);
  }

  return market.selections;
}

export function orderMarketsByLine(markets: Market[]): Market[] {
  return [...markets].sort((a, b) => {
    const aGoals = isOverUnderMarket(a);
    const bGoals = isOverUnderMarket(b);

    if (aGoals !== bGoals) return aGoals ? -1 : 1;
    if (!aGoals || !bGoals) return 0;

    const aLine = a.line ?? Number(a.lineKey ?? a.id.slice(3));
    const bLine = b.line ?? Number(b.lineKey ?? b.id.slice(3));

    if (Number.isFinite(aLine) && Number.isFinite(bLine)) {
      return aLine - bLine;
    }
    return a.id.localeCompare(b.id);
  });
}
