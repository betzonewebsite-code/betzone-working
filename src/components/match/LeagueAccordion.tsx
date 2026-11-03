"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import MatchRow from "./MatchRow";
import type { Fixture } from "@/types";
import type { Tab } from "./MarketTabs";

export default function LeagueAccordion({
  country,
  league,
  fixtures,
  tab,
}: {
  country: string;
  league: string;
  fixtures: Fixture[];
  tab: Tab;
}) {
  const [open, setOpen] = useState(true);
  const sample = fixtures[0]?.markets.find((m) => tab.match(m.id));

  const dateGroups = useMemo(() => {
    const groups = new Map<string, Fixture[]>();

    for (const fixture of fixtures) {
      const date = new Date(fixture.kickoff);
      const key = Number.isNaN(date.getTime())
        ? "unknown"
        : date.toISOString().slice(0, 10);

      groups.set(key, [...(groups.get(key) ?? []), fixture]);
    }

    return [...groups.entries()];
  }, [fixtures]);

  const formatDate = (key: string) => {
    if (key === "unknown") return "Date unavailable";

    const date = new Date(`${key}T00:00:00Z`);
    const day = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      timeZone: "UTC",
    }).format(date);

    const dayMonth = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    }).format(date);

    return `${dayMonth} ${day}`;
  };

  return (
    <section className="overflow-hidden rounded-md border border-[#dfe3e8] bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 bg-[#263238] px-3 py-2 text-left text-xs text-white transition-colors hover:bg-[#34434a]"
      >
        <ChevronDown
          size={15}
          className={`shrink-0 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />

        <span className="min-w-0 flex-1 truncate font-bold tracking-wide">
          <span className="text-white/65">{country}</span>
          <span className="mx-1.5 text-white/40">/</span>
          <span className="text-white">{league}</span>
        </span>

        <span className="hidden w-[216px] shrink-0 gap-1 sm:flex">
          {(sample?.selections ?? []).map((s) => (
            <span
              key={s.id}
              className="flex-1 truncate text-center text-[10px] font-semibold uppercase tracking-wide text-white/75"
            >
              {s.label}
            </span>
          ))}
        </span>

        <span className="w-14 shrink-0" />
      </button>

      {open &&
        dateGroups.map(([dateKey, dateFixtures]) => (
          <div key={dateKey}>
            <div className="flex items-center justify-between gap-2 border-b border-[#e9eaed] bg-[#f8f9fa] px-3 py-2">
              <span className="text-[11px] font-bold text-[#555b65]">
                {formatDate(dateKey)}
              </span>

              <span className="hidden w-[216px] shrink-0 gap-1 sm:flex">
                {(sample?.selections ?? []).map((s) => (
                  <span
                    key={s.id}
                    className="flex-1 truncate text-center text-[10px] font-semibold uppercase text-[#9297a0]"
                  >
                    {s.label}
                  </span>
                ))}
              </span>

              <span className="w-14 shrink-0" />
            </div>

            {dateFixtures.map((fixture) => (
              <MatchRow key={fixture.id} fixture={fixture} tab={tab} />
            ))}
          </div>
        ))}
    </section>
  );
}
