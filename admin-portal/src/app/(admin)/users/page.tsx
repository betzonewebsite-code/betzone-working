"use client";

import { useCallback, useEffect, useState } from "react";

type UserRecord = {
  id: string;
  email: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  kycStatus: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  lockedUntil: string | null;
  failedLoginCount: number;
  wallet: {
    balance: number;
    currency: string;
  } | null;
  limits: {
    dailyDeposit: number | null;
    weeklyDeposit: number | null;
    monthlyDeposit: number | null;
    dailyStake: number | null;
    coolOffUntil: string | null;
    selfExcludedUntil: string | null;
    updatedAt: string;
  } | null;
  _count: {
    tickets: number;
    transactions: number;
  };
};

type UsersResponse = {
  users: UserRecord[];
  count: number;
  limit: number;
  statusCounts: {
    status: string;
    count: number;
  }[];
};

const statuses = ["ACTIVE", "SUSPENDED", "SELF_EXCLUDED", "CLOSED"];
const kycStatuses = ["NONE", "PENDING", "VERIFIED", "REJECTED"];

function money(amount: number, currency = "GHS") {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
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

function customerName(user: UserRecord) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email || user.phone || user.id;
}

function badgeStyle(value: string) {
  switch (value) {
    case "ACTIVE":
    case "VERIFIED":
      return "bg-emerald-50 text-emerald-700";
    case "SUSPENDED":
    case "CLOSED":
    case "REJECTED":
      return "bg-rose-50 text-rose-700";
    case "SELF_EXCLUDED":
      return "bg-amber-50 text-amber-700";
    case "PENDING":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyle(value)}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function verificationLabel(value: string | null) {
  return value ? "Verified" : "Not verified";
}

export default function UsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kycStatus, setKycStatus] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  const loadUsers = useCallback(async () => {
    setError("");
    setRefreshing(true);

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("q", search.trim());
      if (status) params.set("status", status);
      if (kycStatus) params.set("kycStatus", kycStatus);

      const response = await fetch(
        `/api/backend/admin/users?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to load customer accounts.");
      }

      setData(result);
      setSelectedUser((current) =>
        current
          ? result.users.find((user: UserRecord) => user.id === current.id) ?? null
          : null,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load customer accounts.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, status, kycStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const users = data?.users ?? [];
  const statusCount = (value: string) =>
    data?.statusCounts.find((item) => item.status === value)?.count ??
    0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Management & CRM
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Customer accounts, verification, wallet information and responsible-gambling limits.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadUsers()}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Matching customers</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data ? data.count.toLocaleString() : "—"}
          </p>
        </div>
        {statuses.map((item) => (
          <div key={item} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{item.replaceAll("_", " ")}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {data ? statusCount(item).toLocaleString() : "—"}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">Customer accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data
              ? `${data.count.toLocaleString()} matching accounts · showing up to ${data.limit}`
              : "Search and review registered customers"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, phone or user ID"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">All account statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={kycStatus}
            onChange={(event) => setKycStatus(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">All KYC statuses</option>
            {kycStatuses.map((item) => (
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
            Loading customer accounts...
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-slate-700">No customer accounts found</p>
            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">KYC</th>
                  <th className="px-4 py-3 font-semibold">Wallet balance</th>
                  <th className="px-4 py-3 font-semibold">Betting activity</th>
                  <th className="px-4 py-3 font-semibold">Last login</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="align-top hover:bg-slate-50">
                    <td className="max-w-[260px] px-4 py-4">
                      <p className="font-semibold text-slate-900">
                        {customerName(user)}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        {user.email}
                      </p>
                      <p className="text-xs text-slate-500">{user.phone}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                        {user.id}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={user.status} />
                      {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                        <p className="mt-2 text-xs text-rose-600">
                          Login locked until {dateTime(user.lockedUntil)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={user.kycStatus} />
                      <p className="mt-2 text-xs text-slate-500">
                        Email: {verificationLabel(user.emailVerifiedAt)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Phone: {verificationLabel(user.phoneVerifiedAt)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-900">
                      {user.wallet
                        ? money(user.wallet.balance, user.wallet.currency)
                        : "No wallet"}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <p>{user._count.tickets.toLocaleString()} bet tickets</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {user._count.transactions.toLocaleString()} transactions
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {dateTime(user.lastLoginAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {dateTime(user.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedUser(user)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="rounded-xl border border-blue-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer profile
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                {customerName(selectedUser)}
              </h2>
              <p className="mt-1 break-all text-sm text-slate-500">
                {selectedUser.id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close profile
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Contact</p>
              <p className="mt-2 break-all text-sm text-slate-800">{selectedUser.email}</p>
              <p className="mt-1 text-sm text-slate-800">{selectedUser.phone}</p>
              <p className="mt-2 text-xs text-slate-500">
                Email {verificationLabel(selectedUser.emailVerifiedAt)} · Phone {verificationLabel(selectedUser.phoneVerifiedAt)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Account security</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge value={selectedUser.status} />
                <StatusBadge value={selectedUser.kycStatus} />
              </div>
              <p className="mt-2 text-sm text-slate-700">
                Failed login attempts: {selectedUser.failedLoginCount}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Locked until: {dateTime(selectedUser.lockedUntil)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Account activity</p>
              <p className="mt-2 text-sm text-slate-700">
                Registered: {dateTime(selectedUser.createdAt)}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Last login: {dateTime(selectedUser.lastLoginAt)}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Last updated: {dateTime(selectedUser.updatedAt)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Wallet</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {selectedUser.wallet
                  ? money(selectedUser.wallet.balance, selectedUser.wallet.currency)
                  : "No wallet"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Betting activity</p>
              <p className="mt-2 text-sm text-slate-700">
                {selectedUser._count.tickets.toLocaleString()} bet tickets
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {selectedUser._count.transactions.toLocaleString()} financial transactions
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Responsible-gambling limits
              </p>
              {selectedUser.limits ? (
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <p>Daily deposit: {selectedUser.limits.dailyDeposit === null ? "Not set" : money(selectedUser.limits.dailyDeposit)}</p>
                  <p>Weekly deposit: {selectedUser.limits.weeklyDeposit === null ? "Not set" : money(selectedUser.limits.weeklyDeposit)}</p>
                  <p>Monthly deposit: {selectedUser.limits.monthlyDeposit === null ? "Not set" : money(selectedUser.limits.monthlyDeposit)}</p>
                  <p>Daily stake: {selectedUser.limits.dailyStake === null ? "Not set" : money(selectedUser.limits.dailyStake)}</p>
                  <p>Cool-off until: {dateTime(selectedUser.limits.coolOffUntil)}</p>
                  <p>Self-excluded until: {dateTime(selectedUser.limits.selfExcludedUntil)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No responsible-gambling limits recorded.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Read-only customer view. Account suspension, restoration, KYC decisions,
        responsible-gambling changes and wallet operations are not performed here.
      </p>
    </div>
  );
}


