import type { ReactNode } from "react";
import BetSlip from "@/components/betslip/BetSlip";
import BannerCarousel from "@/components/home/BannerCarousel";
import QuickActions from "@/components/home/QuickActions";
import TimeFilterTabs from "@/components/home/TimeFilterTabs";
import MatchList from "@/components/match/MatchList";
import ClientOnly from "@/components/ui/ClientOnly";
import LeftSidebar from "./LeftSidebar";

/** Desktop: sidebar | content | sticky slip. Mobile: content only (slip lives in the bottom sheet). */
export default function ThreeCol({ initialLive = false, children }: { initialLive?: boolean; children?: ReactNode }) {
  return (
    <main className="mx-auto grid max-w-[1400px] gap-3 p-2 lg:grid-cols-[240px_minmax(0,1fr)_340px] lg:p-3">
      <div className="hidden lg:block"><LeftSidebar /></div>
      <div className="min-w-0 space-y-3">
        {children ?? (
          <>
            <div className="lg:hidden"><QuickActions /></div>
            <BannerCarousel />
            <div className="lg:hidden"><TimeFilterTabs /></div>
            <MatchList initialLive={initialLive} />
          </>
        )}
      </div>
      <div className="hidden lg:block"><div className="sticky top-24"><ClientOnly><BetSlip /></ClientOnly></div></div>
    </main>
  );
}
