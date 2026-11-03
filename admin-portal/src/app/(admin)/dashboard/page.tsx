"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  Gamepad2,
  ReceiptText,
  Users,
  RefreshCw,
} from "lucide-react";
import { adminModules } from "@/lib/modules";

type DashboardData = {
  totalUsers: number;
  totalFixtures: number;
  totalBetTickets: number;
  totalTransactions: number;
  generatedAt: string;
};

const cards = [
  {
    title: "Registered users",
    key: "totalUsers",
    icon: Users,
    href: "/users",
  },
  {
    title: "Fixtures",
    key: "totalFixtures",
    icon: Gamepad2,
    href: "/matches",
  },
  {
    title: "Bet tickets",
    key: "totalBetTickets",
    icon: ReceiptText,
    href: "/bets",
  },
  {
    title: "Transactions",
    key: "totalTransactions",
    icon: CircleDollarSign,
    href: "/finance",
  },
] as const;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/backend/admin/dashboard", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.error || `Request failed (${response.status})`
        );
      }

      setData(result as DashboardData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const number = (value: number | undefined) =>
    value === undefined ? "—" : new Intl.NumberFormat().format(value);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">OVERVIEW</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Operations dashboard
          </h1>
          <p className="mt-2 text-slate-500">
            Live totals from the existing BETZONE database.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:border-emerald-400 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p className="font-semibold">Dashboard data could not be loaded.</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2">
            Confirm that you are signed in with an administrator account and
            that the backend is running.
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-r from-brand-950 to-brand-700 p-6 text-white md:p-8">
        <p className="text-sm font-semibold text-emerald-200">
          BETZONE ADMINISTRATION
        </p>
        <h2 className="mt-2 text-2xl font-bold">
          One backend. One source of truth.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
          Dashboard totals are fetched from the shared database. Data refreshes
          automatically every 30 seconds while this page is open.
        </p>
        {data?.generatedAt && (
          <p className="mt-3 text-xs text-emerald-100/80">
            Last updated: {new Date(data.generatedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const value = data
            ? data[card.key as keyof DashboardData]
            : undefined;

          return (
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
                  <Icon size={21} />
                </span>
                <ArrowUpRight
                  size={17}
                  className="text-slate-400 group-hover:text-emerald-700"
                />
              </div>
              <h3 className="mt-5 text-sm font-semibold text-slate-500">
                {card.title}
              </h3>
              <p className="mt-1 text-3xl font-black tracking-tight">
                {loading && !data ? "…" : number(value as number | undefined)}
              </p>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Administration modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminModules
            .filter((item) => item.href !== "/dashboard")
            .map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-300"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-50 text-brand-900">
                    <Icon size={19} />
                  </span>
                  <span className="flex-1 text-sm font-semibold">
                    {item.label}
                  </span>
                  <ArrowUpRight size={15} className="text-slate-400" />
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
