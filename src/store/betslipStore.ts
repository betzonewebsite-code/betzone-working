"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { Fixture, LoadedLeg, Market, Selection, SlipItem } from "@/types";
import type { FixtureLock, SlipUpdate } from "./fixtureStore";

type Tab = "single" | "multiple" | "system";
type State = {
  items: SlipItem[]; tab: Tab; stake: number; singleStakes: Record<string, number>;
  flexi: 0 | 1 | 2; systemSize: number; acceptChanges: boolean; bookedCode: string | null; open: boolean;
  toggle: (f: Fixture, m: Market, s: Selection) => void;
  remove: (key: string) => void; clear: () => void;
  setTab: (t: Tab) => void; setStake: (n: number) => void;
  setSingleStake: (key: string, n: number) => void; setFlexi: (c: 0 | 1 | 2) => void; setSystemSize: (n: number) => void;
  setAccept: (v: boolean) => void; setOpen: (o: boolean) => void;
  applyOdds: (updates: SlipUpdate[]) => void;
  applyLocks: (locks: FixtureLock[]) => void;
  setOdds: (changes: { oddsId: string; odds: number }[]) => void;
  book: () => Promise<string>;
  loadCode: (code: string) => Promise<{ ok: boolean; error?: string; warnings: string[] }>;
};

export const keyOf = (fId: string, mId: string, sId: string) => `${fId}:${mId}:${sId}`;
const lock = (i: SlipItem): SlipItem => ({ ...i, suspended: !!i.selLocked || !!i.fixtureClosed });

export const useBetslip = create<State>()(
  persist(
    (set, get) => ({
      items: [], tab: "multiple", stake: 10, singleStakes: {}, flexi: 0, systemSize: 2, acceptChanges: false, bookedCode: null, open: false,

      // Tapping a picked odd removes it. One pick per match: a new pick on the same match replaces the old one.
      toggle: (f, m, s) => {
        const key = keyOf(f.id, m.id, s.id);
        const { items } = get();
        if (items.some((i) => i.key === key)) return set({ items: items.filter((i) => i.key !== key), bookedCode: null });
        const item = lock({
          key, oddsId: s.dbId, fixtureId: f.id, marketId: m.id, selectionId: s.id, match: `${f.home} v ${f.away}`,
          marketName: m.name, pick: s.label, pickedOdds: s.odds, odds: s.odds, selLocked: !!s.locked, fixtureClosed: f.bettingOpen === false, live: f.live,
        });
        set({ items: [...items.filter((i) => i.fixtureId !== f.id), item], bookedCode: null });
      },
      remove: (key) => set((st) => ({ items: st.items.filter((i) => i.key !== key), bookedCode: null })),
      clear: () => set({ items: [], bookedCode: null, flexi: 0, singleStakes: {} }),
      setTab: (tab) => set({ tab }),
      setStake: (n) => set({ stake: Math.max(0, n) }),
      setSingleStake: (key, n) => set((st) => ({ singleStakes: { ...st.singleStakes, [key]: Math.max(0, n) } })),
      setFlexi: (flexi) => set({ flexi }),
      setSystemSize: (systemSize) => set({ systemSize: Math.max(2, Math.min(10, Math.floor(systemSize))) }),
      setAccept: (acceptChanges) => set({ acceptChanges }),
      setOpen: (open) => set({ open }),

      applyOdds: (updates) => {
        if (!updates.length) return;
        const m = new Map(updates.map((u) => [u.key, u]));
        set((st) => ({ items: st.items.map((i) => { const u = m.get(i.key); return u ? lock({ ...i, odds: u.odds, selLocked: u.locked }) : i; }) }));
      },
      applyLocks: (locks) => {
        if (!locks.length) return;
        const m = new Map(locks.map((l) => [l.fixtureId, !l.open]));
        set((st) => ({ items: st.items.map((i) => (m.has(i.fixtureId) ? lock({ ...i, fixtureClosed: m.get(i.fixtureId) }) : i)) }));
      },
      setOdds: (changes) => {
        const m = new Map(changes.map((c) => [c.oddsId, c.odds]));
        set((st) => ({ items: st.items.map((i) => (m.has(i.oddsId) ? { ...i, odds: m.get(i.oddsId)! } : i)) }));
      },

      book: async () => {
        const r = await api("/api/booking", { body: { oddsIds: get().items.map((i) => i.oddsId) } });
        if (!r.ok) throw new Error(r.data.error ?? "Booking failed");
        set({ bookedCode: r.data.code });
        return r.data.code as string;
      },
      loadCode: async (raw) => {
        const r = await api(`/api/booking/${encodeURIComponent(raw.trim())}`);
        if (!r.ok) return { ok: false, error: r.data.error ?? "Could not load code.", warnings: [] };
        const legs = r.data.legs as LoadedLeg[];
        const warnings = legs.filter((l) => l.status !== "ok").map((l) => (l.status === "unavailable" ? "a selection is gone" : `${l.match}: locked`));
        const usable = legs.filter((l) => l.status !== "unavailable").map(({ status, ...i }) => lock({ ...i, selLocked: i.suspended, fixtureClosed: false } as SlipItem));
        if (!usable.length) return { ok: false, error: "None of these selections are available any more.", warnings };
        set({ items: usable, bookedCode: r.data.code, flexi: 0, open: true });
        return { ok: true, warnings };
      },
    }),
    { name: "betzone-slip-v2", partialize: (s) => ({ items: s.items, tab: s.tab, stake: s.stake, flexi: s.flexi, systemSize: s.systemSize }) }
  )
);
