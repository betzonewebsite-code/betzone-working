"use client";

import { useCallback, useEffect, useState } from "react";

type KycUser = {
  id: string;
  email: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  kycStatus: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type KycResponse = {
  users: KycUser[];
  count: number;
  limit: number;
};

const statuses = ["PENDING", "VERIFIED", "REJECTED", "NONE"];

function customerName(user: KycUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email || user.phone || user.id;
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

function badgeStyle(value: string) {
  switch (value) {
    case "VERIFIED":
      return "bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "bg-rose-50 text-rose-700";
    case "PENDING":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyle(value)}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default function KycPage() {
  const [data, setData] = useState<KycResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kycStatus, setKycStatus] = useState("PENDING");

  const loadKycUsers = useCallback(async () => {
    setError("");
    setRefreshing(true);

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("q", search.trim());
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
        throw new Error(result?.error || "Unable to load KYC records.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load KYC records.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, kycStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKycUsers();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadKycUsers]);

  const users = data?.users ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            KYC Verification
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review customer identity-verification statuses and account details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadKycUsers()}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">
          Verification status review only
        </p>
        <p className="mt-1 text-sm text-amber-800">
          The current platform database stores KYC status but does not yet
          provide identity-document records or a document-review workflow.
          This page does not approve, reject or modify customer verification.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">
            Matching customer records
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? "—" : data?.count ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">
            Records displayed
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? "—" : users.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Maximum 100 records per request
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, phone or customer ID..."
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <select
          value={kycStatus}
          onChange={(event) => setKycStatus(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="">All verification statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">
            Customer verification records
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading verification records...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No customer records match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">KYC status</th>
                  <th className="px-4 py-3 font-semibold">Account status</th>
                  <th className="px-4 py-3 font-semibold">Email verified</th>
                  <th className="px-4 py-3 font-semibold">Phone verified</th>
                  <th className="px-4 py-3 font-semibold">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {customerName(user)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        ID: {user.id}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {user.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={user.kycStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-700">
                        {user.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dateTime(user.emailVerifiedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dateTime(user.phoneVerifiedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dateTime(user.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
