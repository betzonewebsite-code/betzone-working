"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/authStore";

type Game = { id: string; title: string; category: string; thumb?: string };

export default function GamesLobby({ title, categories, emptyNote }: { title: string; categories: string[]; emptyNote: string }) {
  const user = useAuth((s) => s.user);
  const [games, setGames] = useState<Game[] | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void api("/api/games").then((r) => setGames(r.ok ? (r.data.games as Game[]).filter((g) => categories.includes(g.category)) : [])); }, [categories]);

  async function play(id: string) {
    if (!user) return useAuth.getState().openModal("login");
    setErr(null);
    const r = await api(`/api/games/launch?id=${encodeURIComponent(id)}`);
    r.ok ? setUrl(r.data.url) : setErr(r.data.error ?? "Could not open the game.");
  }
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">{title}</h1>
      {games === null && <p className="panel p-6 text-center text-sm text-neutral-500">Loading…</p>}
      {games?.length === 0 && <div className="panel space-y-1 p-6 text-center"><p className="text-sm font-semibold">Coming soon</p><p className="text-xs text-neutral-500">{emptyNote}</p></div>}
      {err && <p role="alert" className="text-xs font-semibold text-drop">{err}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {games?.map((g) => (
          <button key={g.id} onClick={() => void play(g.id)} className="panel overflow-hidden text-left hover:ring-2 hover:ring-brand">
            <div className="flex h-24 items-center justify-center bg-ink text-white">{g.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={g.thumb} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl font-extrabold">{g.title.slice(0, 1)}</span>}</div>
            <div className="p-2 text-sm font-semibold">{g.title}</div>
          </button>
        ))}
      </div>
      {url && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <button onClick={() => { setUrl(null); void useAuth.getState().load(); }} aria-label="Close game" className="flex items-center justify-end gap-1 bg-ink p-2 text-sm text-white"><X size={16} /> Close</button>
          <iframe src={url} title="Game" className="flex-1 border-0" allow="fullscreen" />
        </div>
      )}
    </div>
  );
}
