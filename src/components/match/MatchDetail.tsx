"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import OddsButton from "@/components/betslip/OddsButton";
import MarketTabs, { type Tab } from "./MarketTabs";
import HeadToHead from "./HeadToHead";
import { api } from "@/lib/api";
import { useFixtureStore } from "@/store/fixtureStore";
import { useLiveFixture } from "./useLiveFixture";
import type { Fixture } from "@/types";
import { orderMarketSelections, orderMarketsByLine } from "@/lib/marketOrder";
import { MARKET_CATEGORIES, getMarketCategory } from "@/lib/footballMarkets";

const MARKET_TABS: Tab[] = MARKET_CATEGORIES.map((category) => ({
  id: category.id,
  label: category.label,
  match: (marketId: string) =>
    category.id === "all" || getMarketCategory(marketId) === category.id,
}));

function Body({ fixture }: { fixture: Fixture }) {
  const f = useLiveFixture(fixture);
  const [activeTab, setActiveTab] = useState("all");
  const [activeSection, setActiveSection] = useState<"markets" | "stats">("markets");

  const finished = f.status === "FINISHED";

  const orderedMarkets = [
    ...f.markets.filter((market) => !market.id.startsWith("ou_")),
    ...orderMarketsByLine(f.markets.filter((market) => market.id.startsWith("ou_"))),
  ];

  const visibleMarkets = orderedMarkets.filter((market) => {
    const tab = MARKET_TABS.find((item) => item.id === activeTab);
    return tab ? tab.match(market.name) : true;
  });

  return (
    <div className="space-y-3">
      <Link href="/" className="flex w-fit items-center text-xs font-semibold text-brand">
        <ChevronLeft size={14} />
        All matches
      </Link>

      <header className="panel p-3">
        <div className="text-xs text-neutral-500">
          {f.country} · {f.league}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-base font-bold">
          <span className="min-w-0 flex-1">{f.home}</span>

          {(f.live || finished) && f.score && (
            <span className="shrink-0 tabular-nums">
              {f.score[0]} - {f.score[1]}
            </span>
          )}

          <span className="min-w-0 flex-1 text-right">{f.away}</span>
        </div>

        {finished && (
          <div className="mt-1 text-xs font-bold text-neutral-500">
            Full time
          </div>
        )}

        {f.live && (
          <div className="mt-1 text-xs font-bold text-win">
            <span className="live-dot mr-1" />
            {f.minute != null ? `${f.minute}'` : f.period ?? "Live"}
          </div>
        )}

        {f.bettingOpen === false && (
          <div className="mt-1 text-xs font-bold text-drop">
            Markets are locked for a moment.
          </div>
        )}
      </header>

      <div className="panel grid grid-cols-2 gap-2 p-2">
        <button
          type="button"
          onClick={() => setActiveSection("markets")}
          className={`rounded-lg px-4 py-3 text-sm font-bold transition ${
            activeSection === "markets"
              ? "bg-brand text-white"
              : "bg-ink-2 text-neutral-400"
          }`}
        >
          Markets
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("stats")}
          className={`rounded-lg px-4 py-3 text-sm font-bold transition ${
            activeSection === "stats"
              ? "bg-brand text-white"
              : "bg-ink-2 text-neutral-400"
          }`}
        >
          Stats
        </button>
      </div>

      {activeSection === "stats" ? (
        <HeadToHead homeTeam={f.home} awayTeam={f.away} />
      ) : (
        <>
          <div className="panel p-2">
            <MarketTabs
              tabs={MARKET_TABS}
              value={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {visibleMarkets.map((market) => (
            <section key={market.id} className="panel overflow-hidden">
              <h3 className="border-b border-line bg-ink-2 px-3 py-2 text-xs font-bold text-white">
                {market.name}
              </h3>

              <div
                className={`grid gap-2 p-2 ${
                  market.id.startsWith("ou_")
                    ? "grid-cols-2"
                    : market.id === "1x2"
                      ? "grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-3"
                }`}
              >
                {orderMarketSelections(market).map((selection) => (
                  <div key={selection.id} className="min-w-0">
                    <div className="mb-1 truncate text-center text-xs font-medium text-neutral-500">
                      {selection.label}
                    </div>

                    <div className="flex justify-center">
                      <OddsButton f={f} m={market} s={selection} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {visibleMarkets.length === 0 && (
            <p className="panel p-6 text-center text-sm text-neutral-500">
              No markets are available in this category for this match.
            </p>
          )}

          {f.markets.length === 0 && (
            <p className="panel p-6 text-center text-sm text-neutral-500">
              No markets are open for this match yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function MatchDetail({ id }: { id: string }) {
  const fixture = useFixtureStore((s) => s.fixtures.find((x) => x.id === id));
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (fixture) return;

    void api(`/api/fixtures/${id}`).then((r) => {
      if (r.ok) {
        useFixtureStore.getState().upsert(r.data.fixture);
      } else {
        setMissing(true);
      }
    });
  }, [id, fixture]);

  if (fixture) return <Body fixture={fixture} />;

  return (
    <p className="panel p-6 text-center text-sm text-neutral-500">
      {missing ? "This match is no longer available." : "Loading match…"}
    </p>
  );
}
