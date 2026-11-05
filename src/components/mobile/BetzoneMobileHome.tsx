"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronRight,
  Clock3,
  Flame,
  Globe2,
  Trophy,
  Zap,
} from "lucide-react";
import { useFixtureStore } from "@/store/fixtureStore";
import { useBetslip } from "@/store/betslipStore";
import type { Fixture, Market, Selection } from "@/types";

type Section =
  | "today"
  | "highlights"
  | "leagues"
  | "live"
  | "next3"
  | "tomorrow"
  | "all";

type FeaturedTab = "featured" | "live" | "leagues" | "virtuals";

const NAV: { id: Section; label: string; emoji: string }[] = [
  { id: "today", label: "Today", emoji: "⚽" },
  { id: "highlights", label: "Highlights", emoji: "🏆" },
  { id: "leagues", label: "Leagues", emoji: "🌍" },
  { id: "live", label: "Live", emoji: "🔥" },
  { id: "next3", label: "Next 3 Hours", emoji: "🕒" },
  { id: "tomorrow", label: "Tomorrow", emoji: "📅" },
  { id: "all", label: "All", emoji: "📋" },
];

function dayKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDay(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);

  return dayKey(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).toISOString()
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

function formatKickoff(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-extrabold text-[#263238]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[10px] text-[#87919A]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function MatchCard({
  fixture,
  marketIndex = 0,
  dark = false,
}: {
  fixture: Fixture;
  marketIndex?: number;
  dark?: boolean;
}) {
  const toggle = useBetslip((state) => state.toggle);
  const slipItems = useBetslip((state) => state.items);
  const setSlipOpen = useBetslip((state) => state.setOpen);

  const markets = fixture.markets ?? [];
  const market: Market | undefined =
    markets[marketIndex] ?? markets[0];

  const selections = market?.selections.slice(0, 3) ?? [];

  const time = fixture.live
    ? fixture.minute != null
      ? `${fixture.minute}'`
      : "LIVE"
    : formatKickoff(fixture.kickoff);

  function select(selection: Selection) {
    if (!market) return;

    toggle(fixture, market, selection);
    setSlipOpen(true);
  }

  const muted = dark ? "text-white/55" : "text-[#89939C]";
  const teamText = dark ? "text-white" : "text-[#263238]";

  return (
    <article
      className={`border-b px-3 py-3 last:border-b-0 ${
        dark
          ? "border-white/10 bg-[#17231F]"
          : "border-[#E9EDF0] bg-white"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href={`/match/${fixture.id}`}
          className={`min-w-0 truncate text-[10px] font-semibold ${
            dark
              ? "text-white/55 hover:text-white"
              : "text-[#7A838D] hover:text-[#087A3D]"
          }`}
        >
          {fixture.country}
          <span className="px-1 opacity-50">/</span>
          {fixture.league}
        </Link>

        <span
          className={`shrink-0 text-[10px] font-extrabold tabular-nums ${
            fixture.live ? "text-[#FF646B]" : muted
          }`}
        >
          {fixture.live && (
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#E32636]" />
          )}
          {time}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/match/${fixture.id}`}
          aria-label={`${fixture.home} versus ${fixture.away} - view all markets`}
          className="flex min-w-0 flex-1 items-center rounded-lg text-left"
        >
          <div className="min-w-0 flex-1 space-y-2">
            {[fixture.home, fixture.away].map((team, index) => (
              <div
                key={`${fixture.id}-${index}`}
                className="flex min-w-0 items-center gap-2"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold ${
                    dark
                      ? "bg-white/10 text-white/75"
                      : "bg-[#F0F3F5] text-[#53616B]"
                  }`}
                >
                  {initials(team)}
                </span>

                <span
                  className={`min-w-0 truncate text-xs font-bold ${teamText}`}
                >
                  {team}
                </span>

                {fixture.live && fixture.score && (
                  <span
                    className={`ml-auto shrink-0 text-xs font-extrabold tabular-nums ${teamText}`}
                  >
                    {fixture.score[index]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Link>

        <div className="flex w-[48%] max-w-[190px] shrink-0 items-center gap-1">
          {selections.length > 0 ? (
            selections.map((selection) => {
              const key = `${fixture.id}:${market?.id}:${selection.id}`;
              const picked = slipItems.some(
                (item) => item.key === key
              );

              const locked =
                selection.locked ||
                selection.suspended ||
                fixture.bettingOpen === false;

              return (
                <button
                  key={selection.id}
                  type="button"
                  disabled={!!locked}
                  onClick={() => select(selection)}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border px-1 py-2 transition ${
                    picked
                      ? "border-[#159653] bg-[#159653] text-white"
                      : locked
                        ? dark
                          ? "border-white/10 bg-white/5 text-white/30"
                          : "border-[#EDF0F2] bg-[#F4F5F6] text-[#A4ABB2]"
                        : dark
                          ? "border-white/10 bg-white/10 text-white active:bg-white/20"
                          : "border-[#E5EBE7] bg-[#F0F8F3] text-[#263C31] active:bg-[#DDF4E7]"
                  }`}
                >
                  <span className="max-w-full truncate text-[9px] font-semibold">
                    {selection.label}
                  </span>
                  <span className="mt-0.5 text-xs font-extrabold tabular-nums">
                    {locked ? "—" : selection.odds.toFixed(2)}
                  </span>
                </button>
              );
            })
          ) : (
            <span className={`w-full text-center text-[10px] ${muted}`}>
              No odds
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`truncate text-[9px] ${muted}`}>
          {market?.name ?? "Markets"}
        </span>

        <Link
          href={`/match/${fixture.id}`}
          className={`shrink-0 text-[9px] font-semibold ${
            dark
              ? "text-[#A7DDBB] hover:text-white"
              : "text-[#087A3D] hover:text-[#075D30]"
          }`}
        >
          View all markets
          <ChevronRight className="ml-0.5 inline-block" size={11} />
        </Link>
      </div>
    </article>
  );
}

export default function BetzoneMobileHome() {
  const fixtures = useFixtureStore((state) => state.fixtures);
  const loaded = useFixtureStore((state) => state.loaded);
  const connected = useFixtureStore((state) => state.connected);

  const slipItems = useBetslip((state) => state.items);
  const setSlipOpen = useBetslip((state) => state.setOpen);

  const [section, setSection] = useState<Section>("today");
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);
  const [featuredTab, setFeaturedTab] =
    useState<FeaturedTab>("featured");
  const [marketIndex, setMarketIndex] = useState(0);

  const football = useMemo(
    () =>
      fixtures.filter(
        (fixture) =>
          fixture.sport === "soccer" &&
          ["SCHEDULED", "LIVE", "HALFTIME"].includes(
            fixture.status ?? "SCHEDULED"
          )
      ),
    [fixtures]
  );

  const liveFixtures = useMemo(
    () =>
      [...football]
        .filter((fixture) => fixture.live)
        .sort(
          (a, b) =>
            new Date(a.kickoff).getTime() -
            new Date(b.kickoff).getTime()
        ),
    [football]
  );

  const leagues = useMemo(() => {
    const map = new Map<
      string,
      { country: string; league: string; count: number }
    >();

    football.forEach((fixture) => {
      const key = `${fixture.country}|${fixture.league}`;
      const current = map.get(key);

      map.set(key, {
        country: fixture.country,
        league: fixture.league,
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
    const now = Date.now();

    let list = football;

    if (section === "today") {
      list = list.filter(
        (fixture) => dayKey(fixture.kickoff) === today
      );
    } else if (section === "tomorrow") {
      list = list.filter(
        (fixture) => dayKey(fixture.kickoff) === tomorrow
      );
    } else if (section === "live") {
      list = list.filter((fixture) => fixture.live);
    } else if (section === "highlights") {
      list = list.filter(
        (fixture) =>
          fixture.live ||
          new Date(fixture.kickoff).getTime() >= now
      );
    } else if (section === "next3") {
      list = list.filter((fixture) => {
        const kickoff = new Date(fixture.kickoff).getTime();
        return (
          kickoff >= now &&
          kickoff <= now + 3 * 60 * 60 * 1000
        );
      });
    }

    if (leagueFilter) {
      list = list.filter(
        (fixture) =>
          `${fixture.country}|${fixture.league}` === leagueFilter
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
      .slice(0, 40);
  }, [football, section, leagueFilter]);

  const marketNames = useMemo(() => {
    const source = visible[0] ?? liveFixtures[0] ?? football[0];

    return (source?.markets ?? []).map((market) => market.name);
  }, [visible, liveFixtures, football]);

  const championsLeague = leagues.find(([, league]) =>
    /champions league/i.test(league.league)
  );

  const europaLeague = leagues.find(([, league]) =>
    /europa league/i.test(league.league)
  );

  const title =
    section === "leagues"
      ? "Football Leagues"
      : NAV.find((item) => item.id === section)?.label ?? "Today";

  function changeSection(next: Section) {
    setSection(next);
    setLeagueFilter(null);
  }

  function openLeague(key: string) {
    setLeagueFilter(key);
    setSection("all");
  }

  function chooseFeatured(tab: FeaturedTab) {
    setFeaturedTab(tab);

    if (tab === "live") changeSection("live");
    if (tab === "leagues") changeSection("leagues");
  }

  return (
    <section className="block w-full overflow-hidden rounded-t-[20px] bg-[#F3F5F6] pb-3">
      {/* Sports shortcuts */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto bg-white px-3 py-3">
        <button
          type="button"
          onClick={() => changeSection("today")}
          className="flex min-w-[76px] flex-col items-center gap-1 rounded-xl bg-[#EAF5EE] px-3 py-2 text-[#087A3D]"
        >
          <span className="text-xl">⚽</span>
          <span className="text-[10px] font-extrabold">Football</span>
        </button>

        <button
          type="button"
          onClick={() => changeSection("live")}
          className="flex min-w-[76px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[#52616B] active:bg-[#F2F5F3]"
        >
          <Flame size={21} className="text-[#E33B42]" />
          <span className="text-[10px] font-bold">Live</span>
        </button>

        <button
          type="button"
          onClick={() => changeSection("next3")}
          className="flex min-w-[76px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[#52616B] active:bg-[#F2F5F3]"
        >
          <Clock3 size={21} />
          <span className="text-[10px] font-bold">Next 3 Hours</span>
        </button>

        <button
          type="button"
          onClick={() => changeSection("leagues")}
          className="flex min-w-[76px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[#52616B] active:bg-[#F2F5F3]"
        >
          <Globe2 size={21} />
          <span className="text-[10px] font-bold">Leagues</span>
        </button>

        <Link
          href="/virtuals"
          className="flex min-w-[76px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[#52616B] active:bg-[#F2F5F3]"
        >
          <Zap size={21} className="text-[#087A3D]" />
          <span className="text-[10px] font-bold">Virtuals</span>
        </Link>

        <button
          type="button"
          onClick={() => changeSection("all")}
          className="flex min-w-[76px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[#52616B] active:bg-[#F2F5F3]"
        >
          <Trophy size={21} />
          <span className="text-[10px] font-bold">All Matches</span>
        </button>
      </div>

      {/* Quick links */}
      <div className="no-scrollbar flex items-center gap-5 overflow-x-auto border-y border-[#EDF0F2] bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => changeSection("all")}
          className="shrink-0 text-[11px] font-bold text-[#263238]"
        >
          All Sports
        </button>
        <button
          type="button"
          onClick={() => changeSection("live")}
          className="shrink-0 text-[11px] font-bold text-[#D71920]"
        >
          Live
        </button>
        <Link
          href="/virtuals"
          className="shrink-0 text-[11px] font-bold text-[#087A3D]"
        >
          Virtuals
        </Link>
        <Link
          href="/virtuals"
          className="shrink-0 text-[11px] font-bold text-[#263238]"
        >
          Instant Games
        </Link>
        <button
          type="button"
          onClick={() => changeSection("leagues")}
          className="shrink-0 text-[11px] font-bold text-[#263238]"
        >
          More Leagues
        </button>
      </div>

      {/* Football promotion shortcuts */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
        <button
          type="button"
          onClick={() => changeSection("today")}
          className="flex min-w-[155px] items-center gap-2 rounded-xl bg-[#087A3D] px-3 py-3 text-left text-white"
        >
          <span className="text-xl">⚽</span>
          <span>
            <span className="block text-[11px] font-extrabold">
              Today&apos;s Football
            </span>
            <span className="mt-0.5 block text-[9px] text-white/75">
              Today&apos;s fixtures
            </span>
          </span>
          <ChevronRight size={15} className="ml-auto shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => changeSection("next3")}
          className="flex min-w-[155px] items-center gap-2 rounded-xl bg-[#263C32] px-3 py-3 text-left text-white"
        >
          <Clock3 size={20} />
          <span>
            <span className="block text-[11px] font-extrabold">
              Next 3 Hours
            </span>
            <span className="mt-0.5 block text-[9px] text-white/75">
              Upcoming matches
            </span>
          </span>
          <ChevronRight size={15} className="ml-auto shrink-0" />
        </button>

        {championsLeague && (
          <button
            type="button"
            onClick={() => openLeague(championsLeague[0])}
            className="flex min-w-[155px] items-center gap-2 rounded-xl bg-[#182A50] px-3 py-3 text-left text-white"
          >
            <Trophy size={20} />
            <span>
              <span className="block text-[11px] font-extrabold">
                Champions League
              </span>
              <span className="mt-0.5 block text-[9px] text-white/75">
                View fixtures
              </span>
            </span>
            <ChevronRight size={15} className="ml-auto shrink-0" />
          </button>
        )}

        {europaLeague && (
          <button
            type="button"
            onClick={() => openLeague(europaLeague[0])}
            className="flex min-w-[155px] items-center gap-2 rounded-xl bg-[#8A4A16] px-3 py-3 text-left text-white"
          >
            <Trophy size={20} />
            <span>
              <span className="block text-[11px] font-extrabold">
                Europa League
              </span>
              <span className="mt-0.5 block text-[9px] text-white/75">
                View fixtures
              </span>
            </span>
            <ChevronRight size={15} className="ml-auto shrink-0" />
          </button>
        )}
      </div>

      {/* Featured navigation */}
      <div className="border-y border-[#E8EBEF] bg-white">
        <div className="no-scrollbar flex gap-6 overflow-x-auto px-4">
          {(
            [
              ["featured", "Featured"],
              ["live", "Live"],
              ["leagues", "Leagues"],
              ["virtuals", "Virtuals"],
            ] as [FeaturedTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                chooseFeatured(id);
                if (id === "featured") changeSection("today");
                if (id === "virtuals") {
                  window.location.href = "/virtuals";
                }
              }}
              className={`shrink-0 border-b-[3px] px-1 py-3 text-xs font-extrabold ${
                featuredTab === id
                  ? "border-[#087A3D] text-[#087A3D]"
                  : "border-transparent text-[#7A838D]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured category chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto bg-white px-3 pb-3">
        {NAV.filter((item) =>
          ["today", "next3", "live", "tomorrow", "all"].includes(item.id)
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => changeSection(item.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold ${
              section === item.id
                ? "border-[#087A3D] bg-[#087A3D] text-white"
                : "border-[#E5E9EC] bg-white text-[#59636D]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Instant Virtuals entry */}
      <Link
        href="/virtuals"
        className="mx-3 my-3 flex items-center gap-3 rounded-2xl border border-[#DCEBE2] bg-gradient-to-r from-[#E8F7EE] to-white p-3 shadow-sm transition active:scale-[0.99]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#087A3D] text-2xl text-white">
          🎮
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm font-extrabold text-[#173D29]">
              Instant Virtuals
            </span>
            <span>⚡</span>
          </div>
          <p className="mt-0.5 text-[10px] text-[#687D70]">
            Virtual football · Fast matches · Quick results
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-[#087A3D]" />
      </Link>

      {/* Live sports panel */}
      <section className="mx-3 overflow-hidden rounded-xl bg-[#17231F]">
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#F04450]" />
            <h2 className="text-sm font-extrabold text-white">LIVE NOW</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white/70">
              {liveFixtures.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => changeSection("live")}
            className="text-[10px] font-bold text-[#A7DDBB]"
          >
            All live matches <ChevronRight className="inline" size={12} />
          </button>
        </div>

        <div className="flex gap-2 px-3 pb-3">
          <span className="rounded-full bg-[#087A3D] px-3 py-1.5 text-[10px] font-bold text-white">
            ⚽ Football
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/60">
            Basketball
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/60">
            Tennis
          </span>
        </div>

        {marketNames.length > 0 && (
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-y border-white/10 px-3 py-2">
            {marketNames.map((name, index) => (
              <button
                key={`${name}-${index}`}
                type="button"
                onClick={() => setMarketIndex(index)}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-[9px] font-bold ${
                  marketIndex === index
                    ? "bg-white text-[#17231F]"
                    : "bg-white/10 text-white/65"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {liveFixtures.length > 0 ? (
          liveFixtures.slice(0, 5).map((fixture) => (
            <MatchCard
              key={fixture.id}
              fixture={fixture}
              marketIndex={marketIndex}
              dark
            />
          ))
        ) : (
          <div className="px-4 py-7 text-center">
            <p className="text-xs font-bold text-white">
              No live football matches right now.
            </p>
            <p className="mt-1 text-[10px] text-white/50">
              Check the upcoming fixtures below.
            </p>
          </div>
        )}
      </section>

      {/* Match centre */}
      <section className="mt-3 overflow-hidden rounded-t-xl border-y border-[#E7EAEF] bg-white">
        <SectionHeading
          title="Match Centre"
          subtitle={
            loaded
              ? `${visible.length} matches available`
              : "Loading football fixtures"
          }
          action={
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${
                connected
                  ? "bg-[#E8F5ED] text-[#087A3D]"
                  : "bg-[#FFF4E5] text-[#A56A16]"
              }`}
            >
              {connected ? "Live updates" : "Connecting"}
            </span>
          }
        />

        <div className="no-scrollbar flex gap-5 overflow-x-auto border-y border-[#EDF0F2] px-3">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changeSection(item.id)}
              className={`shrink-0 border-b-2 py-3 text-[11px] font-bold ${
                section === item.id
                  ? "border-[#087A3D] text-[#087A3D]"
                  : "border-transparent text-[#78838C]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {marketNames.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto bg-[#F8FAF9] px-3 py-2">
            {marketNames.map((name, index) => (
              <button
                key={`${name}-${index}`}
                type="button"
                onClick={() => setMarketIndex(index)}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-[9px] font-bold ${
                  marketIndex === index
                    ? "border-[#087A3D] bg-[#E8F5ED] text-[#087A3D]"
                    : "border-[#E5E9EC] bg-white text-[#65717A]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 bg-[#F8FAF9] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#59636D]">
            <Trophy size={13} className="text-[#087A3D]" />
            {leagueFilter
              ? leagueFilter.split("|")[1]
              : section === "leagues"
                ? "Football Leagues"
                : title}
          </div>

          {leagueFilter && (
            <button
              type="button"
              onClick={() => setLeagueFilter(null)}
              className="text-[10px] font-bold text-[#087A3D]"
            >
              Clear filter
            </button>
          )}

          <span className="text-[10px] text-[#89939C]">
            {section === "leagues" ? leagues.length : visible.length}{" "}
            {section === "leagues" ? "leagues" : "matches"}
          </span>
        </div>

        {section === "leagues" ? (
          <>
            {leagues.map(([key, league]) => (
              <button
                type="button"
                key={key}
                onClick={() => openLeague(key)}
                className="flex w-full items-center gap-3 border-b border-[#E7EAEF] bg-white p-3 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F3F5] text-lg">
                  🏆
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
              <p className="p-7 text-center text-xs text-[#7A838D]">
                No football leagues available.
              </p>
            )}
          </>
        ) : !loaded ? (
          <div className="p-8 text-center text-xs font-semibold text-[#68737D]">
            Loading matches…
          </div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mb-2 text-2xl">⚽</div>
            <p className="text-xs font-bold text-[#263238]">
              No matches available here right now.
            </p>
            <p className="mt-1 text-[10px] text-[#87919A]">
              Try another section or check back shortly.
            </p>
          </div>
        ) : (
          visible.map((fixture) => (
            <MatchCard
              key={fixture.id}
              fixture={fixture}
              marketIndex={marketIndex}
            />
          ))
        )}
      </section>

      {/* League shortcuts */}
      {leagues.length > 0 && (
        <section className="mt-3 overflow-hidden rounded-xl border border-[#E7EAEF] bg-white">
          <SectionHeading
            title="Popular Football Leagues"
            subtitle="Browse competitions and fixtures"
            action={
              <button
                type="button"
                onClick={() => changeSection("leagues")}
                className="shrink-0 text-[10px] font-bold text-[#087A3D]"
              >
                View all
              </button>
            }
          />

          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-3">
            {leagues.slice(0, 10).map(([key, league]) => (
              <button
                key={key}
                type="button"
                onClick={() => openLeague(key)}
                className="min-w-[145px] rounded-lg border border-[#E8ECEF] bg-[#FAFBFB] p-3 text-left"
              >
                <span className="block truncate text-[11px] font-extrabold text-[#263238]">
                  {league.league}
                </span>
                <span className="mt-1 block text-[9px] text-[#89939C]">
                  {league.country} · {league.count} matches
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Betslip quick access */}
      {slipItems.length > 0 && (
        <button
          type="button"
          onClick={() => setSlipOpen(true)}
          className="fixed bottom-[76px] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-[#087A3D] px-4 text-white shadow-xl"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            🎟️
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E32636] px-1 text-[9px] font-extrabold text-white">
              {slipItems.length}
            </span>
          </span>
          <span className="text-xs font-extrabold">Bet Slip</span>
          <ChevronRight size={17} />
        </button>
      )}
    </section>
  );
}
