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

  return (
    <span
      key={n}
      className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-brand ring-2 ring-brand animate-badge-pop"
    >
      {n}
    </span>
  );
}

export default function BottomNav() {
  const path = usePathname();
  const setOpen = useBetslip((s) => s.setOpen);
  const liveCount = useFixtureStore(
    (s) => s.fixtures.filter((f) => f.live).length
  );

  const tab = (href: string) => {
    const active =
      href === "/" ? path === "/" : path.startsWith(href);

    return `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
      active ? "text-brand" : "text-neutral-500"
    }`;
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-[var(--line)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden"
    >
      <Link href="/" className={tab("/")}>
        <Home size={21} strokeWidth={2} />
        <span>Sports</span>
      </Link>

      <Link href="/live" className={tab("/live")}>
        <span className="relative">
          <Radio size={21} strokeWidth={2} />
          <span className="absolute -right-3 -top-1.5 min-w-4 rounded-full bg-win px-1 text-center text-[9px] font-bold text-white">
            {liveCount}
          </span>
        </span>
        <span>Live</span>
      </Link>

      <div className="flex min-w-0 flex-1 justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open bet slip"
          className="relative -mt-5 flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 border-[var(--canvas)] bg-brand text-white shadow-lg transition-transform active:scale-95"
        >
          <Ticket size={21} strokeWidth={2.2} />
          <span className="text-[10px] font-bold">Slip</span>
          <ClientOnly>
            <SlipBadge />
          </ClientOnly>
        </button>
      </div>

      <Link href="/my-bets" className={tab("/my-bets")}>
        <ListChecks size={21} strokeWidth={2} />
        <span>My Bets</span>
      </Link>

      <Link href="/me" className={tab("/me")}>
        <User size={21} strokeWidth={2} />
        <span>Me</span>
      </Link>
    </nav>
  );
}
