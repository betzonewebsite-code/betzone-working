"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListChecks, Radio, Ticket, User } from "lucide-react";
import ClientOnly from "@/components/ui/ClientOnly";
import { useBetslip } from "@/store/betslipStore";
import { useFixtureStore } from "@/store/fixtureStore";


function SlipBadge() {
  const n = useBetslip((s) => s.items.length);
  if (!n) return null;
  return <span key={n} className="absolute -right-1 -top-1 min-w-5 animate-badge-pop rounded-full bg-white px-1 text-center text-xs font-bold text-brand ring-2 ring-brand">{n}</span>;
}

export default function BottomNav() {
  const path = usePathname();
  const setOpen = useBetslip((s) => s.setOpen);
  const liveCount = useFixtureStore((s) => s.fixtures.filter((f) => f.live).length);
  const tab = (href: string) => `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-2xs font-semibold ${(href === "/" ? path === "/" : path.startsWith(href)) ? "text-brand" : "text-neutral-500"}`;

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-[var(--line)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] lg:hidden">
      <Link href="/" className={tab("/")}><Home size={20} />Sports</Link>
      <Link href="/live" className={tab("/live")}>
        <span className="relative"><Radio size={20} /><span className="absolute -right-3 -top-1.5 rounded-full bg-win px-1 text-2xs font-bold text-white">{liveCount}</span></span>Live
      </Link>
      <div className="flex flex-1 justify-center">
        <button onClick={() => setOpen(true)} aria-label="Open bet slip"
          className="relative -mt-5 flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 border-[var(--canvas)] bg-brand text-white shadow-lg">
          <Ticket size={20} /><span className="text-2xs font-bold">Slip</span>
          <ClientOnly><SlipBadge /></ClientOnly>
        </button>
      </div>
      <Link href="/my-bets" className={tab("/my-bets")}><ListChecks size={20} />My Bets</Link>
      <Link href="/me" className={tab("/me")}><User size={20} />Me</Link>
    </nav>
  );
}
