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
    <div className="grid w-full min-w-0 grid-cols-[36px_minmax(0,1fr)_minmax(132px,46%)] items-center gap-x-1.5 border-t border-[#edf0f2] bg-white px-2 py-2 transition-colors hover:bg-[#f8faf9] sm:flex sm:min-h-[66px] sm:gap-2 sm:px-3 sm:py-2">
      <div
        className="flex items-center justify-center text-center text-[10px] font-medium sm:w-12 sm:shrink-0 sm:text-[11px]"
        suppressHydrationWarning
      >
        {f.live ? (
          <span className="whitespace-nowrap font-bold text-[#e30613]">
            <span className="live-dot mr-1" />
            {f.minute}&apos;
          </span>
        ) : (
          <span className="whitespace-nowrap text-[#7b858c]">
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
        className="flex min-w-0 flex-col justify-center gap-1 text-[11px] leading-tight text-[#263238] hover:text-[#e30613] sm:flex-1 sm:gap-1 sm:text-[13px]"
      >
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-semibold">{f.home}</span>
          {f.live && (
            <b className="shrink-0 text-[11px] font-extrabold tabular-nums text-[#263238] sm:text-sm">
              {f.score?.[0]}
            </b>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-medium text-[#657078]">{f.away}</span>
          {f.live && (
            <b className="shrink-0 text-[11px] font-extrabold tabular-nums text-[#263238] sm:text-sm">
              {f.score?.[1]}
            </b>
          )}
        </div>
      </Link>

      <div className="grid w-full min-w-0 grid-cols-3 gap-1 sm:flex sm:w-[216px] sm:shrink-0 sm:gap-1.5 [&>*]:!min-w-0 [&>*]:!w-full">
        {market
          ? orderMarketSelections(market).map((s) => (
              <OddsButton key={s.id} f={f} m={market} s={s} />
            ))
          : Array.from({ length: cols }).map((_, i) => (
              <span key={i} className="odds-btn flex min-w-0 items-center justify-center rounded-lg text-neutral-400">
                –
              </span>
            ))}
      </div>

      <Link
        href={`/match/${f.id}`}
        className="hidden items-center justify-end gap-0.5 text-[10px] font-bold text-[#e30613] hover:text-[#b8000b] sm:flex sm:w-14 sm:shrink-0 sm:text-[11px]"
        aria-label={`All ${f.marketCount} markets`}
      >
        +{f.marketCount}
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}
