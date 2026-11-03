"use client";
import Link from "next/link";
import { useBetslip } from "@/store/betslipStore";
import { useFilters } from "@/store/filterStore";

export default function QuickActions() {
  const setOpen = useBetslip((s) => s.setOpen);
  const { setSport, setTime } = useFilters();
  const pill = "shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm";
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto" aria-label="Quick actions">
      <Link href="/live" className={pill}>Live</Link>
      <Link href="/" className={pill} onClick={() => { setSport("soccer"); setTime("today"); }}>Today&apos;s Football</Link>
      <button className={pill} onClick={() => setOpen(true)}>Code Hub</button>
      <Link href="/virtuals" className={pill}>Instant Virtuals</Link>
      <Link href="/promotions" className={pill}>Boosted Odds</Link>
      <Link href="/games" className={pill}>Aviator / Games</Link>
    </div>
  );
}
