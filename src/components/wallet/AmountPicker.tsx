"use client";
import { MAX_DEP } from "@/lib/limits";

export default function AmountPicker({ value, onChange, chips = [10, 20, 50, 100, 200], max = MAX_DEP }: { value: number; onChange: (n: number) => void; chips?: number[]; max?: number }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold" htmlFor="amt">Amount (GHS)</label>
      <input id="amt" inputMode="decimal" value={value || ""} onChange={(e) => onChange(Math.min(max, Number(e.target.value.replace(/[^\d.]/g, "")) || 0))}
        className="h-10 w-full rounded border border-[var(--line)] bg-transparent px-3 text-lg font-bold tabular-nums" />
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${value === c ? "bg-brand text-white" : "bg-odds-bg text-ink"}`}>{c}</button>
        ))}
      </div>
    </div>
  );
}
