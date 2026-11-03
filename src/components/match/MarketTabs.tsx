"use client";
export type Tab = { id: string; label: string; match: (marketId: string) => boolean };

export const SOCCER_TABS: Tab[] = [
  { id: "1x2", label: "1X2", match: (m) => m === "1x2" },
  { id: "ou", label: "Over/Under", match: (m) => m.startsWith("ou_") },
  { id: "dc", label: "Double Chance", match: (m) => m === "dc" },
  { id: "btts", label: "GG/NG", match: (m) => m === "btts" },
  { id: "next", label: "Next Goal", match: (m) => m === "next" },
  { id: "hcp", label: "Handicap", match: (m) => m.startsWith("hcp_") },
];
export const BASKET_TABS: Tab[] = [
  { id: "ml", label: "Moneyline", match: (m) => m === "ml" },
  { id: "ou", label: "Over/Under", match: (m) => m.startsWith("ou_") },
];

export default function MarketTabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${value === t.id ? "bg-brand text-white" : "bg-odds-bg text-ink"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
