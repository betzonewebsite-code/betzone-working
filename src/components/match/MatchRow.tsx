"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import OddsButton from "@/components/betslip/OddsButton";
import { useLiveFixture } from "./useLiveFixture";
import type { Fixture } from "@/types";
import type { Tab } from "./MarketTabs";
import { orderMarketSelections } from "@/lib/marketOrder";

export default function MatchRow({
  fixture,
  tab,
}: {
  fixture: Fixture;
  tab: Tab;
}) {
  const f = useLiveFixture(fixture);
  const market = f.markets.find((m) => tab.match(m.id));
  const cols = 3;

  return (
    <div className="flex min-h-[66px] items-center gap-2 border-t border-[#edf0f2] bg-white px-3 py-2 transition-colors hover:bg-[#f8faf9]">
      <div
        className="w-12 shrink-0 text-center text-[11px] font-medium"
        suppressHydrationWarning
      >
        {f.live ? (
          <span className="font-bold text-[#e30613]">
            <span className="live-dot mr-1" />
            {f.minute}&apos;
          </span>
        ) : (
          <span className="text-[#7b858c]">
            {new Date(f.kickoff).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
              hour12: true,
            })}
          </span>
        )}
      </div>

      <Link
        href={`/match/${f.id}`}
        className="min-w-0 flex-1 space-y-1 text-[13px] leading-tight text-[#263238] hover:text-[#e30613]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{f.home}</span>
          {f.live && (
            <b className="min-w-4 text-right text-sm font-extrabold tabular-nums text-[#263238]">
              {f.score?.[0]}
            </b>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-[#657078]">{f.away}</span>
          {f.live && (
            <b className="min-w-4 text-right text-sm font-extrabold tabular-nums text-[#263238]">
              {f.score?.[1]}
            </b>
          )}
        </div>
      </Link>

      <div className="flex w-[216px] shrink-0 gap-1.5">
        {market
          ? orderMarketSelections(market).map((s) => (
              <OddsButton key={s.id} f={f} m={market} s={s} />
            ))
          : Array.from({ length: cols }).map((_, i) => (
              <span
                key={i}
                className="odds-btn text-neutral-400"
                aria-hidden="true"
              >
                –
              </span>
            ))}
      </div>

      <Link
        href={`/match/${f.id}`}
        className="flex w-14 shrink-0 items-center justify-end gap-0.5 text-[11px] font-bold text-[#e30613] hover:text-[#b8000b]"
        aria-label={`All ${f.marketCount} markets`}
      >
        +{f.marketCount}
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

