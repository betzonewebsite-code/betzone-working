"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Search, User, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { useFilters } from "@/store/filterStore";
import { useAuth } from "@/store/authStore";

const fmt = (n: string) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function Clock() {
  const [now, setNow] = useState("");

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="tabular-nums text-white/80" aria-label="Current time">
      {now}
    </span>
  );
}

function Menu({
  label,
  icon,
  items,
  align = "right",
}: {
  label?: string;
  icon?: React.ReactNode;
  items: { label: string; href?: string; onClick?: () => void }[];
  align?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label ?? "Account menu"}
        className="flex items-center gap-1 text-sm font-bold text-white hover:text-white/80"
      >
        {icon}
        {label}
        {label && <ChevronDown size={14} />}
      </button>

      {open && (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            className={`absolute ${align}-0 z-40 mt-2 w-44 overflow-hidden rounded-md bg-white text-sm text-ink shadow-xl`}
          >
            {items.map((i) => (
              <li key={i.label}>
                {i.href ? (
                  <Link
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 hover:bg-brand-soft"
                  >
                    {i.label}
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setOpen(false);
                      i.onClick?.();
                    }}
                    className="block w-full px-3 py-2.5 text-left hover:bg-brand-soft"
                  >
                    {i.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function Header() {
  const query = useFilters((s) => s.query);
  const setQuery = useFilters((s) => s.setQuery);
  const { user, status, openModal, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const authed = status === "authed" && user;

  return (
    <header className="bg-brand text-white shadow-md">
      <div className="mx-auto flex min-h-14 max-w-[1400px] items-center gap-3 px-3 lg:h-[68px] lg:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5"
          aria-label="BETZONE GH home"
        >
          <span className="text-xl font-black tracking-tight sm:text-2xl">
            BET<span className="text-white">ZONE</span>
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-black tracking-widest text-brand">
            GH
          </span>
        </Link>

        <div className="relative ml-3 hidden w-64 lg:block">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team or league"
            aria-label="Search matches"
            className="h-9 w-full rounded-md border border-white/20 bg-white/15 pl-9 pr-3 text-sm text-white placeholder:text-white/65 outline-none transition focus:bg-white/20 focus:ring-2 focus:ring-white/40"
          />
        </div>

        <div className="flex-1" />

        <div className="hidden items-center gap-4 text-xs lg:flex">
          <Clock />
          <ThemeToggle />

          {authed && (
            <div className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-right leading-tight">
              <div className="text-[10px] text-white/75">Available balance</div>
              <div className="text-sm font-extrabold tabular-nums text-white">
                {user.currency} {fmt(user.balance)}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setSearchOpen(!searchOpen)}
          aria-label="Search"
          className="rounded-md p-2 hover:bg-white/15 lg:hidden"
        >
          {searchOpen ? <X size={20} /> : <Search size={20} />}
        </button>

        {status === "loading" && <div className="h-8 w-24" aria-hidden />}

        {status === "anon" && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => openModal("login")}
              className="rounded-md border border-white px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 sm:text-sm"
            >
              Login
            </button>
            <button
              onClick={() => openModal("register")}
              className="rounded-md bg-white px-3 py-2 text-xs font-extrabold text-brand shadow-sm transition hover:bg-white/90 sm:text-sm"
            >
              Register
            </button>
          </div>
        )}

        {authed && (
          <>
            <Link
              href="/me/deposit"
              className="shrink-0 rounded-md bg-white px-3 py-2 text-xs font-extrabold text-brand shadow-sm transition hover:bg-white/90 sm:text-sm"
            >
              Deposit
            </Link>

            <div className="hidden lg:block">
              <Menu
                label="My Bets"
                items={[
                  { label: "Active", href: "/my-bets" },
                  { label: "Settled", href: "/my-bets" },
                  { label: "Cash out", href: "/my-bets" },
                ]}
              />
            </div>

            <div className="hidden lg:block">
              <Menu
                icon={
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/15">
                    <User size={17} />
                  </span>
                }
                items={[
                  { label: "My account", href: "/me" },
                  { label: "Transactions", href: "/me/transactions" },
                  { label: "Log out", onClick: () => void logout() },
                ]}
              />
            </div>
          </>
        )}
      </div>

      {searchOpen && (
        <div className="px-3 pb-3 lg:hidden">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team or league"
            aria-label="Search matches"
            className="h-10 w-full rounded-md border border-white/20 bg-white px-3 text-sm text-ink placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>
      )}
    </header>
  );
}
