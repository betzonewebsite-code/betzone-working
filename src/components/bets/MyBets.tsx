"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/authStore";
import BetCard, { type TicketView } from "./BetCard";

const TABS = [{ id: "active", label: "Active" }, { id: "cashout", label: "Cash out" }, { id: "settled", label: "Settled" }] as const;
type Tab = (typeof TABS)[number]["id"];

export default function MyBets() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const [tab, setTab] = useState<Tab>("active");
  const [open, setOpen] = useState<TicketView[]>([]);
  const [settled, setSettled] = useState<TicketView[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [o, s] = await Promise.all([api("/api/bets?status=open"), api("/api/bets?status=settled")]);
    if (o.ok) setOpen(o.data.tickets);
    if (s.ok) setSettled(s.data.tickets);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
    const t = setInterval(() => void refresh(), 15000);                 // cash-out offers move with the odds
    const onBet = () => void refresh();
    window.addEventListener("bz:bets", onBet);
    return () => { clearInterval(t); window.removeEventListener("bz:bets", onBet); };
  }, [user, refresh]);

  if (status === "loading") return <p className="panel p-6 text-center text-sm text-neutral-500">Loadingâ€¦</p>;
  if (!user) return <div className="panel space-y-3 p-6 text-center"><p className="text-sm">Log in to see your bets.</p><button onClick={() => useAuth.getState().openModal("login")} className="cta-red">Log in</button></div>;

  const lists: Record<Tab, TicketView[]> = { active: open, cashout: open.filter((t) => t.cashout.available), settled };
  const shown = lists[tab];
  const empty: Record<Tab, string> = {
    active: "No open bets. Pick some odds and place a bet.",
    cashout: "No bets can be cashed out right now. Locked markets pause cash out.",
    settled: "Settled bets show here once their matches finish.",
  };
  return (
    <div className="space-y-2">
      <div role="tablist" className="flex overflow-hidden rounded bg-ink text-white">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 text-sm font-bold ${tab === t.id ? "bg-brand" : "text-white/70"}`}>
            {t.label}{lists[t.id].length > 0 && <span className="ml-1 text-2xs">({lists[t.id].length})</span>}
          </button>
        ))}
      </div>
      {!loaded && <p className="panel p-6 text-center text-sm text-neutral-500">Loading your betsâ€¦</p>}
      {loaded && shown.length === 0 && <p className="panel p-6 text-center text-sm text-neutral-500">{empty[tab]}</p>}
      {shown.map((t) => <BetCard key={t.id} ticket={t} onChanged={() => void refresh()} />)}
    </div>
  );
}

