"use client";
import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { keyOf, useBetslip } from "@/store/betslipStore";
import type { Fixture, Market, Selection } from "@/types";

/** Flashes green/red when odds move. Used by every odds cell in the match tables. */
export default function OddsButton({ f, m, s }: { f: Fixture; m: Market; s: Selection }) {
  const picked = useBetslip((st) => st.items.some((i) => i.key === keyOf(f.id, m.id, s.id)));
  const toggle = useBetslip((st) => st.toggle);
  const prev = useRef(s.odds);
  const [flash, setFlash] = useState<"" | "odds-up" | "odds-down">("");

  useEffect(() => {
    if (s.odds === prev.current) return;
    setFlash(s.odds > prev.current ? "odds-up" : "odds-down");
    prev.current = s.odds;
    const t = setTimeout(() => setFlash(""), 1200);
    return () => clearTimeout(t);
  }, [s.odds]);

  return (
    <button className={`odds-btn ${flash}`} aria-pressed={picked} data-suspended={!!s.suspended}
      aria-label={`${m.name} ${s.label} at ${s.odds.toFixed(2)}`} onClick={() => toggle(f, m, s)}>
      {s.suspended ? <Lock size={13} /> : s.odds.toFixed(2)}
    </button>
  );
}
