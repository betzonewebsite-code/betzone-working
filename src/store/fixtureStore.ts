"use client";
import { create } from "zustand";
import { api } from "@/lib/api";
import type { Fixture } from "@/types";

export type OddsChange = { marketId: string; key: string; odds: number; previous: number | null; status: "OPEN" | "SUSPENDED" };
export type Change = { fixtureId: string; status?: string; minute?: number | null; score?: [number, number]; bettingOpen?: boolean; reason?: string; odds: OddsChange[] };
export type SlipUpdate = { key: string; odds: number; locked: boolean };
export type FixtureLock = { fixtureId: string; open: boolean };

type State = {
  fixtures: Fixture[]; loaded: boolean; connected: boolean;
  load: () => Promise<void>;
  upsert: (f: Fixture) => void;
  setConnected: (c: boolean) => void;
  apply: (changes: Change[]) => { updates: SlipUpdate[]; locks: FixtureLock[]; unknown: boolean };
};

export const useFixtureStore = create<State>((set, get) => ({
  fixtures: [], loaded: false, connected: false,
  load: async () => {
    const r = await api("/api/fixtures?when=all&limit=200");
    if (r.ok) set({ fixtures: r.data.fixtures as Fixture[], loaded: true });
  },
  upsert: (f) => set((s) => ({ fixtures: s.fixtures.some((x) => x.id === f.id) ? s.fixtures.map((x) => (x.id === f.id ? f : x)) : [...s.fixtures, f] })),
  setConnected: (connected) => set({ connected }),

  apply: (changes) => {
    const updates: SlipUpdate[] = [], locks: FixtureLock[] = [];
    let unknown = false;
    const byId = new Map(get().fixtures.map((f) => [f.id, f]));
    for (const c of changes) {
      const f = byId.get(c.fixtureId);
      if (!f) { unknown = true; continue; }
      const next: Fixture = { ...f };
      if (c.status) { next.status = c.status; next.live = c.status === "LIVE" || c.status === "HALFTIME"; }
      if (c.minute !== undefined) next.minute = c.minute;
      if (c.score) next.score = c.score;
      if (c.bettingOpen !== undefined) { next.bettingOpen = c.bettingOpen; locks.push({ fixtureId: f.id, open: c.bettingOpen }); }
      if (c.odds.length) {
        if (c.odds.some((o) => !f.markets.some((m) => m.dbId === o.marketId))) unknown = true;   // a market we have not seen yet: reload
        next.markets = f.markets.map((m) => {
          const mine = c.odds.filter((o) => o.marketId === m.dbId);
          if (!mine.length) return m;
          return { ...m, selections: m.selections.map((s) => {
            const o = mine.find((x) => x.key === s.id);
            if (!o) return s;
            const locked = o.status !== "OPEN";
            updates.push({ key: `${f.id}:${m.id}:${s.id}`, odds: o.odds, locked });
            return { ...s, odds: o.odds, previous: o.previous, locked };
          }) };
        });
      }
      byId.set(f.id, next);
    }
    set({ fixtures: [...byId.values()] });
    return { updates, locks, unknown };
  },
}));
