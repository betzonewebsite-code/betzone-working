"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LiveMatch = {
  fixtureId: string;
  home: string;
  away: string;
  minute: number;
  homeScore: number;
  awayScore: number;
  goals: Array<{ minute: number; side: "h" | "a" }>;
  status: string;
};

type VirtualTicket = {
  id: string;
  publicId?: string;
  type?: string;
  status?: string;
  stake?: number | string;
  totalOdds?: number | string;
  potentialPayout?: number | string;
  payout?: number | string | null;
  placedAt?: string;
  legs?: Array<{
    id: string;
    matchName?: string;
    marketName?: string;
    pickLabel?: string;
    oddsTaken?: number | string;
    result?: string;
  }>;
  virtualSession?: {
    id: string;
    status: string;
    fixtureIds: string[];
    startedAt?: string | null;
    endsAt?: string | null;
    matches?: LiveMatch[];
  } | null;
};

function money(value: number | string | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function matchMinute(
  startedAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: number,
  fallback: number
) {
  if (!startedAt || !endsAt) return fallback;

  const start = new Date(startedAt).getTime();
  const end = new Date(endsAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return fallback;
  }

  return Math.max(0, Math.min(90, Math.floor(((now - start) / (end - start)) * 90)));
}

function LiveMatchCard({
  match,
  startedAt,
  endsAt,
  now,
  sessionStatus,
}: {
  match: LiveMatch;
  startedAt?: string | null;
  endsAt?: string | null;
  now: number;
  sessionStatus: string;
}) {
  const finished = sessionStatus === "DONE";
  const minute = finished
    ? 90
    : matchMinute(startedAt, endsAt, now, match.minute);

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-[#101820]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {finished ? (
            <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold text-gray-300">
              FULL TIME
            </span>
          ) : (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[10px] font-bold tracking-wider text-red-400">
                LIVE
              </span>
            </>
          )}
          <span className="truncate text-xs text-gray-400">
            Instant Football
          </span>
        </div>
        <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold tabular-nums text-white">
          {finished ? "90′" : `${minute}′`}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-4">
        <div className="min-w-0 text-center">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-500/70 bg-red-500/15 text-xs font-black text-red-300">
            H
          </div>
          <p className="break-words text-sm font-semibold text-white">
            {match.home}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-red-400">HOME</p>
        </div>

        <div className="flex items-center gap-2 text-3xl font-black tabular-nums text-white">
          <span>{match.homeScore}</span>
          <span className="text-gray-500">:</span>
          <span>{match.awayScore}</span>
        </div>

        <div className="min-w-0 text-center">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-blue-500/70 bg-blue-500/15 text-xs font-black text-blue-300">
            A
          </div>
          <p className="break-words text-sm font-semibold text-white">
            {match.away}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-blue-400">AWAY</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="relative h-36 overflow-hidden rounded-lg border border-white/20 bg-gradient-to-b from-[#17683b] to-[#10542f]">
          <div className="absolute inset-x-0 top-1/2 border-t border-white/40" />
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />

          <div className="absolute left-1/2 top-0 h-7 w-24 -translate-x-1/2 border-x border-b border-white/40" />
          <div className="absolute bottom-0 left-1/2 h-7 w-24 -translate-x-1/2 border-x border-t border-white/40" />

          <div className="absolute left-0 top-1/2 h-16 w-8 -translate-y-1/2 rounded-r border-y border-r border-white/40" />
          <div className="absolute right-0 top-1/2 h-16 w-8 -translate-y-1/2 rounded-l border-y border-l border-white/40" />

          {!finished && (
            <>
              <span className="absolute left-[22%] top-[30%] h-3 w-3 animate-bounce rounded-full border-2 border-white bg-red-500 shadow-lg" />
              <span className="absolute left-[35%] top-[65%] h-3 w-3 animate-pulse rounded-full border-2 border-white bg-red-500 shadow-lg" />
              <span className="absolute left-[43%] top-[42%] h-3 w-3 animate-bounce rounded-full border-2 border-white bg-red-500 shadow-lg [animation-delay:300ms]" />

              <span className="absolute right-[22%] top-[65%] h-3 w-3 animate-bounce rounded-full border-2 border-white bg-blue-500 shadow-lg [animation-delay:150ms]" />
              <span className="absolute right-[35%] top-[30%] h-3 w-3 animate-pulse rounded-full border-2 border-white bg-blue-500 shadow-lg" />
              <span className="absolute right-[43%] top-[58%] h-3 w-3 animate-bounce rounded-full border-2 border-white bg-blue-500 shadow-lg [animation-delay:450ms]" />

              <span className="absolute left-[58%] top-[47%] h-3 w-3 animate-ping rounded-full bg-white shadow-lg" />
            </>
          )}

          {finished && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/15">
              <span className="rounded-full border border-white/30 bg-black/50 px-3 py-1 text-xs font-bold tracking-wider text-white">
                MATCH FINISHED
              </span>
            </div>
          )}

          <div className="absolute bottom-2 left-2 flex items-center gap-3 rounded bg-black/35 px-2 py-1 text-[9px] font-bold text-white">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              HOME
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              AWAY
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
          <span>{finished ? "Final score" : "Match in progress"}</span>
          <span className="tabular-nums">
            {finished ? "90′ / 90′" : `${minute}′ / 90′`}
          </span>
        </div>

        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${(minute / 90) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function VirtualMyBets() {
  const [tickets, setTickets] = useState<VirtualTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const loadInFlight = useRef(false);

  const loadTickets = useCallback(async () => {
    if (loadInFlight.current) return;

    loadInFlight.current = true;

    try {
      const response = await fetch("/api/virtuals/my-bets", {
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.message || `Unable to load Instant Virtual tickets (${response.status}).`);
      }

      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tickets.");
    } finally {
      loadInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
    const timer = window.setInterval(() => void loadTickets(), 5000);
    return () => window.clearInterval(timer);
  }, [loadTickets]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  async function kickOff(ticketId: string) {
    if (starting) return;

    setStarting(ticketId);
    setError("");

    try {
      const response = await fetch(
        `/api/virtuals/my-bets/${encodeURIComponent(ticketId)}/kickoff`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not start this ticket.");
      }

      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start this ticket.");
    } finally {
      setStarting(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-5">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Instant Virtual My Bets</h1>
          <p className="mt-1 text-sm text-gray-400">
            Your placed virtual tickets and their private match sessions.
          </p>
        </div>
        <a href="/virtuals" className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:opacity-90">Continue Betting</a>
        <button
          type="button"
          onClick={() => void loadTickets()}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">
          Loading your virtual tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <h2 className="font-semibold text-white">No Instant Virtual tickets yet</h2>
          <p className="mt-2 text-sm text-gray-400">
            Your placed Instant Virtual bets will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const session = ticket.virtualSession;
            const sessionStatus = session?.status ?? "MISSING";
            const ready = sessionStatus === "READY" && ticket.status === "OPEN";
            const running = sessionStatus === "RUNNING";
            const done = sessionStatus === "DONE";

            return (
              <article
                key={ticket.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#151a22]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">
                      Ticket {ticket.publicId || ticket.id}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {ticket.placedAt
                        ? new Date(ticket.placedAt).toLocaleString()
                        : "Placement time unavailable"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-200">
                    {running
                      ? "RUNNING"
                      : done
                        ? ticket.status === "OPEN"
                          ? "SETTLING"
                          : ticket.status
                        : ticket.status || sessionStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-gray-400">Stake</p>
                    <p className="mt-1 font-semibold text-white">
                      {money(ticket.stake)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Total odds</p>
                    <p className="mt-1 font-semibold text-white">
                      {money(ticket.totalOdds)}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-xs text-gray-400">Potential payout</p>
                    <p className="mt-1 font-semibold text-emerald-400">
                      {money(ticket.potentialPayout)}
                    </p>
                  </div>
                </div>

                {running && (
                  <div className="space-y-3 px-4 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-bold text-white">
                        LIVE TICKET MATCHES
                      </h2>
                      <span className="text-xs text-emerald-400">
                        {session?.matches?.length ?? 0} match(es) playing
                      </span>
                    </div>

                    {session?.matches?.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {session.matches.map((match) => (
                          <LiveMatchCard
                            key={match.fixtureId}
                            match={match}
                            startedAt={session.startedAt}
                            endsAt={session.endsAt}
                            now={now}
                            sessionStatus={sessionStatus}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-5 text-center text-sm text-gray-400">
                        Preparing your live matches...
                      </div>
                    )}
                  </div>
                )}

                {done && session?.matches?.length ? (
                  <div className="space-y-3 px-4 pb-4">
                    <h2 className="text-sm font-bold text-white">
                      COMPLETED MATCHES
                    </h2>
                    <div className="grid gap-3 md:grid-cols-2">
                      {session.matches.map((match) => (
                        <LiveMatchCard
                          key={match.fixtureId}
                          match={match}
                          startedAt={session.startedAt}
                          endsAt={session.endsAt}
                          now={now}
                          sessionStatus={sessionStatus}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2 px-4 pb-4">
                  {(ticket.legs ?? []).map((leg) => (
                    <div key={leg.id} className="rounded-lg bg-black/20 px-3 py-3">
                      <p className="text-sm font-semibold text-white">
                        {leg.matchName || "Virtual match"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                        <span>
                          {leg.marketName || "Market"} · {leg.pickLabel || "Selection"}
                        </span>
                        <span>Odds {money(leg.oddsTaken)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-sm text-gray-400">
                    {ready
                      ? `${session?.fixtureIds?.length ?? 0} match(es) ready to start`
                      : running
                        ? `Your ticket session is running${
                            session?.endsAt
                              ? ` · Ends ${new Date(session.endsAt).toLocaleTimeString()}`
                              : ""
                          }`
                        : done
                          ? "Your ticket session has finished."
                          : "Session is not available for kickoff."}
                  </p>

                  {ready && (
                    <button
                      type="button"
                      disabled={starting !== null}
                      onClick={() => void kickOff(ticket.id)}
                      className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {starting === ticket.id ? "Starting..." : "Kick Off"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}



