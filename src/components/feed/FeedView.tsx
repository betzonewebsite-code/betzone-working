"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/authStore";
import { useBetslip } from "@/store/betslipStore";

type Leg = { match: string; market: string; pick: string; odds: number; open: boolean };
type Post = { id: string; author: string; note: string; code: string; createdAt: string; expired: boolean; legs: Leg[]; totalOdds: number | null };

export default function FeedView() {
  const user = useAuth((s) => s.user);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [code, setCode] = useState(useBetslip.getState().bookedCode ?? "");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { const r = await api("/api/feed"); setPosts(r.ok ? r.data.posts : []); }, []);
  useEffect(() => { void load(); }, [load]);

  async function post() {
    if (!user) return useAuth.getState().openModal("login");
    setBusy(true); setMsg(null);
    const r = await api("/api/feed", { body: { code, note } });
    setBusy(false);
    if (r.ok) { setNote(""); setMsg({ ok: true, text: "Shared." }); void load(); } else setMsg({ ok: false, text: r.data.error ?? "Could not share." });
  }
  async function loadSlip(c: string) { const r = await useBetslip.getState().loadCode(c); if (!r.ok) setMsg({ ok: false, text: r.error ?? "Could not load that slip." }); }
  async function report(id: string) { const r = await api(`/api/feed/${id}/report`, { body: {} }); setMsg(r.ok ? { ok: true, text: "Thanks. We will review it." } : { ok: false, text: r.data.error ?? "Could not report." }); void load(); }

  return (
    <div className="space-y-3">
      <section className="panel space-y-2 p-3">
        <h2 className="text-sm font-bold">Share a slip</h2>
        <p className="text-xs text-neutral-500">Book a bet in your slip, then share its code. Slips are free to share and are not betting advice. Bet only what you can afford to lose.</p>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="Booking code, e.g. BZ89K2" aria-label="Booking code" className="h-9 w-full rounded border border-[var(--line)] bg-transparent px-2 font-mono text-sm" />
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Why this slip? (max 140 characters, no links or phone numbers)" aria-label="Note" className="h-9 w-full rounded border border-[var(--line)] bg-transparent px-2 text-sm" />
        {msg && <p role="status" className={`text-xs font-semibold ${msg.ok ? "text-win" : "text-drop"}`}>{msg.text}</p>}
        <button onClick={post} disabled={busy || code.length < 4 || note.trim().length < 3} className="cta-red w-full disabled:opacity-40">{user ? "Share" : "Log in to share"}</button>
      </section>

      {posts === null && <p className="panel p-6 text-center text-sm text-neutral-500">Loading…</p>}
      {posts?.length === 0 && <p className="panel p-6 text-center text-sm text-neutral-500">No slips shared yet. Be the first.</p>}
      {posts?.map((p) => (
        <article key={p.id} className="panel overflow-hidden">
          <header className="flex items-center justify-between bg-ink-2 px-3 py-1.5 text-xs text-white">
            <span className="font-bold">{p.author}</span>
            <span className="text-white/60" suppressHydrationWarning>{new Date(p.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
          </header>
          <p className="px-3 pt-2 text-sm">{p.note}</p>
          {p.expired ? <p className="px-3 py-2 text-xs text-neutral-500">This slip has expired.</p> : (
            <ul className="divide-y divide-[var(--line)] px-3">
              {p.legs.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <div className="min-w-0"><div className="truncate font-semibold">{l.pick}</div><div className="truncate text-2xs text-neutral-500">{l.market} · {l.match}</div></div>
                  <b className={`tabular-nums ${l.open ? "" : "text-neutral-400"}`}>{l.open ? l.odds.toFixed(2) : "closed"}</b>
                </li>
              ))}
            </ul>
          )}
          <footer className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="font-mono text-xs font-bold tracking-widest">{p.code}{p.totalOdds ? <span className="ml-2 font-sans font-normal text-neutral-500">odds {p.totalOdds.toFixed(2)}</span> : null}</span>
            <span className="flex gap-2">
              <button onClick={() => void report(p.id)} className="text-2xs text-neutral-500 underline">Report</button>
              {!p.expired && <button onClick={() => void loadSlip(p.code)} className="rounded bg-ink px-3 py-1 text-xs font-bold text-white">Load slip</button>}
            </span>
          </footer>
        </article>
      ))}
    </div>
  );
}
