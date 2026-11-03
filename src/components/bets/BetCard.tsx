"use client";
import { Check, Minus, X } from "lucide-react";
import { fmt } from "@/lib/limits";
import { useFixtureStore } from "@/store/fixtureStore";
import CashOutPanel from "./CashOutPanel";

export type LegView = { id: string; fixtureId: string; matchName: string; marketName: string; pickLabel: string; oddsTaken: string; currentOdds: string; result: string; live: boolean };
export type TicketView = {
  id: string; publicId: string; type: "SINGLE" | "MULTIPLE" | "FLEXI" | "SYSTEM"; flexiCut: number; status: "OPEN" | "WON" | "LOST" | "VOID" | "CASHED_OUT";
  stake: string; remainingStake: string; totalOdds: string; potentialPayout: string; payout: string; cashedOut: string; autoCashoutTarget: string | null; placedAt: string;
  cashout: { available: true; amount: string; maxPayout: string } | { available: false; reason: string };
  legs: LegView[];
};

function Leg({ leg }: { leg: LegView }) {
  const f = useFixtureStore((s) => s.fixtures.find((x) => x.id === leg.fixtureId));
  const icon =
    leg.result === "WON" || leg.result === "HALF_WON" ? <Check size={14} className="text-win" /> :
    leg.result === "LOST" || leg.result === "HALF_LOST" ? <X size={14} className="text-drop" /> :
    leg.result === "VOID" ? <Minus size={14} className="text-neutral-400" /> : <span className="live-dot !bg-neutral-300" />;
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className="mt-0.5 flex w-4 justify-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{leg.pickLabel}</div>
        <div className="truncate text-xs text-neutral-500">{leg.marketName} · {leg.matchName}</div>
        {f?.live && f.score && <div className="text-2xs font-bold text-win">{f.minute != null ? `${f.minute}'` : f.period ?? "Live"} {f.score[0]}-{f.score[1]}</div>}
      </div>
      <span className="text-sm font-bold tabular-nums">{Number(leg.oddsTaken).toFixed(2)}</span>
    </li>
  );
}

const LABEL = { OPEN: "Open", WON: "Won", LOST: "Lost", VOID: "Void", CASHED_OUT: "Cashed out" } as const;
const TONE = { OPEN: "bg-ink text-white", WON: "bg-win text-white", LOST: "bg-drop text-white", VOID: "bg-odds-bg text-ink", CASHED_OUT: "bg-odds-bg text-ink" } as const;

export default function BetCard({ ticket: t, onChanged }: { ticket: TicketView; onChanged: () => void }) {
  const kind = t.type === "SINGLE" ? "Single" : t.type === "FLEXI" ? `Flexi · Cut ${t.flexiCut}` : `Multiple (${t.legs.length})`;
  const open = t.status === "OPEN";
  return (
    <article className="panel overflow-hidden">
      <header className="flex items-center justify-between bg-ink-2 px-3 py-1.5 text-xs text-white">
        <span className="font-bold">{kind}</span>
        <span className="text-white/60" suppressHydrationWarning>#{t.publicId} · {new Date(t.placedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
        <span className={`rounded px-1.5 py-0.5 font-bold ${TONE[t.status]}`}>{LABEL[t.status]}</span>
      </header>
      <ul className="divide-y divide-[var(--line)] px-3">{t.legs.map((l) => <Leg key={l.id} leg={l} />)}</ul>
      <dl className="space-y-0.5 border-t border-[var(--line)] px-3 py-2 text-xs">
        <Line k="Total odds" v={fmt(t.totalOdds)} />
        <Line k="Stake" v={fmt(t.stake)} />
        {open && t.remainingStake !== t.stake && <Line k="Still running" v={fmt(t.remainingStake)} />}
        {Number(t.cashedOut) > 0 && <Line k="Cashed out so far" v={fmt(t.cashedOut)} />}
        <Line k={open ? "Potential payout" : "Payout"} v={fmt(open ? t.potentialPayout : t.payout)} bold />
      </dl>
      {open && <div className="px-3 pb-3"><CashOutPanel ticket={t} onDone={onChanged} /></div>}
    </article>
  );
}
function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? "text-sm font-bold" : ""}`}><dt>{k}</dt><dd className="tabular-nums">{v}</dd></div>;
}
