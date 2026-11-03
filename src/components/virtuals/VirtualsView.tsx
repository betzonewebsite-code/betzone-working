"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OddsButton from "@/components/betslip/OddsButton";
import type { Fixture } from "@/types";
import { INSTANT_FOOTBALL_LEAGUES } from "@/lib/instantFootball";

type Goal = { minute: number; side: "h" | "a" };

type VirtualFixture = {
  roundNumber: number;
  status: "BETTING" | "PLAYING";
  seedHash: string;
  startedAt: string | null;
  endsAt: string | null;
  minute: number;
  score: [number, number] | null;
  goals: Goal[];
  leagueKey: string;
  homeStrength: number | null;
  awayStrength: number | null;
  homeWin: number | null;
  draw: number | null;
  awayWin: number | null;
  fixture: Fixture;
};

type VirtualResult = {
  number: number;
  seed: string;
  seedHash: string;
  leagueKey: string;
  home: string;
  away: string;
  hs: number;
  as: number;
};

type State = {
  enabled: boolean;
  serverTime: string;
  fixtures: VirtualFixture[];
  results: VirtualResult[];
};


function getTeamHistory(results: VirtualResult[], teamName: string) {
  const matches = results.filter(
    (match) => match.home === teamName || match.away === teamName
  );

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const match of matches) {
    const isHome = match.home === teamName;
    const scored = isHome ? match.hs : match.as;
    const conceded = isHome ? match.as : match.hs;

    goalsFor += scored;
    goalsAgainst += conceded;

    if (scored > conceded) wins++;
    else if (scored === conceded) draws++;
    else losses++;
  }

  const total = matches.length;

  return {
    played: total,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    winPercentage: total ? Math.round((wins / total) * 100) : 0,
    matches,
  };
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function Verify({ seed, hash }: { seed: string; hash: string }) {
  const [verified, setVerified] = useState<boolean | null>(null);

  return (
    <div className="space-y-1 text-2xs text-neutral-500">
      <div className="break-all">
        Seed: <span className="font-mono">{seed}</span>
      </div>
      <div className="break-all">
        Published hash: <span className="font-mono">{hash}</span>
      </div>
      <button
        type="button"
        onClick={async () => setVerified((await sha256(seed)) === hash)}
        className="rounded border border-brand px-2 py-1 font-bold text-brand"
      >
        Verify result
      </button>
      {verified !== null && (
        <span
          className={`ml-2 font-bold ${
            verified ? "text-win" : "text-drop"
          }`}
        >
          {verified ? "Seed verified." : "Seed verification failed."}
        </span>
      )}
    </div>
  );
}

const LEAGUES = [
  {
    key: "VIRTUAL-PL",
    title: "Premier League",
    subtitle: "20 clubs Ã‚Â· 10 fixtures",
  },
  {
    key: "VIRTUAL-CHAMPIONSHIP",
    title: "Championship",
    subtitle: "24 clubs Ã‚Â· 12 fixtures",
  },
];


function VirtualH2HModal({
  fixture,
  results,
  onClose,
}: {
  fixture: VirtualFixture;
  results: VirtualResult[];
  onClose: () => void;
}) {
  const home = getTeamHistory(results, fixture.fixture.home);
  const away = getTeamHistory(results, fixture.fixture.away);

  const recent = (team: string) =>
    results
      .filter((m) => m.home === team || m.away === team)
      .slice(0, 5)
      .map((m) => {
        const isHome = m.home === team;
        const scored = isHome ? m.hs : m.as;
        const conceded = isHome ? m.as : m.hs;
        return {
          opponent: isHome ? m.away : m.home,
          score: `${scored}:${conceded}`,
          result: scored > conceded ? "W" : scored === conceded ? "D" : "L",
          home: isHome,
        };
      });

  const homeRecent = recent(fixture.fixture.home);
  const awayRecent = recent(fixture.fixture.away);

  const probabilityTotal =
    (fixture.homeWin ?? 0) +
    (fixture.draw ?? 0) +
    (fixture.awayWin ?? 0);

  const probability = (value: number | null) =>
    probabilityTotal > 0 ? Math.round(((value ?? 0) / probabilityTotal) * 100) : 0;

  const formPercent = (history: ReturnType<typeof getTeamHistory>) =>
    history.played
      ? Math.round(((history.wins * 3 + history.draws) / (history.played * 3)) * 100)
      : 0;

  const homeForm = formPercent(home);
  const awayForm = formPercent(away);

  const average = (goals: number, played: number) =>
    played ? (goals / played).toFixed(1) : "0.0";

  const resultColor = (result: string) =>
    result === "W"
      ? "bg-green-600 text-white"
      : result === "D"
        ? "bg-neutral-600 text-white"
        : "bg-red-700 text-white";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Head-to-head statistics"
      onClick={onClose}
    >
      <div
        className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[#1b1e26] p-5 text-white shadow-2xl sm:rounded-2xl sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Stats - H2H</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close statistics"
            className="rounded-full p-2 text-3xl leading-none text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="mb-6 flex items-center justify-center gap-3 text-center">
          <span className="min-w-0 flex-1 truncate text-lg font-bold">
            {fixture.fixture.home}
          </span>
          <span className="rounded-full bg-[#343844] px-3 py-2 text-xs font-bold text-neutral-300">
            VS
          </span>
          <span className="min-w-0 flex-1 truncate text-lg font-bold">
            {fixture.fixture.away}
          </span>
        </div>

        <div className="mb-3 bg-[#343844] px-3 py-2 text-center text-sm font-semibold">
          League Performance
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-28 w-28 max-w-full items-center justify-center rounded-full border-[7px] border-[#27c96b] text-3xl font-bold text-white">
              {homeForm}%
            </div>
            <p className="text-sm text-neutral-300">FORM</p>
            <p className="mt-2 text-xs text-neutral-400">
              {home.wins}W · {home.draws}D · {home.losses}L
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 text-xs text-neutral-400">
            <span className="rounded bg-[#27c96b] px-3 py-2 font-bold text-[#102719]">
              {home.played}
            </span>
            <span className="h-16 w-1 bg-[#343844]" />
            <span className="rounded bg-[#e31837] px-3 py-2 font-bold text-white">
              {away.played}
            </span>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-2 flex h-28 w-28 max-w-full items-center justify-center rounded-full border-[7px] border-[#e31837] text-3xl font-bold text-white">
              {awayForm}%
            </div>
            <p className="text-sm text-neutral-300">FORM</p>
            <p className="mt-2 text-xs text-neutral-400">
              {away.wins}W · {away.draws}D · {away.losses}L
            </p>
          </div>
        </div>

        <div className="mb-3 bg-[#343844] px-3 py-2 text-center text-sm font-semibold">
          Last 5 Matches
        </div>

        <div className="space-y-2">
          {Array.from({ length: Math.max(homeRecent.length, awayRecent.length, 5) }).slice(0, 5).map((_, index) => {
            const h = homeRecent[index];
            const a = awayRecent[index];

            return (
              <div key={index} className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  {h && <span className={`rounded px-2 py-1 font-bold ${resultColor(h.result)}`}>{h.result}</span>}
                  <span className="min-w-0 flex-1 truncate text-neutral-300">{h ? `${h.opponent}  ${h.score}` : "No result yet"}</span>
                </div>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <span className="min-w-0 flex-1 truncate text-right text-neutral-300">{a ? `${a.opponent}  ${a.score}` : "No result yet"}</span>
                  {a && <span className={`rounded px-2 py-1 font-bold ${resultColor(a.result)}`}>{a.result}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-3 mt-6 bg-[#343844] px-3 py-2 text-center text-sm font-semibold">
          Win Probability
        </div>

        <div className="mb-2 flex justify-between text-sm">
          <span className="font-bold text-[#27c96b]">{fixture.fixture.home}</span>
          <span className="text-neutral-400">DRAW</span>
          <span className="font-bold text-[#e31837]">{fixture.fixture.away}</span>
        </div>

        <div className="mb-2 flex justify-between text-lg font-bold">
          <span className="text-[#27c96b]">{probability(fixture.homeWin)}%</span>
          <span className="text-neutral-400">{probability(fixture.draw)}%</span>
          <span className="text-[#e31837]">{probability(fixture.awayWin)}%</span>
        </div>

        <div className="flex h-5 w-full gap-1 overflow-hidden">
          <div className="bg-[#27c96b]" style={{ width: `${probability(fixture.homeWin)}%` }} />
          <div className="bg-neutral-500" style={{ width: `${probability(fixture.draw)}%` }} />
          <div className="bg-[#e31837]" style={{ width: `${probability(fixture.awayWin)}%` }} />
        </div>

        <div className="mb-3 mt-6 bg-[#343844] px-3 py-2 text-center text-sm font-semibold">
          Recent Stats
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-3 text-center text-sm text-neutral-300">Average Points</p>
            <div className="grid grid-cols-2 gap-4 text-center">
              <p className="text-xl font-bold text-[#27c96b]">
                {home.played ? ((home.wins * 3 + home.draws) / home.played).toFixed(1) : "0.0"}
              </p>
              <p className="text-xl font-bold text-[#e31837]">
                {away.played ? ((away.wins * 3 + away.draws) / away.played).toFixed(1) : "0.0"}
              </p>
            </div>
          </div>

          {[
            { label: "Average Goals Scored", h: average(home.goalsFor, home.played), a: average(away.goalsFor, away.played) },
            { label: "Average Goals Conceded", h: average(home.goalsAgainst, home.played), a: average(away.goalsAgainst, away.played) },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="mb-3 text-center text-sm text-neutral-300">{stat.label}</p>
              <div className="grid grid-cols-2 gap-4 text-center">
                <p className="text-xl font-bold text-[#27c96b]">{stat.h}</p>
                <p className="text-xl font-bold text-[#e31837]">{stat.a}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-neutral-500">
          Statistics are calculated from completed BETZONE Instant Football matches.
        </p>
      </div>
    </div>
  );
}

export default function VirtualsView() {
  const [state, setState] = useState<State | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [statsFixtureId, setStatsFixtureId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const serverOffset = useRef(0);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;

    try {
      const response = await fetch("/api/virtuals/state", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not load virtual fixtures.");
        return;
      }

      serverOffset.current =
        new Date(data.serverTime).getTime() - Date.now();

      setState(data as State);
      setError(null);
    } catch {
      setError("Unable to connect to the virtual football service.");
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();

    const poll = window.setInterval(() => void refresh(), 2000);

    const clock = window.setInterval(
      () => setNow(Date.now() + serverOffset.current),
      200
    );

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const fixturesByLeague = useMemo(() => {
    const groups = new Map<string, VirtualFixture[]>();

    for (const item of state?.fixtures ?? []) {
      const list = groups.get(item.leagueKey) ?? [];
      list.push(item);
      groups.set(item.leagueKey, list);
    }

    return groups;
  }, [state?.fixtures]);

  if (error && !state) {
    return (
      <p className="panel p-6 text-center text-sm text-drop">
        {error}
      </p>
    );
  }

  if (!state) {
    return (
      <p className="panel p-6 text-center text-sm text-neutral-500">
        Loading virtual fixturesÃ¢â‚¬Â¦
      </p>
    );
  }

  if (!state.enabled) {
    return (
      <div className="panel space-y-1 p-6 text-center">
        <p className="text-sm font-semibold">
          Instant Virtuals are switched off.
        </p>
        <p className="text-xs text-neutral-500">
          They will be available when enabled by the operator.
        </p>
      </div>
    );
  }

  const playingCount = state.fixtures.filter(
    (item) => item.status === "PLAYING"
  ).length;

  return (
    <div className="space-y-3">
            <header className="panel flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setSelectedMatchId(null)} aria-label="Back to virtual matches" className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink-2 px-3 text-sm font-bold text-white hover:opacity-90">← Back to Virtuals</button>
          <h1 className="truncate text-base font-extrabold text-ink dark:text-white">
            Instant Football
          </h1>
        </div>
        <a
          href="/instant-virtual/my-bets"
          data-op="iv-bet-history-icon"
          aria-label="Instant Virtual Bet History"
          className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white hover:opacity-90"
        >
          Bet History
        </a>
      </header>

      {error && (
        <p className="rounded-lg border border-drop/30 bg-drop/10 p-3 text-sm text-drop">
          {error}
        </p>
      )}

      {LEAGUES.map((league) => {
        const items = fixturesByLeague.get(league.key) ?? [];

        return (
          <section key={league.key} className="space-y-2">
            <header className="flex items-center justify-between rounded-lg bg-ink-2 px-3 py-2 text-white">
              <div>
                <h2 className="text-sm font-extrabold">
                  {league.title}
                </h2>
                <p className="text-2xs text-white/65">
                  {league.subtitle}
                </p>
              </div>

              <span className="rounded bg-white/10 px-2 py-1 text-xs font-bold">
                {items.length} available
              </span>
            </header>

            {items.length === 0 ? (
              <p className="panel p-4 text-center text-xs text-neutral-500">
                Preparing replacement fixturesÃ¢â‚¬Â¦
              </p>
            ) : (
              <div className="space-y-2">
                {items.filter((item) => !selectedMatchId || item.fixture.id === selectedMatchId).map((item) => {
                  const fixture = item.fixture;
                  const live = item.status === "PLAYING";
                  const score = item.score ?? [0, 0];
                  const probabilityTotal =
                    (item.homeWin ?? 0) + (item.draw ?? 0) + (item.awayWin ?? 0);
                  const homePercent = probabilityTotal > 0
                    ? Math.round(((item.homeWin ?? 0) / probabilityTotal) * 100)
                    : 0;
                  const drawPercent = probabilityTotal > 0
                    ? Math.round(((item.draw ?? 0) / probabilityTotal) * 100)
                    : 0;
                  const awayPercent = probabilityTotal > 0
                    ? 100 - homePercent - drawPercent
                    : 0;

                  const elapsed = item.startedAt
                    ? Math.max(
                        0,
                        now - new Date(item.startedAt).getTime()
                      )
                    : 0;

                  const secondsRemaining = live && item.endsAt
                    ? Math.max(
                        0,
                        Math.ceil(
                          (new Date(item.endsAt).getTime() - now) / 1000
                        )
                      )
                    : 0;

                  const minute = live && item.startedAt && item.endsAt
                    ? Math.min(
                        90,
                        Math.floor(
                          (elapsed /
                            Math.max(
                              1,
                              new Date(item.endsAt).getTime() -
                                new Date(item.startedAt).getTime()
                            )) *
                            90
                        )
                      )
                    : 0;

                  const displayFixture = {
                    ...fixture,
                    markets: fixture.markets.map((market) => ({
                      ...market,
                      selections: market.selections.map((selection) => ({
                        ...selection,
                        suspended:
                          live ||
                          !fixture.bettingOpen ||
                          selection.locked,
                      })),
                    })),
                  } as Fixture;

                  const market = (id: string) =>
                    displayFixture.markets.find(
                      (entry) => entry.id === id
                    );

                  const marketRow = (id: string, label: string) => {
                    const current = market(id);
                    if (!current) return null;

                    return (
                      <div key={id} className="flex items-center gap-1">
                        <span className="w-14 shrink-0 text-2xs text-neutral-500">
                          {label}
                        </span>

                        <div className="flex min-w-0 flex-1 gap-1">
                          {current.selections.map((selection) => (
                            <OddsButton
                              key={selection.id}
                              f={displayFixture}
                              m={current}
                              s={selection}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <article
                      key={fixture.id}
                      className="panel space-y-2 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-2xs font-semibold uppercase tracking-wide text-neutral-500">
                          Fixture #{item.roundNumber}
                        </span>

                        {live ? (
                          <span className="flex items-center gap-1 text-2xs font-bold text-win-live">
                            <span className="live-dot" />
                            LIVE Ã‚Â· {minute}&apos; Ã‚Â· {secondsRemaining}s
                          </span>
                        ) : (
                          <span className="rounded bg-win/10 px-2 py-1 text-2xs font-bold text-win">
                            BETTING OPEN
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-sm font-bold">
                        <button
                          type="button"
                          onClick={() => setSelectedMatchId(fixture.id)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg p-2 text-left hover:bg-ink-2/5"
                          aria-label={`View markets for ${fixture.home} versus ${fixture.away}`}
                        >
                          <span className="min-w-0 flex-1 truncate">{fixture.home}</span>
                          {live ? (
                            <span className="shrink-0 rounded bg-ink-2 px-3 py-1 text-base font-extrabold tabular-nums text-white">
                              {score[0]} - {score[1]}
                            </span>
                          ) : (
                            <span className="shrink-0 text-neutral-400">v</span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-right">{fixture.away}</span>
                        </button>
      <button
        type="button"
        onClick={() => setStatsFixtureId(fixture.id)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#343844] bg-[#1b1e26] px-3 py-2 text-xs font-bold text-white hover:bg-[#292e39]"
      >
        <span className="text-[#27c96b]">▥</span>
        Stats - H2H
      </button>

      {statsFixtureId === fixture.id && (
        <VirtualH2HModal
          fixture={item}
          results={state.results}
          onClose={() => setStatsFixtureId(null)}
        />
      )}
                        <button
                          type="button"
                          onClick={() => setSelectedTeam(fixture.away)}
                          className="shrink-0 text-2xs font-normal text-brand hover:underline"
                        >
                          Profile
                        </button>
                      </div>
                      {!selectedMatchId && (
                        <button
                          type="button"
                          onClick={() => setSelectedMatchId(fixture.id)}
                          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-left text-xs font-bold text-brand hover:bg-brand/5"
                        >
                          View all markets â†’
                        </button>
                      )}

                      {item.homeStrength != null && item.awayStrength != null && (
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-[#101820] p-2">
                          <div>
                            <p className="text-2xs text-neutral-400">{fixture.home} strength</p>
                            <p className="text-sm font-extrabold text-white">{item.homeStrength}/99</p>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.homeStrength}%` }} />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xs text-neutral-400">{fixture.away} strength</p>
                            <p className="text-sm font-extrabold text-white">{item.awayStrength}/99</p>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div className="ml-auto h-full rounded-full bg-blue-500" style={{ width: `${item.awayStrength}%` }} />
                            </div>
                          </div>
                          {item.homeWin != null && item.draw != null && item.awayWin != null && (
                            <div className="col-span-2 border-t border-white/10 pt-2">
                              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-neutral-400">Match outcome probability</p>
                              <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                                <div className="bg-emerald-500" style={{ width: `${homePercent}%` }} />
                                <div className="bg-amber-400" style={{ width: `${drawPercent}%` }} />
                                <div className="bg-blue-500" style={{ width: `${awayPercent}%` }} />
                              </div>
                              <div className="mt-1 flex justify-between text-2xs font-semibold text-neutral-300">
                                <span>1 Â· {homePercent}%</span>
                                <span>X Â· {drawPercent}%</span>
                                <span>2 Â· {awayPercent}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {live && (
                        <div className="space-y-1 rounded-lg border border-white/10 bg-[#101820] p-2">
                          <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-white/70">
                            <span>Live virtual play</span>
                            <span className="flex items-center gap-1 text-red-400">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                              LIVE
                            </span>
                          </div>
                          <div className="relative h-24 overflow-hidden rounded-md border border-white/40 bg-[#176b42]">
                            <div className="absolute inset-y-0 left-1/2 border-l border-white/50" />
                            <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
                            <div className="absolute left-1 top-1/2 h-8 w-3 -translate-y-1/2 border border-l-0 border-white/50" />
                            <div className="absolute right-1 top-1/2 h-8 w-3 -translate-y-1/2 border border-r-0 border-white/50" />
                            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
                            <span className="absolute left-[22%] top-[28%] flex h-5 w-5 animate-bounce items-center justify-center rounded-full border-2 border-white bg-red-600 shadow-lg" style={{ animationDuration: "1.1s" }}>
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                            <span className="absolute right-[22%] top-[58%] flex h-5 w-5 animate-bounce items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-lg" style={{ animationDuration: "1.35s", animationDelay: "0.2s" }}>
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                          </div>
                          <div className="flex justify-between text-2xs font-semibold">
                            <span className="text-red-400">Ã¢â€”Â HOME</span>
                            <span className="text-blue-400">Ã¢â€”Â AWAY</span>
                          </div>
                        </div>
                      )}
                      {live && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-ink-2">
                          <div
                            className="h-full rounded-full bg-win-live transition-all"
                            style={{
                              width: `${(minute / 90) * 100}%`,
                            }}
                          />
                        </div>
                      )}

                      {selectedMatchId && (
                        <section className="space-y-3 border-t border-[var(--line)] pt-3">
                          {(() => {
                            const results = [...state.results];
                            const headToHead = results.filter(
                              (result) =>
                                (result.home === fixture.home && result.away === fixture.away) ||
                                (result.home === fixture.away && result.away === fixture.home)
                            ).slice(0, 5);

                            const recentFor = (team: string) =>
                              results.filter((result) => {
                                const isHome = result.home === team;
                                const opponent = isHome ? result.away : result.home;
                                return (isHome || result.away === team) &&
                                  opponent !== (team === fixture.home ? fixture.away : fixture.home);
                              }).slice(0, 5);

                            const homeRecent = recentFor(fixture.home);
                            const awayRecent = recentFor(fixture.away);

                            const ResultRows = ({ matches, team }: {
                              matches: VirtualResult[];
                              team: string;
                            }) => matches.length === 0 ? (
                              <p className="rounded-lg bg-ink-2/5 p-3 text-xs text-neutral-500 dark:bg-white/5">
                                No completed matches available yet.
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {matches.map((result) => (
                                  <div key={`${result.number}-${result.home}-${result.away}`} className="flex items-center justify-between gap-2 rounded-lg bg-ink-2/5 p-2 text-xs dark:bg-white/5">
                                    <span className="min-w-0 flex-1 truncate">{result.home}</span>
                                    <b className="shrink-0 tabular-nums">{result.hs} - {result.as}</b>
                                    <span className="min-w-0 flex-1 truncate text-right">{result.away}</span>
                                    <span className={`shrink-0 font-bold ${
                                      (result.home === team && result.hs > result.as) ||
                                      (result.away === team && result.as > result.hs)
                                        ? "text-win"
                                        : result.hs === result.as
                                          ? "text-amber-500"
                                          : "text-drop"
                                    }`}>
                                      {(result.home === team && result.hs > result.as) ||
                                      (result.away === team && result.as > result.hs)
                                        ? "W"
                                        : result.hs === result.as ? "D" : "L"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );

                            return (
                              <>
                                <div>
                                  <h3 className="mb-2 text-sm font-extrabold text-ink dark:text-white">
                                    Head-to-Head
                                  </h3>
                                  <p className="mb-2 text-2xs text-neutral-500">
                                    Last five completed virtual meetings between these teams
                                  </p>
                                  <ResultRows matches={headToHead} team={fixture.home} />
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <h3 className="mb-2 text-xs font-extrabold text-ink dark:text-white">
                                      {fixture.home} Â· Last 5
                                    </h3>
                                    <ResultRows matches={homeRecent} team={fixture.home} />
                                  </div>
                                  <div>
                                    <h3 className="mb-2 text-xs font-extrabold text-ink dark:text-white">
                                      {fixture.away} Â· Last 5
                                    </h3>
                                    <ResultRows matches={awayRecent} team={fixture.away} />
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </section>
                      )}
                      {selectedMatchId ? (
                        <div className="space-y-3 border-t border-[var(--line)] pt-3">
                          <h3 className="text-sm font-extrabold text-ink dark:text-white">
                            All Match Markets
                          </h3>
                          {displayFixture.markets.map((current) => (
                            <div key={current.id} className="space-y-2">
                              <h4 className="text-xs font-bold text-neutral-500">
                                {current.name}
                              </h4>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {current.selections.map((selection) => (
                                  <OddsButton
                                    key={selection.id}
                                    f={displayFixture}
                                    m={current}
                                    s={selection}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        marketRow("1x2", "1X2")
                      )}

                      <div className="border-t border-[var(--line)] pt-2">
                        <p className="text-2xs text-neutral-500">
                          {live
                            ? "This fixture is currently in progress. Its odds are suspended."
                            : "Select your odds and add them to your betslip. The match starts from your placed virtual bet ticket."}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <section className="space-y-2">
        {INSTANT_FOOTBALL_LEAGUES.map((league) => (
          <article
            key={league.id}
            className="panel flex flex-wrap items-center justify-between gap-3 p-3"
          >
            <div>
              <h2 className="text-sm font-extrabold text-ink dark:text-white">
                {league.name}
              </h2>
              <p className="text-2xs text-neutral-500">
                Football instant virtual league Ã‚Â· Matches will be added later
              </p>
            </div>

            <a
              href={league.route}
              className="rounded-md bg-brand px-4 py-2 text-xs font-extrabold text-white"
            >
              Open league
            </a>
          </article>
        ))}
      </section>

      {selectedTeam && (
        <section className="panel space-y-3 p-4">
          {(() => {
            const history = getTeamHistory(state.results, selectedTeam);
            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-2xs font-bold uppercase tracking-wider text-brand">Virtual team profile</p>
                    <h2 className="text-lg font-extrabold text-ink dark:text-white">{selectedTeam}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedTeam(null)} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold">Close</button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Played", history.played],
                    ["Wins", history.wins],
                    ["Draws", history.draws],
                    ["Losses", history.losses],
                    ["Win rate", `${history.winPercentage}%`],
                    ["Goals scored", history.goalsFor],
                    ["Goals conceded", history.goalsAgainst],
                    ["Goal difference", history.goalsFor - history.goalsAgainst],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-ink-2/5 p-3 dark:bg-white/5">
                      <p className="text-2xs text-neutral-500">{label}</p>
                      <p className="text-lg font-extrabold text-ink dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Recent virtual matches</h3>
                  {history.matches.length === 0 ? (
                    <p className="rounded-lg bg-ink-2/5 p-3 text-xs text-neutral-500 dark:bg-white/5">
                      No completed virtual matches are available for this team yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {history.matches.slice(0, 10).map((match) => (
                        <div key={`${match.number}-${match.home}-${match.away}`} className="flex items-center justify-between gap-2 rounded-lg bg-ink-2/5 p-2 text-xs dark:bg-white/5">
                          <span className="min-w-0 flex-1 truncate">{match.home}</span>
                          <b className="shrink-0 tabular-nums">{match.hs} - {match.as}</b>
                          <span className="min-w-0 flex-1 truncate text-right">{match.away}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-2xs text-neutral-500">Statistics are calculated from completed BETZONE virtual matches, not real-world club results.</p>
              </>
            );
          })()}
        </section>
      )}
      {state.results.length > 0 && (
        <section className="panel">
          <h2 className="bg-ink-2 px-3 py-2 text-xs font-bold text-white">
            Recent results
          </h2>

          {state.results.map((result) => (
            <details
              key={result.number}
              className="border-b border-[var(--line)] px-3 py-2 last:border-0"
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {result.home}{" "}
                <b className="tabular-nums">
                  {result.hs} - {result.as}
                </b>{" "}
                {result.away}
              </summary>

              <div className="mt-2">
                <Verify seed={result.seed} hash={result.seedHash} />
              </div>
            </details>
          ))}
        </section>
      )}

      <section className="panel space-y-1 p-3 text-xs text-neutral-600">
        <h2 className="font-bold text-ink dark:text-white">
          How Instant Virtual Football works
        </h2>

        <p>
          Browse fixtures, select available markets and odds, and add your
          selections to the betslip. After a virtual bet is successfully
          placed, its ticket appears in the separate Instant Virtual My Bets
          section. Kick Off is available on that ticket only. Starting a
          ticket runs the matches included in that ticket, and completed
          results are settled through the platform settlement system.
          Virtual matches cannot be cashed out or combined with other sports.
          Play responsibly. 18+.
        </p>
      </section>
    </div>
  );
}











