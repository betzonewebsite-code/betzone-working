"use client";

import { useCallback, useEffect, useState } from "react";

type Transaction = {
  id: string;
  userId: string;
  type: string;
  status: string;
  amount: number;
  balanceAfter: number | null;
  currency: string;
  provider: string | null;
  providerRef: string | null;
  counterparty: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  user: {
    id: string;
    email: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
  };
};

type FinanceResponse = {
  transactions: Transaction[];
  count: number;
  limit: number;
  walletSummary: {
    walletCount: number;
    totalBalance: number;
  };
};

const transactionTypes = [
  "DEPOSIT",
  "WITHDRAWAL",
  "BET_STAKE",
  "BET_PAYOUT",
  "BET_REFUND",
  "CASHOUT",
  "BONUS",
  "ADJUSTMENT",
];

const transactionStatuses = [
  "PENDING",
  "PROCESSING",
  "SUCCESSFUL",
  "FAILED",
  "REVERSED",
];

function money(amount: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function dateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-GH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function customerName(tx: Transaction) {
  const name = [tx.user.firstName, tx.user.lastName].filter(Boolean).join(" ");
  return name || tx.user.email || tx.user.phone || tx.userId;
}

function statusStyle(status: string) {
  switch (status) {
    case "SUCCESSFUL":
      return "bg-emerald-50 text-emerald-700";
    case "FAILED":
    case "REVERSED":
      return "bg-rose-50 text-rose-700";
    case "PROCESSING":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    setError("");
    setRefreshing(true);

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("q", search.trim());
      if (type) params.set("type", type);
      if (status) params.set("status", status);

      const response = await fetch(
        `/api/backend/admin/finance?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to load financial transactions.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load financial transactions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, type, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTransactions();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadTransactions]);

  const transactions = data?.transactions ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Wallet & Finance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review wallet balances and the financial transaction ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTransactions()}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Total wallet balance</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data ? money(data.walletSummary.totalBalance) : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aggregate balance across all wallets
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Wallet accounts</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data ? data.walletSummary.walletCount.toLocaleString() : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Total wallet records
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">Transaction ledger</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data
              ? `${data.count.toLocaleString()} matching transactions · showing up to ${data.limit}`
              : "Financial activity from the backend"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, transaction ID or reference"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">All transaction types</option>
            {transactionTypes.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">All statuses</option>
            {transactionStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading financial transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-slate-700">
              No financial transactions found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Transaction</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Balance after</th>
                  <th className="px-4 py-3 font-semibold">Provider</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="align-top hover:bg-slate-50">
                    <td className="max-w-[220px] px-4 py-4">
                      <p className="break-all font-mono text-xs text-slate-800">
                        {tx.id}
                      </p>
                      {tx.providerRef && (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          Ref: {tx.providerRef}
                        </p>
                      )}
                      {tx.failureReason && (
                        <p className="mt-1 max-w-[220px] text-xs text-rose-600">
                          {tx.failureReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">
                        {customerName(tx)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {tx.user.phone}
                      </p>
                      <p className="text-xs text-slate-500">
                        {tx.user.email}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {tx.type.replaceAll("_", " ")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-900">
                      {money(tx.amount, tx.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                      {tx.balanceAfter === null
                        ? "—"
                        : money(tx.balanceAfter, tx.currency)}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {tx.provider ?? "—"}
                      {tx.counterparty && (
                        <p className="mt-1 text-xs text-slate-500">
                          {tx.counterparty}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(tx.status)}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {dateTime(tx.createdAt)}
                      {tx.completedAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          Completed: {dateTime(tx.completedAt)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Read-only financial view. This page does not approve withdrawals,
        modify wallet balances, reconcile payments, or initiate transactions.
      </p>
    </div>
  );
}
