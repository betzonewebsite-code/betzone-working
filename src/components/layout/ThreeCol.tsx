import type { ReactNode } from "react";
import BetSlip from "@/components/betslip/BetSlip";
import BannerCarousel from "@/components/home/BannerCarousel";
import QuickActions from "@/components/home/QuickActions";
import TimeFilterTabs from "@/components/home/TimeFilterTabs";
import MatchList from "@/components/match/MatchList";
import ClientOnly from "@/components/ui/ClientOnly";
import LeftSidebar from "./LeftSidebar";

export default function ThreeCol({ initialLive = false, children }: { initialLive?: boolean; children?: ReactNode }) {
  return (
    <main className="mx-auto grid w-full min-w-0 max-w-[1400px] grid-cols-1 gap-2 overflow-x-clip p-2 sm:gap-3 sm:p-3 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
      <div className="hidden min-w-0 lg:block"><LeftSidebar /></div>
      <div className="min-w-0 w-full space-y-3">
        {children ?? (
          <>
            <div className="lg:hidden"><QuickActions /></div>
            <BannerCarousel />
            <div className="lg:hidden"><TimeFilterTabs /></div>
            <MatchList initialLive={initialLive} />
          </>
        )}
      </div>
      <div className="hidden min-w-0 lg:block"><div className="sticky top-24"><ClientOnly><BetSlip /></ClientOnly></div></div>
    </main>
  );
}
