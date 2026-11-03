import { D, type Dec } from "../money";

const BONUS: Record<number, number> = { 3: 3, 4: 5, 5: 8, 6: 12, 7: 15, 8: 20, 9: 25, 10: 30 };   // Super Bonus %, by number of legs at odds >= 1.20. Set your own.
export const bonusPctFor = (odds: Dec[]) => { const q = odds.filter((o) => o.gte(1.2)).length; return q < 3 ? 0 : BONUS[Math.min(q, 10)]; };
export const product = (xs: Dec[]) => xs.reduce((a, b) => a.mul(b), D(1));

export function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...rest] = arr;
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
}

/** Flexi: stake split equally over every accumulator of size (n - cut). Returns the payout if everything wins. */
export function flexiMax(odds: Dec[], stake: Dec, cut: number): Dec {
  const cs = combinations(odds, odds.length - cut);
  const unit = stake.div(cs.length);
  return cs.reduce((s, c) => s.plus(unit.mul(product(c))), D(0));
}
