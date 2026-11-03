import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { D } from "../../src/lib/server/money";
import { combinations, product, flexiMax } from "../../src/lib/server/betting/odds";

describe("BETZONE betting calculations", () => {
  it("generates every unique 2-of-3 combination", () => {
    const result = combinations(["A", "B", "C"], 2);
    assert.deepEqual(result, [["A", "B"], ["A", "C"], ["B", "C"]]);
  });

  it("calculates the product of decimal odds", () => {
    const result = product([D("2.00"), D("3.00"), D("1.50")]);
    assert.equal(result.toFixed(2), "9.00");
  });

  it("calculates a Flexi 2-of-3 maximum payout", () => {
    const result = flexiMax(
      [D("2.00"), D("3.00"), D("4.00")],
      D("30.00"),
      1
    );
    assert.equal(result.toFixed(2), "260.00");
  });

  it("splits a System 2/3 stake equally across three doubles", () => {
    const odds = [D("2.00"), D("3.00"), D("4.00")];
    const stake = D("30.00");
    const combos = combinations(odds, 2);
    const unitStake = stake.div(combos.length);

    assert.equal(combos.length, 3);
    assert.equal(unitStake.toFixed(2), "10.00");

    const payout = combos.reduce(
      (sum, combo) => sum.plus(unitStake.mul(product(combo))),
      D(0)
    );

    assert.equal(payout.toFixed(2), "260.00");
  });
});

