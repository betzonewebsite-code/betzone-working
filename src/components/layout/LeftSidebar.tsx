"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFixtureStore } from "@/store/fixtureStore";
import { useFilters } from "@/store/filterStore";
import TimeFilterTabs from "@/components/home/TimeFilterTabs";

const POPULAR = [
  { label: "English Premier League", league: "Premier League", sport: "soccer" },
  { label: "UEFA Champions League", league: "Champions League", sport: "soccer" },
  { label: "La Liga", league: "La Liga", sport: "soccer" },
  { label: "Serie A", league: "Serie A", sport: "soccer" },
  { label: "NBA", league: "NBA", sport: "basketball" },
];

const SPORTS = [
  { id: "soccer", label: "Soccer" },
  { id: "basketball", label: "Basketball" },
  { id: "tennis", label: "Tennis" },
  { id: "table-tennis", label: "Table Tennis" },
  { id: "ice-hockey", label: "Ice Hockey" },
  { id: "baseball", label: "Baseball" },
  { id: "esports", label: "eSports" },
];

function Badge({ n }: { n: number }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#F1F2F4] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#555B65]">
      {n}
    </span>
  );
}

export default function LeftSidebar() {
  const { sport, league, setSport, setLeague } = useFilters();
  const fixtures = useFixtureStore((s) => s.fixtures);
  const count = (pred: (f: (typeof fixtures)[number]) => boolean) =>
    fixtures.filter(pred).length;

  const [sportsOpen, setSportsOpen] = useState(true);

  const row = (active: boolean) =>
    `group flex w-full items-center justify-between gap-2 border-l-[3px] px-3 py-2.5 text-left text-[13px] transition-colors ${
      active
        ? "border-brand bg-[#FFF0F1] font-bold text-brand"
        : "border-transparent text-[#353941] hover:border-[#E30613] hover:bg-[#F7F7F8]"
    }`;

  return (
    <aside aria-label="Sports menu" className="space-y-3">
      <section className="panel overflow-hidden rounded-md bg-white p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#252830]">
            Match filters
          </h2>
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        </div>
        <TimeFilterTabs />
      </section>

      <section className="panel overflow-hidden rounded-md bg-white">
        <div className="flex items-center justify-between border-b border-[#E9EAED] px-3 py-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#252830]">
            Popular leagues
          </h2>
          <span className="rounded bg-[#FFF0F1] px-2 py-1 text-[10px] font-bold uppercase text-brand">
            Top
          </span>
        </div>

        <ul className="py-1">
          {POPULAR.map((p) => {
            const active = league === p.league;

            return (
              <li key={p.label}>
                <button
                  type="button"
                  aria-pressed={active}
                  className={row(active)}
                  onClick={() =>
                    setLeague(active ? null : p.league, p.sport)
                  }
                >
                  <span className="min-w-0 truncate">{p.label}</span>
                  <Badge n={count((f) => f.league === p.league)} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel overflow-hidden rounded-md bg-white">
        <button
          type="button"
          onClick={() => setSportsOpen(!sportsOpen)}
          aria-expanded={sportsOpen}
          className="flex w-full items-center justify-between border-b border-[#E9EAED] px-3 py-3 text-left"
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#252830]">
            A–Z Sports
          </span>
          <ChevronDown
            size={16}
            className={`text-[#777D86] transition-transform duration-200 ${
              sportsOpen ? "" : "-rotate-90"
            }`}
          />
        </button>

        {sportsOpen && (
          <ul className="py-1">
            {SPORTS.map((s) => {
              const active = sport === s.id && !league;

              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    className={row(active)}
                    onClick={() => setSport(s.id)}
                  >
                    <span>{s.label}</span>
                    <Badge
                      n={count((f) => (f.sport as string) === s.id)}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

