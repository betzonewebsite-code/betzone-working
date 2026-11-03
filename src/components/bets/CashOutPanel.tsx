"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/limits";
import { useAuth } from "@/store/authStore";
import type { TicketView } from "./BetCard";

export default function CashOutPanel({ ticket, onDone }: { ticket: TicketView; onDone: () => void }) {
  const [pct, setPct] = useState(50);
  const [target, setTarget] = useState(ticket.autoCashoutTarget ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const offer = ticket.cashout;
  if (!offer.available) return <p className="rounded bg-odds-bg p-2 text-xs text-neutral-600">{offer.reason}</p>;

  const amount = Number(offer.amount);
  const part = Math.floor(amount * pct) / 100;
  const stays = Math.floor(Number(ticket.remainingStake) * (100 - pct)) / 100;

  async function cash(fraction: number) {
    setBusy(true); setNote(null);
    const r = await api(`/api/bets/${ticket.id}/cashout`, { body: { fraction, expectedAmount: amount, idempotencyKey: key.current } });
    setBusy(false);
    if (r.ok) { key.current = crypto.randomUUID(); useAuth.getState().setBalance((Number(useAuth.getState().user?.balance ?? 0) + Number(r.data.amount)).toFixed(2)); setNote(`Cashed out ${fmt(r.data.amount)}.`); onDone(); }
    else if (r.data.code === "OFFER_CHANGED") { setNote(`The offer changed to ${fmt(r.data.amount)}. Check it and tap again.`); onDone(); }
    else setNote(r.data.error ?? "Could not cash out.");
  }
  async function auto(t: number | null) {
    const r = await api(`/api/bets/${ticket.id}/auto`, { method: "PUT", body: { target: t } });
    if (r.ok) { setNote(t ? `Auto cash out set at ${fmt(t)}.` : "Auto cash out cleared."); onDone(); } else setNote(r.data.error ?? "Could not save.");
  }

  return (
    <div className="space-y-2 rounded border border-[var(--line)] p-2">
      <button disabled={busy} onClick={() => cash(1)} className="cta-red flex w-full items-center justify-between disabled:opacity-60">
        <span>Cash out</span><span className="tabular-nums">{fmt(offer.amount)}</span>
      </button>
      <div>
        <label className="flex justify-between text-xs font-semibold" htmlFor={`pct-${ticket.id}`}><span>Partial cash out: {pct}%</span><span className="tabular-nums">{fmt(part)}</span></label>
        <input id={`pct-${ticket.id}`} type="range" min={10} max={90} step={10} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-brand" />
        <button disabled={busy} onClick={() => cash(pct / 100)} className="w-full rounded border border-brand py-1 text-xs font-bold text-brand disabled:opacity-60">Take {fmt(part)}, keep {fmt(stays)} running</button>
      </div>
      <div className="flex items-center gap-1">
        <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Auto cash out at" aria-label="Auto cash out target" className="h-8 min-w-0 flex-1 rounded border border-[var(--line)] bg-transparent px-2 text-sm" />
        {ticket.autoCashoutTarget
          ? <button onClick={() => { setTarget(""); void auto(null); }} className="rounded border border-[var(--line)] px-2 py-1 text-xs">Clear</button>
          : <button onClick={() => { const n = Number(target); if (!n || n <= amount) return setNote(`Set a target above the current offer (${fmt(amount)}).`); void auto(n); }} className="rounded bg-ink px-2 py-1 text-xs font-bold text-white">Set</button>}
      </div>
      {note && <p className="text-2xs text-neutral-600" role="status">{note}</p>}
    </div>
  );
}
