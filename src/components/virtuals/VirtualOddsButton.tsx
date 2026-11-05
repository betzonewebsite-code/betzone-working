"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { Fixture, Market, Selection } from "@/types";

export default function VirtualOddsButton({
  f,
  m,
  s,
  picked,
  onToggle,
}: {
  f: Fixture;
  m: Market;
  s: Selection;
  picked: boolean;
  onToggle: (f: Fixture, m: Market, s: Selection) => void;
}) {
  const previousOdds = useRef(s.odds);
  const [flash, setFlash] = useState<"" | "odds-up" | "odds-down">("");

  useEffect(() => {
    if (previousOdds.current === s.odds) return;

    setFlash(s.odds > previousOdds.current ? "odds-up" : "odds-down");
    previousOdds.current = s.odds;

    const timer = window.setTimeout(() => setFlash(""), 1200);
    return () => window.clearTimeout(timer);
  }, [s.odds]);

  return (
    <button
      type="button"
      className={`odds-btn ${flash}`}
      aria-pressed={picked}
      data-suspended={!!s.suspended}
      aria-label={`${m.name} ${s.label} at ${s.odds.toFixed(2)}`}
      disabled={!!s.suspended}
      onClick={() => onToggle(f, m, s)}
    >
      {s.suspended ? <Lock size={13} /> : s.odds.toFixed(2)}
    </button>
  );
}
