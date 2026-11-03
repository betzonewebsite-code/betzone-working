export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const totalOdds = (odds: number[]) => odds.reduce((a, o) => a * o, 1);

// Super Bonus: % added to winnings by number of legs with odds >= minOdds. Tune freely.
const BONUS_TABLE: Record<number, number> = { 3: 3, 4: 5, 5: 8, 6: 12, 7: 15, 8: 20, 9: 25, 10: 30 };
export const superBonusPct = (odds: number[], minOdds = 1.2) => {
  const q = odds.filter((o) => o >= minOdds).length;
  return q < 3 ? 0 : BONUS_TABLE[Math.min(q, 10)];
};

export function multiple(odds: number[], stake: number) {
  const total = totalOdds(odds);
  const winnings = stake * total - stake;
  const pct = superBonusPct(odds);
  const bonus = winnings * (pct / 100);
  return { totalOdds: round2(total), bonusPct: pct, bonus: round2(bonus), payout: round2(stake * total + bonus) };
}

export const single = (odds: number, stake: number) => round2(odds * stake);

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...rest] = arr;
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
}

/**
 * Flexi (Cut 1 / Cut 2): stake is split equally across every accumulator of size (n - cut).
 * All legs win     -> every combo pays (max payout).
 * <= cut legs lose -> the surviving combo(s) still pay (min payout shown is the worst case).
 * Needs at least 2 legs per combo, so n - cut >= 2.
 */
export function flexi(odds: number[], stake: number, cut: 1 | 2) {
  const size = odds.length - cut;
  if (size < 2) return null;
  const combos = combinations(odds, size);
  const unit = stake / combos.length;
  const prods = combos.map(totalOdds);
  return {
    combos: combos.length,
    unitStake: round2(unit),
    maxPayout: round2(prods.reduce((s, p) => s + unit * p, 0)),
    minPayout: round2(unit * Math.min(...prods)),
  };
}


/**
 * System bets: split the total stake equally across every combination
 * of the selected size. For example, 3/4 creates four separate 3-leg bets.
 */
export function systemBet(odds: number[], stake: number, size: number) {
  if (
    !Number.isInteger(size) ||
    size < 2 ||
    size >= odds.length ||
    odds.length < 3 ||
    stake <= 0
  ) return null;

  const combos = combinations(odds, size);
  if (!combos.length) return null;

  const unitStake = stake / combos.length;
  const payouts = combos.map((combo) => unitStake * totalOdds(combo));

  return {
    size,
    combos: combos.length,
    unitStake: round2(unitStake),
    totalStake: round2(stake),
    minPayout: round2(Math.min(...payouts)),
    maxPayout: round2(payouts.reduce((sum, payout) => sum + payout, 0)),
  };
}