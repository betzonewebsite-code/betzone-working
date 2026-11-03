"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/limits";
import { useAuth } from "@/store/authStore";

type Tx = { id: string; type: string; status: string; amount: string; currency: string; method: string | null; counterparty: string | null; failureReason: string | null; createdAt: string };
const FILTERS = [{ id: "all", label: "All" }, { id: "deposit", label: "Deposits" }, { id: "withdrawal", label: "Withdrawals" }, { id: "bets", label: "Bets" }, { id: "cashout", label: "Cashouts" }];
const NAME: Record<string, string> = { DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal", BET_STAKE: "Bet stake", BET_PAYOUT: "Winnings", BET_REFUND: "Bet refund", CASHOUT: "Cash out", BONUS: "Bonus", ADJUSTMENT: "Adjustment" };
const TONE: Record<string, string> = { PENDING: "bg-odds-bg text-ink", PROCESSING: "bg-brand-soft text-brand", SUCCESSFUL: "bg-win text-white", FAILED: "bg-drop text-white", REVERSED: "bg-drop text-white" };

export default function TxTable() {
  const user = useAuth((s) => s.user);
  const [f, setF] = useState("all");
  const [rows, setRows] = useState<Tx[] | null>(null);
  useEffect(() => {
    if (!user) return;
    setRows(null);
    void api(`/api/wallet/transactions?type=${f}&limit=100`).then((r) => setRows(r.ok ? r.data.transactions : []));
  }, [f, user]);

  if (!user) return <div className="panel space-y-3 p-6 text-center"><p className="text-sm">Log in to see your transactions.</p><button onClick={() => useAuth.getState().openModal("login")} className="cta-red">Log in</button></div>;
  return (
    <div className="space-y-2">
      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto">
        {FILTERS.map((x) => (
          <button key={x.id} role="tab" aria-selected={f === x.id} onClick={() => setF(x.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${f === x.id ? "bg-brand text-white" : "bg-odds-bg text-ink"}`}>{x.label}</button>
        ))}
      </div>
      {rows === null && <p className="panel p-6 text-center text-sm text-neutral-500">Loading…</p>}
      {rows?.length === 0 && <p className="panel p-6 text-center text-sm text-neutral-500">Nothing here yet.</p>}
      {!!rows?.length && (
        <ul className="panel divide-y divide-[var(--line)]">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{NAME[t.type] ?? t.type}{t.method && <span className="font-normal text-neutral-500"> · {t.method.replace("_", " ").toLowerCase()}</span>}</div>
                <div className="truncate text-2xs text-neutral-500" suppressHydrationWarning>{new Date(t.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}{t.counterparty ? ` · ${t.counterparty}` : ""}{t.failureReason ? ` · ${t.failureReason}` : ""}</div>
              </div>
              <span className={`rounded px-1.5 py-0.5 text-2xs font-bold capitalize ${TONE[t.status]}`}>{t.status.toLowerCase()}</span>
              <span className={`w-24 text-right text-sm font-bold tabular-nums ${Number(t.amount) < 0 ? "text-drop" : "text-win"}`}>{Number(t.amount) < 0 ? "-" : "+"}{fmt(Math.abs(Number(t.amount)))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
