"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { label: "Home", href: "/" },
  { label: "Live Betting", href: "/live" },
  { label: "Instant Virtuals", href: "/virtuals" },
  { label: "Scheduled Virtuals", href: "/scheduled-virtuals" },
  { label: "Jackpot", href: "/jackpot" },
  { label: "Games", href: "/games" },
  { label: "Zone Hero / Feed", href: "/feed" },
  { label: "Promotions", href: "/promotions" },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav
      aria-label="Main"
      className="hidden border-b border-white/10 bg-[#202020] lg:block"
    >
      <ul className="no-scrollbar mx-auto flex h-11 max-w-[1400px] items-stretch gap-1 overflow-x-auto px-3">
        {LINKS.map((link) => {
          const active =
            link.href === "/"
              ? path === "/"
              : path.startsWith(link.href);

          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full items-center px-4 text-sm font-bold transition-colors ${
                  active
                    ? "bg-brand text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-0 h-[3px] w-full bg-white" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
