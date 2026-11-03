"use client";
import { create } from "zustand";
import type { Fixture } from "@/types";

export type TimeFilter = "today" | "3h" | "8h" | "24h" | "upcoming";
export const TIME_TABS: { id: TimeFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "3h", label: "3 Hours" },
  { id: "8h", label: "8 Hours" },
  { id: "24h", label: "24 Hours" },
  { id: "upcoming", label: "Upcoming" },
];

const HOUR = 3_600_000;
/** Live matches always pass. "Upcoming" means no time limit. */
export function inWindow(f: Fixture, t: TimeFilter, now = Date.now()) {
  if (f.live) return true;
  const k = new Date(f.kickoff).getTime();
  if (t === "today") return new Date(k).toDateString() === new Date(now).toDateString();
  if (t === "3h") return k - now <= 3 * HOUR;
  if (t === "8h") return k - now <= 8 * HOUR;
  if (t === "24h") return k - now <= 24 * HOUR;
  return true;
}

type State = {
  sport: string; league: string | null; time: TimeFilter; query: string;
  setSport: (s: string) => void;
  setLeague: (league: string | null, sport?: string) => void;
  setTime: (t: TimeFilter) => void;
  setQuery: (q: string) => void;
  reset: () => void;
};

export const useFilters = create<State>((set) => ({
  sport: "soccer", league: null, time: "upcoming", query: "",
  setSport: (sport) => set({ sport, league: null }),
  setLeague: (league, sport) => set((st) => ({ league, sport: sport ?? st.sport })),
  setTime: (time) => set({ time }),
  setQuery: (query) => set({ query }),
  reset: () => set({ league: null, time: "upcoming", query: "" }),
}));
