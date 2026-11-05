"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VirtualOddsButton from "@/components/virtuals/VirtualOddsButton";
import VirtualBetslip, { type VirtualSlipItem } from "@/components/virtuals/VirtualBetslip";
import type { Fixture, Market, Selection } from "@/types";
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
    subtitle: "20 clubs  |  10 fixtures",
  },
  {
    key: "VIRTUAL-CHAMPIONSHIP",
    title: "Championship",
    subtitle: "24 clubs  |  12 fixtures",
  },
];

const MARKET_TABS = [
  { key: "1x2", label: "1X2" },
  { key: "1up", label: "1X2 - 1UP" },
  { key: "2up", label: "1X2 - 2UP" },
  { key: "ou25", label: "O/U 2.5" },
  { key: "gg", label: "GG/NG" },
];

function getMarketForTab(
  markets: Fixture["markets"],
  key: string
) {
  if (key === "1x2") {
    return markets.find(
      (market) =>
        market.id === "1x2" ||
        /1x2|match result|full time result/i.test(market.name)
    );
  }

  const patterns: Record<string, RegExp> = {
    "1up": /1\s*up|one goal/i,
    "2up": /2\s*up|two goal/i,
    "ou25": /over.?under.*2\.5|total goals.*2\.5|2\.5/i,
    "gg": /gg\/ng|goal.?no goal|both teams to score/i,
  };

  const pattern = patterns[key];
  return pattern
    ? markets.find((market) => pattern.test(market.name))
    : undefined;
}

export default function VirtualsView() {
  const [virtualItems, setVirtualItems] = useState<VirtualSlipItem[]>([]);
  const [slipOpen, setSlipOpen] = useState(false);
  const slipCount = virtualItems.length;

  const toggleVirtualSelection = useCallback((
    f: Fixture,
    m: Market,
    s: Selection
  ) => {
    const key = `${f.id}:${m.id}:${s.id}`;

    setVirtualItems((current) => {
      if (current.some((item) => item.key === key)) {
        return current.filter((item) => item.key !== key);
      }

      const next: VirtualSlipItem = {
        key,
        oddsId: s.dbId,
        fixtureId: f.id,
        marketId: m.id,
        selectionId: s.id,
        match: `${f.home} v ${f.away}`,
        marketName: m.name,
        pick: s.label,
        odds: s.odds,
        pickedOdds: s.odds,
      };

      return [...current.filter((item) => item.fixtureId !== f.id), next];
    });
  }, []);
  const [selectedLeague, setSelectedLeague] = useState("VIRTUAL-PL");
  const [selectedMarket, setSelectedMarket] = useState("1x2");
  const [state, setState] = useState<State | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
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
        Loading virtual fixtures...
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
    <div className="mx-auto min-h-screen w-full max-w-[480px] space-y-0 bg-white pb-[88px] text-[#222]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[#e8212b] px-4 text-white shadow-sm">
        <h1 className="min-w-0 flex-1 truncate text-xl font-black italic tracking-tight">
          BET<span className="text-[#ffe14a]">ZONE</span>
          <span className="ml-2 text-base font-semibold not-italic">Instant Football</span>
        </h1>
        <a
          href="/instant-virtual/my-bets"
          data-op="iv-bet-history-icon"
          aria-label="Instant Virtual Bet History"
          className="shrink-0 rounded-lg bg-white/15 px-3 py-2 text-xs font-bold text-white"
        >
          My Bets
        </a>
      </header>

      <nav className="sticky top-14 z-20 flex overflow-x-auto bg-[#3b404c] text-white shadow-sm">
        {LEAGUES.map((league) => (
          <button
            key={league.key}
            type="button"
            onClick={() => {
              setSelectedLeague(league.key);
              setSelectedMatchId(null);
            }}
            className={`shrink-0 border-b-4 px-5 py-4 text-sm font-semibold ${
              selectedLeague === league.key
                ? "border-[#1fa24a] text-white"
                : "border-transparent text-white/70"
            }`}
          >
            {league.title}
          </button>
        ))}
      </nav>

      {!selectedMatchId && (
        <nav className="sticky top-[112px] z-10 flex overflow-x-auto border-b border-[#e5e7eb] bg-white shadow-sm">
          {MARKET_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedMarket(tab.key)}
              className={`shrink-0 border-b-2 px-4 py-3 text-xs font-extrabold transition-colors ${
                selectedMarket === tab.key
                  ? "border-[#1fa24a] text-[#17703a]"
                  : "border-transparent text-[#737985] hover:text-[#222]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {error && (
        <p className="rounded-lg border border-drop/30 bg-drop/10 p-3 text-sm text-drop">
          {error}
        </p>
      )}

      {LEAGUES.filter((league) => league.key === selectedLeague).map((league) => {
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
                Preparing replacement fixtures...
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

                        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
                          {current.selections.map((selection) => (
                            <VirtualOddsButton
                              key={selection.id}
                              f={displayFixture}
                              m={current}
                              s={selection}
                              picked={virtualItems.some((item) => item.key === `${fixture.id}:${current.id}:${selection.id}`)}
                              onToggle={toggleVirtualSelection}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <article
                      key={fixture.id}
                      className="overflow-hidden rounded-xl border border-[#e6e8ec] bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                    >
<div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-center gap-2 rounded-lg bg-[#f6f7f9] p-2">
                        <div className="min-w-0 space-y-2">
                          <button
                            type="button"
                            onClick={() => setSelectedMatchId(fixture.id)}
                            className="flex w-full min-w-0 items-center justify-between gap-1 text-left text-xs font-bold"
                            aria-label={`View markets for ${fixture.home} versus ${fixture.away}`}
                          >
                            <span className="min-w-0 truncate">{fixture.home}</span>
                            {live && (
                              <span className="shrink-0 font-extrabold tabular-nums">
                                {score[0]}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedMatchId(fixture.id)}
                            className="flex w-full min-w-0 items-center justify-between gap-1 text-left text-xs font-bold"
                          >
                            <span className="min-w-0 truncate">{fixture.away}</span>
                            {live && (
                              <span className="shrink-0 font-extrabold tabular-nums">
                                {score[1]}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedTeam(fixture.away)}
                            className="text-left text-[10px] font-semibold text-brand hover:underline"
                          >
                            Profile
                          </button>
                        </div>

                        {!selectedMatchId && (() => {
                          const current = getMarketForTab(
                            displayFixture.markets,
                            selectedMarket
                          );

                          return current ? (
                            marketRow(
                              current.id,
                              MARKET_TABS.find(
                                (tab) => tab.key === selectedMarket
                              )?.label ?? current.name
                            )
                          ) : (
                            <p className="text-center text-[10px] text-neutral-500">
                              Market unavailable
                            </p>
                          );
                        })()}
                      </div>

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
                                <span>1  |  {homePercent}%</span>
                                <span>X  |  {drawPercent}%</span>
                                <span>2  |  {awayPercent}%</span>
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
                            <span className="text-red-400">HOME</span>
                            <span className="text-blue-400">AWAY</span>
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
                                      {fixture.home}  |  Last 5
                                    </h3>
                                    <ResultRows matches={homeRecent} team={fixture.home} />
                                  </div>
                                  <div>
                                    <h3 className="mb-2 text-xs font-extrabold text-ink dark:text-white">
                                      {fixture.away}  |  Last 5
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
                              <div className="grid grid-cols-3 gap-2">
                                {current.selections.map((selection) => (
                                  <VirtualOddsButton
                                    key={selection.id}
                                    f={displayFixture}
                                    m={current}
                                    s={selection}
                                    picked={virtualItems.some((item) => item.key === `${fixture.id}:${current.id}:${selection.id}`)}
                                    onToggle={toggleVirtualSelection}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}


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

      {slipOpen && (
        <VirtualBetslip
          items={virtualItems}
          onRemove={(key) => setVirtualItems((items) => items.filter((item) => item.key !== key))}
          onClear={() => setVirtualItems([])}
          onClose={() => setSlipOpen(false)}
        />
      )}
      <div className="fixed bottom-0 left-1/2 z-40 grid h-16 w-full max-w-[480px] -translate-x-1/2 grid-cols-2 bg-[#1a1e26] shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
        <button
          type="button"
          onClick={() => {
            setSelectedMatchId(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex items-center justify-center gap-2 bg-[#232833] text-base font-bold text-white"
        >
          Matches
        </button>
        <button
          type="button"
          onClick={() => setSlipOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#1fa24a] text-base font-bold text-white"
        >
          Betslip
          {slipCount > 0 && (
            <span className="rounded-xl bg-white px-2 py-0.5 text-xs font-extrabold text-[#111]">
              {slipCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}






























