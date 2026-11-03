"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Ticket,
  XCircle,
} from "lucide-react";

type BetLeg = {
  id: string;
  fixtureId: string;
  matchName: string;
  marketName: string;
  pickLabel: string;
  oddsTaken: number;
  line: number | null;
  placedLive: boolean;
  result: string;
  settledAt: string | null;
};

type BetTicket = {
  id: string;
  publicId: string;
  userId: string;
  type: string;
  stake: number;
  remainingStake: number;
  totalOdds: number;
  bonusPct: number;
  potentialPayout: number;
  payout: number;
  cashedOutAmount: number;
  status: string;
  placedAt: string;
  settledAt: string | null;
  user: {
    id: string;
    email: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
  };
  legs: BetLeg[];
};

type BetsResponse = {
  tickets: BetTicket[];
  count: number;
  limit: number;
};

const statuses = ["ALL", "OPEN", "WON", "LOST", "VOID", "CASHED_OUT"];

function money(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: "bg-blue-50 text-blue-700",
    WON: "bg-emerald-50 text-emerald-700",
    LOST: "bg-red-50 text-red-700",
    VOID: "bg-slate-100 text-slate-600",
    CASHED_OUT: "bg-amber-50 text-amber-700",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function AllBetsPage() {
  const [data, setData] = useState<BetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadBets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("q", search.trim());
      if (status !== "ALL") params.set("status", status);

      const response = await fetch(
        `/api/backend/admin/bets?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || `Request failed (${response.status})`);
      }

      setData(result as BetsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bet records.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void loadBets();
  }, [loadBets]);

  const tickets = data?.tickets ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">BETZONE / BETTING OPERATIONS</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">All Bets</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Inspect real customer bet tickets, accepted odds, stakes, potential returns and settlement results.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBets()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-emerald-400 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2 font-bold">
            <XCircle size={18} />
            Bet records could not be loaded
          </div>
          <p className="mt-2">{error}</p>
          <p className="mt-1 text-red-700">
            Check your administrator session and confirm that the BETZONE backend is running.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Ticket size={17} /> Matching tickets
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900">
            {loading && !data ? "…" : data?.count ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <Activity size={17} /> Open tickets shown
          </div>
          <p className="mt-3 text-3xl font-black text-blue-700">
            {loading && !data ? "…" : tickets.filter((ticket) => ticket.status === "OPEN").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-500">Records per request</div>
          <p className="mt-3 text-3xl font-black text-slate-900">100</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-bold text-slate-900">Customer bet tickets</h2>
            <p className="mt-1 text-sm text-slate-500">Select a ticket to inspect its individual selections.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="relative min-w-0 sm:w-72">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadBets();
                }}
                placeholder="Search reference, email or phone"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500"
              aria-label="Filter bets by status"
            >
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All statuses" : value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-bold">Bet reference / customer</th>
                <th className="px-5 py-3 font-bold">Type</th>
                <th className="px-5 py-3 font-bold">Stake</th>
                <th className="px-5 py-3 font-bold">Total odds</th>
                <th className="px-5 py-3 font-bold">Potential payout</th>
                <th className="px-5 py-3 font-bold">Actual payout</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Placed</th>
                <th className="px-5 py-3 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-500">Loading bet records…</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-500">No bet records found for these filters.</td></tr>
              ) : tickets.map((ticket) => (
                <>
                  <tr key={ticket.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{ticket.publicId}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || ticket.user.email}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{ticket.user.phone}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{ticket.type}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{money(ticket.stake)}</td>
                    <td className="px-5 py-4 text-slate-700">{ticket.totalOdds.toFixed(3)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{money(ticket.potentialPayout)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{money(ticket.payout)}</td>
                    <td className="px-5 py-4"><StatusBadge status={ticket.status} /></td>
                    <td className="px-5 py-4 text-slate-600">{dateTime(ticket.placedAt)}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-400"
                      >
                        {expanded === ticket.id ? "Close" : "Selections"}
                        {expanded === ticket.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                  </tr>
                  {expanded === ticket.id && (
                    <tr key={`${ticket.id}-details`} className="bg-slate-50">
                      <td colSpan={9} className="px-5 py-5">
                        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                          <span>Ticket ID: <strong className="text-slate-700">{ticket.id}</strong></span>
                          <span>Customer: <strong className="text-slate-700">{ticket.user.email}</strong></span>
                          <span>Settled: <strong className="text-slate-700">{dateTime(ticket.settledAt)}</strong></span>
                          <span>Selections: <strong className="text-slate-700">{ticket.legs.length}</strong></span>
                        </div>
                        {ticket.legs.length === 0 ? (
                          <p className="text-sm text-slate-500">No selections recorded for this ticket.</p>
                        ) : (
                          <div className="grid gap-3 lg:grid-cols-2">
                            {ticket.legs.map((leg) => (
                              <div key={leg.id} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-bold text-slate-900">{leg.matchName}</p>
                                    <p className="mt-1 text-xs text-slate-500">{leg.marketName}</p>
                                  </div>
                                  <StatusBadge status={leg.result} />
                                </div>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                                  <span className="font-semibold text-slate-700">{leg.pickLabel}</span>
                                  <span className="font-black text-slate-900">@ {leg.oddsTaken.toFixed(3)}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                                  {leg.line !== null && <span>Line: {leg.line}</span>}
                                  {leg.placedLive && <span>Placed live</span>}
                                  <span>Settled: {dateTime(leg.settledAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
          <span>Showing {tickets.length} of {data?.count ?? 0} matching tickets. Maximum 100 per request.</span>
          <span>Read-only · No bet or wallet changes are available here.</span>
        </div>
      </section>
    </div>
  );
}
