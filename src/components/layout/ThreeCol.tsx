import type { ReactNode } from "react";
import BetSlip from "@/components/betslip/BetSlip";
import BannerCarousel from "@/components/home/BannerCarousel";
import MatchList from "@/components/match/MatchList";
import BetzoneMobileHome from "@/components/mobile/BetzoneMobileHome";
import ClientOnly from "@/components/ui/ClientOnly";
import LeftSidebar from "./LeftSidebar";

export default function ThreeCol({
  initialLive = false,
  mobileHome = false,
  children,
}: {
  initialLive?: boolean;
  mobileHome?: boolean;
  children?: ReactNode;
}) {
  return (
    <main
      className={`mx-auto grid w-full min-w-0 max-w-[1400px] grid-cols-1 overflow-x-clip lg:grid-cols-[240px_minmax(0,1fr)_340px] lg:gap-3 lg:p-3 ${
        mobileHome && !children
          ? "gap-0 p-0"
          : "gap-2 p-2 sm:gap-3 sm:p-3"
      }`}
    >
      <div className="hidden min-w-0 lg:block">
        <LeftSidebar />
      </div>

      <div className="min-w-0 w-full">
        {children ?? (
          <>
            <div className={mobileHome ? "lg:hidden" : ""}>
              <BannerCarousel />
            </div>

            <div className={mobileHome ? "lg:hidden" : ""}>
              {mobileHome ? (
                <BetzoneMobileHome />
              ) : (
                <MatchList initialLive={initialLive} />
              )}
            </div>

            <div className="hidden lg:block">
              <MatchList initialLive={initialLive} />
            </div>
          </>
        )}
      </div>

      <div className="hidden min-w-0 lg:block">
        <div className="sticky top-24">
          <ClientOnly>
            <BetSlip />
          </ClientOnly>
        </div>
      </div>
    </main>
  );
}
