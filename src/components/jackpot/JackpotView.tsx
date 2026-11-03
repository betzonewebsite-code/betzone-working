"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/limits";
import { useAuth } from "@/store/authStore";

type Match = { fixtureId: string; position: number; home: string; away: string; league: string; kickoff: string; status: string; score: [number, number] | null };
type Round = { id: string; title: string; status: string; entryFee: string; closesAt: string; pool: string; entries: number; matches: Match[] };
type Entry = { id: string; title: string; status: string; correct: number | null; total: number; payout: string; createdAt: string };

function useCountdown(iso?: string) {
  const [left, setLeft] = useState(0);
  useEffect(() => { if (!iso) return; const t = () => setLeft(Math.max(0, new Date(iso).getTime() - Date.now())); t(); const id = setInterval(t, 1000); return () => clearInterval(id); }, [iso]);
  const s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return { left, text: d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s` };
}

export default function JackpotView() {
  const user = useAuth((s) => s.user);
  const [round, setRound] = useState<Round | null | undefined>(undefined);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const key = useRef(crypto.randomUUID());
  const cd = useCountdown(round?.closesAt);

  const load = useCallback(async () => {
    const r = await api("/api/jackpot");
    setRound(r.ok ? r.data.round : null);
    if (user) { const e = await api("/api/jackpot/entries"); if (e.ok) setEntries(e.data.entries); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  if (round === undefined) return <p className="panel p-6 text-center text-sm text-neutral-500">Loading…</p>;

  const done = round ? round.matches.every((m) => picks[m.fixtureId]) : false;
  async function enter() {
    if (!user) return useAuth.getState().openModal("login");
    setBusy(true); setMsg(null);
    const r = await api("/api/jackpot/enter", { body: { roundId: round!.id, picks, idempotencyKey: key.current } });
    setBusy(false);
    if (r.ok) { key.current = crypto.randomUUID(); setPicks({}); setMsg({ ok: true, text: "Entry placed. Good luck!" }); void useAuth.getState().load(); void load(); }
    else setMsg({ ok: false, text: r.data.error ?? "Could not enter." });
  }
  const quick = () => setPicks(Object.fromEntries(round!.matches.map((m) => [m.fixtureId, ["1", "X", "2"][Math.floor(Math.random() * 3)]])));

  return (
    <div className="space-y-3">
      {!round && <p className="panel p-6 text-center text-sm text-neutral-500">No jackpot is open right now. Check back soon.</p>}
      {round && (
        <section className="panel overflow-hidden">
          <header className="bg-gradient-to-r from-brand to-brand-dark p-4 text-white">
            <h2 className="text-lg font-extrabold">{round.title}</h2>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(round.pool)} <span className="text-sm font-semibold">prize pool</span></div>
            <p className="text-xs text-white/85">Entry {fmt(round.entryFee)} · {round.entries} entries · closes in {cd.text}</p>
          </header>
          <p className="border-b border-[var(--line)] px-3 py-2 text-xs text-neutral-600">Pick the result of every match: 1 (home), X (draw) or 2 (away). Get all correct to share 70% of the pool, or all but one to share 30%. Unclaimed prizes roll into the next jackpot.</p>
          <ul className="divide-y divide-[var(--line)]">
            {round.matches.map((m) => (
              <li key={m.fixtureId} className="flex items-center gap-2 px-3 py-2">
                <span className="w-5 text-xs text-neutral-400">{m.position}</span>
                <div className="min-w-0 flex-1 text-sm"><div className="truncate font-semibold">{m.home} v {m.away}</div><div className="truncate text-2xs text-neutral-500" suppressHydrationWarning>{m.league} · {new Date(m.kickoff).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</div></div>
                <div className="flex gap-1">
                  {["1", "X", "2"].map((p) => (
                    <button key={p} aria-pressed={picks[m.fixtureId] === p} aria-label={`${m.home} v ${m.away}: ${p}`} onClick={() => setPicks({ ...picks, [m.fixtureId]: p })} className="odds-btn !min-w-10">{p}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-[var(--line)] p-3">
            {msg && <p role="status" className={`text-xs font-semibold ${msg.ok ? "text-win" : "text-drop"}`}>{msg.text}</p>}
            <div className="flex gap-2">
              <button onClick={quick} className="rounded border border-brand px-3 py-2 text-sm font-bold text-brand">Quick pick</button>
              <button onClick={enter} disabled={busy || (!!user && !done) || cd.left === 0} className="cta-red flex-1 disabled:opacity-40">{busy ? "Entering…" : user ? `Enter for ${fmt(round.entryFee)}` : "Log in to enter"}</button>
            </div>
          </div>
        </section>
      )}
      {user && entries.length > 0 && (
        <section className="panel">
          <h3 className="bg-ink-2 px-3 py-1.5 text-xs font-bold text-white">My entries</h3>
          <ul className="divide-y divide-[var(--line)]">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div><div className="font-semibold">{e.title}</div><div className="text-2xs text-neutral-500" suppressHydrationWarning>{new Date(e.createdAt).toLocaleDateString()} · {e.status.toLowerCase()}{e.correct !== null ? ` · ${e.correct}/${e.total} correct` : ""}</div></div>
                <b className={`tabular-nums ${Number(e.payout) > 0 ? "text-win" : ""}`}>{Number(e.payout) > 0 ? `+${fmt(e.payout)}` : "-"}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
