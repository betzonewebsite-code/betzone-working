"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  Star,
} from "lucide-react";

import OddsButton from "@/components/betslip/OddsButton";
import HeadToHead from "./HeadToHead";
import { api } from "@/lib/api";
import { useFixtureStore } from "@/store/fixtureStore";
import { useLiveFixture } from "./useLiveFixture";
import type { Fixture } from "@/types";
import { orderMarketSelections, orderMarketsByLine } from "@/lib/marketOrder";
import {
  MARKET_CATEGORIES,
  getMarketCategory,
} from "@/lib/footballMarkets";

type Section = "markets" | "stats";

function getTeamInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function getKickoffDetails(kickoff: string) {
  const date = new Date(kickoff);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "Match details",
      time: "Time unavailable",
    };
  }

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
  };
}

function TeamBadge({
  name,
  logo,
}: {
  name: string;
  logo?: string | null;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-full border border-neutral-200 bg-white text-xl font-extrabold text-neutral-600 shadow-sm sm:h-20 sm:w-20 sm:text-2xl">
      {logo && !failed ? (
        <img
          src={logo}
          alt={`${name} crest`}
          loading="lazy"
          className="h-12 w-12 object-contain sm:h-14 sm:w-14"
          onError={() => setFailed(true)}
        />
      ) : (
        getTeamInitials(name)
      )}
    </div>
  );
}

function MatchHeader({ fixture }: { fixture: Fixture }) {
  const finished = fixture.status?.toUpperCase() === "FINISHED";
  const kickoff = getKickoffDetails(fixture.kickoff);

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-3 sm:px-4">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-semibold text-neutral-600 transition hover:text-brand"
        >
          <ArrowLeft size={17} />
          <span>All matches</span>
        </Link>

        <div className="flex items-center gap-2">
          {fixture.live && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              Live
            </span>
          )}

          {finished && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold uppercase text-neutral-500">
              Finished
            </span>
          )}

          <button
            type="button"
            aria-label="Match information"
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      <div className="px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
        <div className="mb-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {fixture.country}
            {fixture.country && fixture.league ? " · " : ""}
            {fixture.league}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-5">
          <div className="min-w-0 text-center">
            <TeamBadge name={fixture.home} logo={fixture.homeLogo} />
            <h1 className="mt-3 break-words text-sm font-bold leading-tight text-neutral-900 sm:text-base">
              {fixture.home}
            </h1>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Home
            </p>
          </div>

          <div className="min-w-[94px] text-center sm:min-w-[120px]">
            {fixture.score && (fixture.live || finished) ? (
              <>
                <div className="text-3xl font-extrabold tabular-nums tracking-tight text-neutral-900 sm:text-4xl">
                  {fixture.score[0]}
                  <span className="mx-1.5 text-neutral-300">:</span>
                  {fixture.score[1]}
                </div>

                <div className="mt-2 text-xs font-semibold text-neutral-500">
                  {finished
                    ? "Full time"
                    : fixture.minute != null
                      ? `${fixture.minute}'`
                      : fixture.period ?? "In play"}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-extrabold tracking-wide text-neutral-800 sm:text-xl">
                  VS
                </div>
                <div className="mt-2 text-xs font-semibold text-neutral-500">
                  {kickoff.time}
                </div>
              </>
            )}

            <div className="mt-2 text-[11px] text-neutral-400">
              {kickoff.date}
            </div>
          </div>

          <div className="min-w-0 text-center">
            <TeamBadge name={fixture.away} logo={fixture.awayLogo} />
            <h2 className="mt-3 break-words text-sm font-bold leading-tight text-neutral-900 sm:text-base">
              {fixture.away}
            </h2>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Away
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Activity size={13} className={fixture.live ? "text-red-500" : "text-neutral-400"} />
            {fixture.live
              ? "Live match"
              : finished
                ? "Match completed"
                : "Pre-match"}
          </span>

          <span>
            {fixture.marketCount} markets
          </span>

          {fixture.bettingOpen === false && (
            <span className="font-semibold text-red-600">
              Betting temporarily suspended
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionNavigation({
  value,
  onChange,
}: {
  value: Section;
  onChange: (section: Section) => void;
}) {
  const items: { id: Section; label: string }[] = [
    { id: "markets", label: "Markets" },
    { id: "stats", label: "Stats" },
  ];

  return (
    <div className="flex border-b border-neutral-200 bg-white">
      {items.map((item) => {
        const active = value === item.id;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`relative flex-1 px-4 py-4 text-sm transition ${
              active
                ? "font-extrabold text-neutral-950"
                : "font-medium text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {item.label}

            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1fa24a]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function CategoryNavigation({
  value,
  onChange,
}: {
  value: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-6 overflow-x-auto border-b border-neutral-200 bg-white px-3 sm:px-4">
      {MARKET_CATEGORIES.map((category) => {
        const active = value === category.id;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.id)}
            className={`relative shrink-0 py-3 text-sm transition ${
              active
                ? "font-bold text-neutral-950"
                : "font-medium text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {category.label}

            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1fa24a]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function MarketCard({
  fixture,
  market,
  open,
  onToggle,
}: {
  fixture: Fixture;
  market: Fixture["markets"][number];
  open: boolean;
  onToggle: () => void;
}) {
  const selections = orderMarketSelections(market);

  const columns =
    selections.length === 3
      ? "grid-cols-3"
      : selections.length === 2
        ? "grid-cols-2"
        : selections.length >= 4
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-1";

  return (
    <section className="overflow-hidden border-b border-neutral-200 bg-white last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-4 text-left transition hover:bg-neutral-50 sm:px-4"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e9f5ec] text-[#1b9847]">
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm font-bold text-neutral-800">
          {market.name}
        </span>

        <span className="text-neutral-300">
          <Info size={15} />
        </span>

        <span className="text-neutral-400">
          <Star size={17} />
        </span>
      </button>

      {open && (
        <div className="px-3 pb-4 sm:px-4">
          {selections.length > 0 ? (
            <div className={`grid ${columns} gap-2`}>
              {selections.map((selection) => (
                <div
                  key={selection.id}
                  className="min-w-0 overflow-hidden rounded-md"
                >
                  <div className="mb-1 truncate text-center text-xs font-medium text-neutral-600">
                    {selection.label}
                  </div>

                  <div className="flex justify-center">
                    <OddsButton
                      f={fixture}
                      m={market}
                      s={selection}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-neutral-50 px-3 py-5 text-center text-xs text-neutral-500">
              No selections are currently available.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function MarketList({
  fixture,
  activeTab,
}: {
  fixture: Fixture;
  activeTab: string;
}) {
  const [closedMarkets, setClosedMarkets] = useState<Set<string>>(
    () => new Set()
  );

  const orderedMarkets = useMemo(() => {
    const regular = fixture.markets.filter(
      (market) => !market.id.startsWith("ou_")
    );

    const totals = orderMarketsByLine(
      fixture.markets.filter((market) => market.id.startsWith("ou_"))
    );

    return [...regular, ...totals];
  }, [fixture.markets]);

  const visibleMarkets = orderedMarkets.filter((market) => {
    return (
      activeTab === "all" ||
      getMarketCategory(market.name) === activeTab
    );
  });

  function toggleMarket(marketId: string) {
    setClosedMarkets((current) => {
      const next = new Set(current);

      if (next.has(marketId)) {
        next.delete(marketId);
      } else {
        next.add(marketId);
      }

      return next;
    });
  }

  if (fixture.markets.length === 0) {
    return (
      <div className="bg-white px-5 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <Activity size={22} />
        </div>
        <p className="text-sm font-semibold text-neutral-700">
          No markets available
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Betting markets for this match have not been published yet.
        </p>
      </div>
    );
  }

  if (visibleMarkets.length === 0) {
    return (
      <div className="bg-white px-5 py-10 text-center">
        <p className="text-sm font-semibold text-neutral-700">
          No markets in this category
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Try another market category.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      {visibleMarkets.map((market) => (
        <MarketCard
          key={market.id}
          fixture={fixture}
          market={market}
          open={!closedMarkets.has(market.id)}
          onToggle={() => toggleMarket(market.id)}
        />
      ))}
    </div>
  );
}

function Body({ fixture }: { fixture: Fixture }) {
  const f = useLiveFixture(fixture);

  const [activeTab, setActiveTab] = useState("all");
  const [activeSection, setActiveSection] = useState<Section>("markets");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 pb-6">
      <MatchHeader fixture={f} />

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <SectionNavigation
          value={activeSection}
          onChange={setActiveSection}
        />

        {activeSection === "markets" ? (
          <>
            <CategoryNavigation
              value={activeTab}
              onChange={setActiveTab}
            />

            {f.bettingOpen === false && (
              <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                Markets are temporarily suspended. You can still view the available selections.
              </div>
            )}

            <MarketList
              fixture={f}
              activeTab={activeTab}
            />
          </>
        ) : (
          <div className="p-2 sm:p-4">
            <HeadToHead
              homeTeam={f.home}
              awayTeam={f.away}
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default function MatchDetail({ id }: { id: string }) {
  const fixture = useFixtureStore((state) =>
    state.fixtures.find((item) => item.id === id)
  );

  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(!fixture);

  useEffect(() => {
    if (fixture) {
      setLoading(false);
      setMissing(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setMissing(false);

    void api(`/api/fixtures/${id}`)
      .then((response) => {
        if (cancelled) return;

        if (response.ok && response.data?.fixture) {
          useFixtureStore.getState().upsert(response.data.fixture);
        } else {
          setMissing(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, fixture]);

  if (fixture) {
    return <Body fixture={fixture} />;
  }

  return (
    <div className="panel p-8 text-center">
      {loading ? (
        <>
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-neutral-200 border-t-[#1fa24a]" />
          <p className="text-sm text-neutral-500">
            Loading match details…
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-500">
          {missing
            ? "This match is no longer available."
            : "Loading match…"}
        </p>
      )}
    </div>
  );
}
