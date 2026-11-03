import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resultFor } from "../../src/lib/server/betting/settlement-calculations";

describe("BETZONE match settlement calculations", () => {
  it("settles home win, away win and draw correctly", () => {
    assert.equal(resultFor("ONE_X_TWO", "1", null, 2, 1), "WON");
    assert.equal(resultFor("ONE_X_TWO", "2", null, 1, 2), "WON");
    assert.equal(resultFor("ONE_X_TWO", "X", null, 1, 1), "WON");
    assert.equal(resultFor("ONE_X_TWO", "1", null, 0, 2), "LOST");
  });

  it("settles double chance selections correctly", () => {
    assert.equal(resultFor("DOUBLE_CHANCE", "1x", null, 1, 1), "WON");
    assert.equal(resultFor("DOUBLE_CHANCE", "12", null, 2, 1), "WON");
    assert.equal(resultFor("DOUBLE_CHANCE", "x2", null, 0, 1), "WON");
    assert.equal(resultFor("DOUBLE_CHANCE", "1x", null, 0, 2), "LOST");
  });

  it("settles both teams to score correctly", () => {
    assert.equal(resultFor("BTTS", "gg", null, 1, 1), "WON");
    assert.equal(resultFor("BTTS", "ng", null, 2, 0), "WON");
    assert.equal(resultFor("BTTS", "gg", null, 0, 1), "LOST");
  });

  it("settles whole-number over and under lines", () => {
    assert.equal(resultFor("OVER_UNDER", "over", 2, 2, 1), "WON");
    assert.equal(resultFor("OVER_UNDER", "under", 2, 1, 1), "VOID");
    assert.equal(resultFor("OVER_UNDER", "under", 2, 1, 0), "WON");
  });

  it("settles quarter-goal totals correctly", () => {
    assert.equal(resultFor("OVER_UNDER", "over", 2.25, 2, 1), "WON");
    assert.equal(resultFor("OVER_UNDER", "under", 2.25, 2, 0), "HALF_WON");
    assert.equal(resultFor("OVER_UNDER", "under", 2.75, 2, 1), "HALF_LOST");
  });

  it("settles Asian handicaps correctly", () => {
    assert.equal(resultFor("ASIAN_HANDICAP", "h", -1, 2, 0), "WON");
    assert.equal(resultFor("ASIAN_HANDICAP", "h", -1, 1, 0), "VOID");
    assert.equal(resultFor("ASIAN_HANDICAP", "h", -0.25, 0, 0), "HALF_LOST");
  });

  it("returns void for a missing line or unsupported market", () => {
    assert.equal(resultFor("OVER_UNDER", "over", null, 2, 1), "VOID");
    assert.equal(resultFor("NEXT_GOAL", "home", null, 2, 1), "VOID");
  });

  it("handles a zero market line instead of treating it as missing", () => {
    assert.equal(resultFor("OVER_UNDER", "over", 0, 0, 0), "VOID");
    assert.equal(resultFor("OVER_UNDER", "over", 0, 1, 0), "WON");
  });
});

