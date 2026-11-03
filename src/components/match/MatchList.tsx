"use client";

import { useMemo, useState } from "react";
import { inWindow, useFilters } from "@/store/filterStore";
import { useFixtureStore } from "@/store/fixtureStore";
import MarketTabs, { BASKET_TABS, SOCCER_TABS } from "./MarketTabs";
import LeagueAccordion from "./LeagueAccordion";

const ACTIVE = ["SCHEDULED", "LIVE", "HALFTIME"];

const SPORT_LABELS: Record<string, string> = {
  soccer: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  "table-tennis": "Table Tennis",
  "ice-hockey": "Ice Hockey",
  baseball: "Baseball",
  esports: "eSports",
};

export default function MatchList({
  initialLive = false,
}: {
  initialLive?: boolean;
}) {
  const { sport, league, time, query, reset } = useFilters();
  const fixtures = useFixtureStore((s) => s.fixtures);
  const loaded = useFixtureStore((s) => s.loaded);
  const connected = useFixtureStore((s) => s.connected);

  const allTabs = sport === "soccer" ? SOCCER_TABS : BASKET_TABS;
  const [tabId, setTabId] = useState(allTabs[0].id);
  const [liveOnly, setLiveOnly] = useState(initialLive);

  const inSport = useMemo(
    () =>
      fixtures.filter(
        (f) =>
          f.sport === sport &&
          ACTIVE.includes(f.status ?? "SCHEDULED")
      ),
    [fixtures, sport]
  );

  const liveCount = inSport.filter((f) => f.live).length;

  const tabs = useMemo(() => {
    const available = allTabs.filter((x) =>
      inSport.some((f) => f.markets.some((m) => x.match(m.id)))
    );

    return available.length ? available : allTabs.slice(0, 1);
  }, [allTabs, inSport]);

  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = inSport.filter(
      (f) =>
        (!liveOnly || f.live) &&
        (!league || f.league === league) &&
        inWindow(f, time) &&
        (!q ||
          [f.home, f.away, f.league, f.country].some((x) =>
            x.toLowerCase().includes(q)
          ))
    );

    const map = new Map<string, typeof list>();

    for (const f of list) {
      const key = `${f.country}|${f.league}`;
      map.set(key, [...(map.get(key) ?? []), f]);
    }

    return [...map.entries()];
  }, [inSport, league, time, query, liveOnly]);

  const matchCount = groups.reduce(
    (total, [, groupFixtures]) => total + groupFixtures.length,
    0
  );

  const sportLabel = SPORT_LABELS[sport] ?? sport;

  return (
    <section className="space-y-3">
      <div className="panel overflow-hidden rounded-md bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E9EAED] px-3 py-3">
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-[#252830]">
              {liveOnly ? "Live " : ""}{sportLabel} Matches
            </h1>
            <p className="mt-0.5 text-[11px] text-[#777D86]">
              {league ? league : "All available competitions"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-[#F1F2F4] px-2 py-1 text-[11px] font-bold tabular-nums text-[#555B65]">
              {loaded ? matchCount : "..."} Matches
            </span>

            <button
              type="button"
              onClick={() => setLiveOnly(!liveOnly)}
              aria-pressed={liveOnly}
              className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-2 text-xs font-extrabold transition-colors ${
                liveOnly
                  ? "bg-[#168B48] text-white"
                  : "bg-[#252830] text-white hover:bg-[#3A3E47]"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  liveOnly ? "bg-white" : "bg-[#35D477]"
                }`}
              />
              LIVE
              <span className="rounded bg-white/15 px-1.5 py-0.5 tabular-nums">
                {liveCount}
              </span>
            </button>
          </div>
        </div>

        <div className="bg-[#F8F9FA] p-2">
          <MarketTabs tabs={tabs} value={tab.id} onChange={setTabId} />
        </div>
      </div>

      {loaded && !connected && (
        <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          Live updates are reconnecting. Odds shown may be a few seconds old.
        </div>
      )}

      {!loaded && (
        <div className="panel rounded-md p-8 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-brand" />
          <p className="text-sm font-semibold text-[#555B65]">
            Loading matches...
          </p>
          <p className="mt-1 text-xs text-[#9297A0]">
            Fetching available fixtures and markets
          </p>
        </div>
      )}

      {loaded && groups.length === 0 && (
        <div className="panel rounded-md p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F2F4] text-xl">
            <span aria-hidden="true">⚽</span>
          </div>

          <p className="text-sm font-bold text-[#252830]">
            {inSport.length === 0
              ? "No matches for this sport right now."
              : "No matches fit these filters."}
          </p>

          <p className="mt-1 text-xs text-[#777D86]">
            Try another competition or clear your current filters.
          </p>

          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-dark"
          >
            Clear filters
          </button>
        </div>
      )}

      {groups.map(([key, groupFixtures]) => {
        const [country, lg] = key.split("|");

        return (
          <div key={key} className="overflow-hidden rounded-md">
            <LeagueAccordion
              country={country}
              league={lg}
              fixtures={groupFixtures}
              tab={tab}
            />
          </div>
        );
      })}
    </section>
  );
}
