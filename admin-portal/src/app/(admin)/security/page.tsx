"use client";

import { useCallback, useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  userId: string | null;
  action: string;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type AuditResponse = {
  events: AuditEvent[];
  count: number;
  limit: number;
  actionCounts: {
    action: string;
    count: number;
  }[];
};

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-GH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function actorName(event: AuditEvent) {
  if (!event.user) return event.userId ? `User ${event.userId}` : "System / Unknown";
  const name = [event.user.firstName, event.user.lastName]
    .filter(Boolean)
    .join(" ");
  return name || event.user.email || event.user.id;
}

function actionStyle(action: string) {
  if (action.includes("fail") || action.includes("reuse")) {
    return "bg-rose-50 text-rose-700";
  }
  if (action.startsWith("admin.")) {
    return "bg-violet-50 text-violet-700";
  }
  if (action.includes("logout")) {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-emerald-50 text-emerald-700";
}

export default function SecurityPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setError("");
    setRefreshing(true);

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("q", search.trim());
      if (action) params.set("action", action);

      const response = await fetch(
        `/api/backend/admin/security/audit-logs?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to load audit events.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load audit events.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, action]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEvents();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadEvents]);

  const events = data?.events ?? [];
  const actionCounts = data?.actionCounts ?? [];
  const totalEvents = actionCounts.reduce((sum, item) => sum + item.count, 0);
  const adminEvents = actionCounts
    .filter((item) => item.action.startsWith("admin."))
    .reduce((sum, item) => sum + item.count, 0);
  const authEvents = actionCounts
    .filter((item) => item.action.startsWith("auth."))
    .reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Security & Audit Logs
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review recorded authentication activity and administrator actions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Recorded events</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data ? totalEvents.toLocaleString() : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">All recorded audit events</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Admin actions</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data ? adminEvents.toLocaleString() : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Recorded administrator operations
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Authentication events</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data ? authEvents.toLocaleString() : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Login, logout and verification activity
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">Audit event history</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data
              ? `${data.count.toLocaleString()} matching events · showing up to ${data.limit}`
              : "Recorded security activity from the backend"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, user, ID or IP address"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">All recorded actions</option>
            {actionCounts.map((item) => (
              <option key={item.action} value={item.action}>
                {item.action.replaceAll("_", " ")} ({item.count})
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
            Loading security audit events...
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-slate-700">
              No audit events found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or action filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">IP address</th>
                  <th className="px-4 py-3 font-semibold">Date & time</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id} className="align-top hover:bg-slate-50">
                    <td className="max-w-[190px] break-all px-4 py-4 font-mono text-xs text-slate-700">
                      {event.id}
                    </td>
                    <td className="max-w-[220px] px-4 py-4">
                      <p className="break-words font-medium text-slate-800">
                        {actorName(event)}
                      </p>
                      {event.user?.email && (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {event.user.email}
                        </p>
                      )}
                      {event.userId && (
                        <p className="mt-1 break-all font-mono text-xs text-slate-400">
                          {event.userId}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionStyle(event.action)}`}
                      >
                        {event.action}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">
                      {event.ip ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {dateTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      {event.metadata &&
                      Object.keys(event.metadata).length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded(expanded === event.id ? null : event.id)
                          }
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {expanded === event.id ? "Hide details" : "View details"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No metadata</span>
                      )}
                      {expanded === event.id && event.metadata && (
                        <pre className="mt-2 max-w-[320px] overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
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
        Read-only audit view. It displays events currently recorded by the
        backend. It does not manage administrator roles, change permissions,
        or modify audit records.
      </p>
    </div>
  );
}
