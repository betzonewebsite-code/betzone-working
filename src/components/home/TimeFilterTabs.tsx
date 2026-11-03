"use client";
import { TIME_TABS, useFilters } from "@/store/filterStore";

export default function TimeFilterTabs() {
  const { time, setTime } = useFilters();
  return (
    <div role="tablist" aria-label="Time filter" className="no-scrollbar flex gap-1 overflow-x-auto">
      {TIME_TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={time === t.id} onClick={() => setTime(t.id)}
          className={`shrink-0 rounded px-2.5 py-1 text-xs font-semibold ${time === t.id ? "bg-ink text-white" : "bg-odds-bg text-ink"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
