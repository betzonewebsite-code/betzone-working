"use client";
import { useMemo } from "react";
import type { Fixture } from "@/types";

/** Adds the final `suspended` flag: a selection is locked on its own, or the whole match is (goal / VAR check). */
export function useLiveFixture(f: Fixture): Fixture {
  const closed = f.bettingOpen === false;
  return useMemo(() => ({
    ...f,
    markets: f.markets.map((m) => ({ ...m, selections: m.selections.map((s) => ({ ...s, suspended: !!s.locked || closed })) })),
  }), [f, closed]);
}
