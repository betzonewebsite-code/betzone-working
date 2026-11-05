"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Search, User, X, Wallet } from "lucide-react";
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
        type="button"
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
            {items.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 hover:bg-brand-soft"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                    className="block w-full px-3 py-2.5 text-left hover:bg-brand-soft"
                  >
                    {item.label}
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

  const accountItems = [
    { label: "My account", href: "/me" },
    { label: "My Bets", href: "/my-bets" },
    { label: "Transactions", href: "/me/transactions" },
    { label: "Log out", onClick: () => void logout() },
  ];

  return (
    <header className="bg-brand text-white shadow-md">
      <div className="mx-auto max-w-[1400px] px-3 lg:px-4">
        <div className="flex min-h-14 items-center gap-2 py-2 lg:h-[68px] lg:gap-3 lg:py-0">
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

          <div className="relative ml-3 hidden w-64 shrink-0 lg:block">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team or league"
              aria-label="Search matches"
              className="h-9 w-full rounded-md border border-white/20 bg-white/15 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/65 focus:bg-white/20 focus:ring-2 focus:ring-white/40"
            />
          </div>

          <div className="flex-1" />

          <div className="hidden items-center gap-4 text-xs lg:flex">
            <Clock />
            <ThemeToggle />

            {authed && (
              <div className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-right leading-tight">
                <div className="text-[10px] text-white/75">
                  Available balance
                </div>
                <div className="text-sm font-extrabold tabular-nums text-white">
                  {user.currency} {fmt(user.balance)}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            className="shrink-0 rounded-md p-2 transition hover:bg-white/15 lg:hidden"
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>

          {status === "loading" && (
            <div className="h-8 w-16 shrink-0" aria-hidden />
          )}

          {status === "anon" && (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => openModal("login")}
                className="rounded-md border border-white px-2.5 py-2 text-xs font-bold text-white transition hover:bg-white/10 sm:px-3 sm:text-sm"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => openModal("register")}
                className="rounded-md bg-white px-2.5 py-2 text-xs font-extrabold text-brand shadow-sm transition hover:bg-white/90 sm:px-3 sm:text-sm"
              >
                Register
              </button>
            </div>
          )}

          {authed && (
            <>
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

              <Link
                href="/me/deposit"
                className="hidden shrink-0 rounded-md bg-white px-3 py-2 text-xs font-extrabold text-brand shadow-sm transition hover:bg-white/90 sm:text-sm lg:block"
              >
                Deposit
              </Link>

              <div className="hidden lg:block">
                <Menu
                  icon={
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/15">
                      <User size={17} />
                    </span>
                  }
                  items={accountItems}
                />
              </div>

              <div className="lg:hidden">
                <Menu
                  icon={
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/15">
                      <User size={18} />
                    </span>
                  }
                  items={accountItems}
                />
              </div>
            </>
          )}
        </div>

        {authed && (
          <div className="border-t border-white/15 py-2 lg:hidden">
            <Link
              href="/me"
              className="flex items-center justify-between rounded-md bg-white/10 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-white/80">
                <Wallet size={15} />
                Available balance
              </span>
              <span className="text-sm font-extrabold tabular-nums text-white">
                {user.currency} {fmt(user.balance)}
              </span>
            </Link>

            <Link
              href="/me/deposit"
              className="mt-2 flex items-center justify-center rounded-md bg-white py-2 text-sm font-extrabold text-brand shadow-sm transition hover:bg-white/90"
            >
              Deposit
            </Link>
          </div>
        )}

        {searchOpen && (
          <div className="pb-3 lg:hidden">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team or league"
              aria-label="Search matches"
              className="h-10 w-full rounded-md border border-white/20 bg-white px-3 text-sm text-ink outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-white/50"
            />
          </div>
        )}
      </div>
    </header>
  );
}
