"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useFixtureStore } from "@/store/fixtureStore";
import { useBetslip } from "@/store/betslipStore";
import type { Fixture, Market, Selection } from "@/types";

type Section = "today" | "highlights" | "leagues" | "live" | "tomorrow" | "all";

const NAV: { id: Section; label: string; emoji: string }[] = [
  { id: "today", label: "Today", emoji: "\u26BD" },
  { id: "highlights", label: "Highlights", emoji: "\uD83C\uDFC6" },
  { id: "leagues", label: "Leagues", emoji: "\uD83C\uDF0D" },
  { id: "live", label: "Live", emoji: "\uD83D\uDD25" },
  { id: "tomorrow", label: "Tomorrow", emoji: "\uD83D\uDCC5" },
  { id: "all", label: "All", emoji: "\uD83D\uDCCB" },
];

function dayKey(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dayKey(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function MatchCard({ fixture }: { fixture: Fixture }) {
  const toggle = useBetslip((s) => s.toggle);
  const slipItems = useBetslip((s) => s.items);
  const setSlipOpen = useBetslip((s) => s.setOpen);
  const market = fixture.markets[0];

  const time = fixture.live
    ? fixture.minute != null
      ? `${fixture.minute}'`
      : "LIVE"
    : new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(fixture.kickoff));

  function select(m: Market, selection: Selection) {
    toggle(fixture, m, selection);
    setSlipOpen(true);
  }

  return (
    <article className="border-b border-[#E9EDF0] bg-white px-3 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href={`/match/${fixture.id}`}
          className="min-w-0 truncate text-[10px] font-semibold text-[#7A838D] hover:text-[#087A3D]"
        >
          {fixture.country}
          <span className="px-1 text-[#C2C8CE]">/</span>
          {fixture.league}
        </Link>

        <div
          className={`shrink-0 text-[10px] font-extrabold tabular-nums ${
            fixture.live ? "text-[#D71920]" : "text-[#59636D]"
          }`}
        >
          {fixture.live && (
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#E32636]" />
          )}
          {time}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/match/${fixture.id}`}
          aria-label={`${fixture.home} versus ${fixture.away} - view all markets`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left active:bg-[#F5F8F6]"
        >
          <div className="min-w-0 flex-1 space-y-2">
            {[fixture.home, fixture.away].map((team, index) => (
              <div
                key={`${fixture.id}-${index}`}
                className="flex min-w-0 items-center gap-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0F3F5] text-[9px] font-extrabold text-[#53616B]">
                  {initials(team)}
                </span>

                <span className="min-w-0 truncate text-xs font-bold text-[#263238]">
                  {team}
                </span>

                {fixture.live && fixture.score && (
                  <span className="ml-auto shrink-0 text-xs font-extrabold tabular-nums text-[#263238]">
                    {fixture.score[index]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Link>

        <div className="flex w-[48%] max-w-[190px] shrink-0 items-center gap-1">
          {market?.selections.slice(0, 3).map((selection) => {
            const key = `${fixture.id}:${market.id}:${selection.id}`;
            const picked = slipItems.some((item) => item.key === key);
            const locked =
              selection.locked ||
              selection.suspended ||
              fixture.bettingOpen === false;

            return (
              <button
                key={selection.id}
                type="button"
                disabled={!!locked}
                onClick={() => select(market, selection)}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border px-1 py-2 transition ${
                  picked
                    ? "border-[#159653] bg-[#DDF4E7] text-[#087A3D]"
                    : locked
                      ? "border-[#EDF0F2] bg-[#F4F5F6] text-[#A4ABB2]"
                      : "border-[#E5EBE7] bg-[#F0F8F3] text-[#263C31] active:bg-[#DDF4E7]"
                }`}
              >
                <span className="max-w-full truncate text-[9px] font-semibold">
                  {selection.label}
                </span>
                <span className="mt-0.5 text-xs font-extrabold tabular-nums">
                  {locked ? "\u2014" : selection.odds.toFixed(2)}
                </span>
              </button>
            );
          })}

          {!market && (
            <span className="w-full text-center text-[10px] text-[#9AA2AA]">
              No odds
            </span>
          )}
        </div>
      </div>

      {market && (
        <div className="mt-2 flex justify-end">
          <Link
            href={`/match/${fixture.id}`}
            className="text-[9px] font-medium text-[#929BA3] hover:text-[#087A3D]"
          >
            {market.name} · View all markets
          </Link>
        </div>
      )}
    </article>
  );
}

export default function BetzoneMobileHome() {
  const fixtures = useFixtureStore((s) => s.fixtures);
  const loaded = useFixtureStore((s) => s.loaded);
  const connected = useFixtureStore((s) => s.connected);

  const [section, setSection] = useState<Section>("today");
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);

  const football = useMemo(
    () =>
      fixtures.filter(
        (f) =>
          f.sport === "soccer" &&
          ["SCHEDULED", "LIVE", "HALFTIME"].includes(
            f.status ?? "SCHEDULED"
          )
      ),
    [fixtures]
  );

  const leagues = useMemo(() => {
    const map = new Map<
      string,
      { country: string; league: string; count: number }
    >();

    football.forEach((f) => {
      const key = `${f.country}|${f.league}`;
      const current = map.get(key);

      map.set(key, {
        country: f.country,
        league: f.league,
        count: (current?.count ?? 0) + 1,
      });
    });

    return [...map.entries()].sort((a, b) =>
      a[1].league.localeCompare(b[1].league)
    );
  }, [football]);

  const visible = useMemo(() => {
    const today = localDay();
    const tomorrow = localDay(1);
    let list = football;

    if (section === "today") {
      list = list.filter((f) => dayKey(f.kickoff) === today);
    }

    if (section === "tomorrow") {
      list = list.filter((f) => dayKey(f.kickoff) === tomorrow);
    }

    if (section === "live") {
      list = list.filter((f) => f.live);
    }

    if (section === "highlights") {
      list = list.filter(
        (f) => !f.live && dayKey(f.kickoff) > today
      );
    }

    if (leagueFilter) {
      list = list.filter(
        (f) => `${f.country}|${f.league}` === leagueFilter
      );
    }

    return [...list]
      .sort((a, b) => {
        if (a.live !== b.live) return a.live ? -1 : 1;
        return (
          new Date(a.kickoff).getTime() -
          new Date(b.kickoff).getTime()
        );
      })
      .slice(0, 30);
  }, [football, section, leagueFilter]);

  const title =
    section === "leagues"
      ? "Football Leagues"
      : NAV.find((n) => n.id === section)?.label ?? "Today";

  return (
    <section className="block rounded-t-[22px] bg-[#F4F6F8]">
      {/* Fixed Home section navigation */}
      <nav className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-[#E8EBEF] bg-white px-2 py-2">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSection(item.id);
              setLeagueFilter(null);
            }}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold transition ${
              section === item.id
                ? "bg-[#E8F5ED] text-[#087A3D]"
                : "text-[#68737D] hover:bg-[#F5F6F7]"
            }`}
          >
            <span className="text-lg leading-5">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Instant Virtuals entry stays above the scrolling matches */}
      <Link
        href="/virtuals"
        className="mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-2xl border border-[#DCEBE2] bg-gradient-to-r from-[#E8F7EE] to-white p-3 shadow-sm transition active:scale-[0.99]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#087A3D] text-2xl text-white">
          {"\uD83C\uDFAE"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm font-extrabold text-[#173D29]">
              Instant Virtuals
            </span>
            <span>{"\u26A1"}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-[#687D70]">
            Virtual football · Fast matches · Quick results
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-[#087A3D]" />
      </Link>

      {/* Fixed heading and match count */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-extrabold text-[#263238]">
            {leagueFilter ? leagueFilter.split("|")[1] : title}
          </h2>

          <p className="mt-0.5 text-[10px] text-[#87919A]">
            {section === "live"
              ? `${football.filter((f) => f.live).length} live matches`
              : "Football"}
            {loaded && !connected ? " · Reconnecting live updates" : ""}
          </p>
        </div>

        {leagueFilter && (
          <button
            type="button"
            onClick={() => setLeagueFilter(null)}
            className="shrink-0 text-[10px] font-bold text-[#087A3D]"
          >
            All leagues
          </button>
        )}

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#68737D]">
          {section === "leagues" ? leagues.length : visible.length}
          {" "}
          {section === "leagues" ? "leagues" : "matches"}
        </span>
      </div>

      {/* Only this content area scrolls */}
      <div
        className="border-y border-[#E7EAEF] bg-white"
      >
        {section === "leagues" ? (
          <>
            {leagues.map(([key, league]) => (
              <button
                type="button"
                key={key}
                onClick={() => {
                  setLeagueFilter(key);
                  setSection("all");
                }}
                className="flex w-full items-center gap-3 border-b border-[#E7EAEF] bg-white p-3 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F3F5] text-lg">
                  {"\uD83C\uDFC6"}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold text-[#263238]">
                    {league.league}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-[#87919A]">
                    {league.country} · {league.count} matches
                  </span>
                </span>

                <ChevronRight size={17} className="text-[#A0A8AF]" />
              </button>
            ))}

            {loaded && leagues.length === 0 && (
              <p className="p-6 text-center text-xs text-[#7A838D]">
                No football leagues available.
              </p>
            )}

            {!loaded && (
              <p className="p-6 text-center text-xs text-[#68737D]">
                Loading leagues…
              </p>
            )}
          </>
        ) : !loaded ? (
          <div className="p-8 text-center text-xs font-semibold text-[#68737D]">
            Loading matches…
          </div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mb-2 text-2xl">{"\u26BD"}</div>
            <p className="text-xs font-bold text-[#263238]">
              No matches available here right now.
            </p>
            <p className="mt-1 text-[10px] text-[#87919A]">
              Try another section or check back shortly.
            </p>
          </div>
        ) : (
          visible.map((fixture) => (
            <MatchCard key={fixture.id} fixture={fixture} />
          ))
        )}
      </div>
    </section>
  );
}

