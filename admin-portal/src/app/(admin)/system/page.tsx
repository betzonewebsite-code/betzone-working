"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type QueueCounts = {
  waiting?: number;
  active?: number;
  delayed?: number;
  failed?: number;
  completed?: number;
  paused?: number;
};

type Service = {
  service: string;
  status: "healthy" | "unavailable";
  latencyMs: number;
  details: string | {
    settlement?: QueueCounts;
    payouts?: QueueCounts;
  } | null;
};

type Integration = {
  name: string;
  priority: string;
  status: string;
  liveConnectivityChecked: boolean;
};

type HealthData = {
  generatedAt: string;
  services: Service[];
  integrations: Integration[];
  latestFixtureUpdate: string | null;
  notes: string[];
};

function StatusLabel({ status }: { status: string }) {
  const healthy = status === "healthy" || status === "configured";
  const warning = status === "not selected" || status === "console provider";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
      healthy
        ? "bg-emerald-50 text-emerald-700"
        : warning
          ? "bg-slate-100 text-slate-600"
          : "bg-amber-50 text-amber-700"
    }`}>
      {healthy ? <CheckCircle2 size={13} /> : warning ? <Activity size={13} /> : <AlertTriangle size={13} />}
      {status}
    </span>
  );
}

function QueueCard({ title, counts }: { title: string; counts?: QueueCounts }) {
  const values = [
    ["Waiting", counts?.waiting],
    ["Active", counts?.active],
    ["Delayed", counts?.delayed],
    ["Failed", counts?.failed],
    ["Completed", counts?.completed],
    ["Paused", counts?.paused],
  ] as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {values.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-xl font-black ${label === "Failed" && (value ?? 0) > 0 ? "text-red-600" : "text-slate-900"}`}>
              {value ?? "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/backend/admin/system/health", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || `Request failed (${response.status})`);
      }

      setData(result as HealthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load system health.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    const interval = window.setInterval(() => void loadHealth(), 30000);
    return () => window.clearInterval(interval);
  }, [loadHealth]);

  const queueService = data?.services.find((service) => service.service === "Background queues");
  const queueDetails =
    queueService?.details && typeof queueService.details !== "string"
      ? queueService.details
      : null;

  const healthyServices = data?.services.filter((service) => service.status === "healthy").length ?? 0;
  const unavailableServices = data?.services.filter((service) => service.status !== "healthy").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">BETZONE / OPERATIONS</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">System Health</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Read-only monitoring of backend services, queues and integration configuration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHealth()}
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
            Health information could not be loaded
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
            <Server size={17} /> Services checked
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900">
            {loading && !data ? "…" : data?.services.length ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={17} /> Healthy
          </div>
          <p className="mt-3 text-3xl font-black text-emerald-700">
            {loading && !data ? "…" : healthyServices}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertTriangle size={17} /> Unavailable
          </div>
          <p className="mt-3 text-3xl font-black text-amber-700">
            {loading && !data ? "…" : unavailableServices}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <Activity size={19} className="text-emerald-700" />
            <h2 className="font-bold text-slate-900">Core services</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Actual read-only connectivity checks.</p>
        </div>

        <div className="divide-y divide-slate-100">
          {loading && !data ? (
            <p className="p-5 text-sm text-slate-500">Checking backend services…</p>
          ) : data?.services.filter((service) => service.service !== "Background queues").map((service) => (
            <div key={service.service} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="font-bold text-slate-900">{service.service}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {typeof service.details === "string" ? service.details : "Connectivity check"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">{service.latencyMs} ms</span>
                <StatusLabel status={service.status} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Activity size={19} className="text-emerald-700" />
          <h2 className="font-bold text-slate-900">Background queues</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">Read-only BullMQ job counts. No jobs are processed or modified by this page.</p>
        {queueService && <div className="mt-3"><StatusLabel status={queueService.status} /></div>}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <QueueCard title="Settlement queue" counts={queueDetails?.settlement} />
          <QueueCard title="Payout queue" counts={queueDetails?.payouts} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={19} className="text-emerald-700" />
            <h2 className="font-bold text-slate-900">Integration configuration</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Credential presence and configured priority only. No external provider API calls are made.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {data?.integrations.map((integration) => (
            <div key={integration.name} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="font-bold text-slate-900">{integration.name}</h3>
                <p className="mt-1 text-xs capitalize text-slate-500">{integration.priority}</p>
              </div>
              <StatusLabel status={integration.status} />
            </div>
          ))}
          {!data && !loading && <p className="p-5 text-sm text-slate-500">No integration data available.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Clock3 size={19} className="text-emerald-700" />
          <h2 className="font-bold text-slate-900">Fixture synchronization</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Most recently updated fixture record. This does not prove that every provider polled successfully.
        </p>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          {data?.latestFixtureUpdate
            ? new Date(data.latestFixtureUpdate).toLocaleString()
            : "No fixture synchronization timestamp available"}
        </p>
      </section>

      {data?.notes && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-bold text-blue-950">Monitoring limitations</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-blue-900">
            {data.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>
      )}

      {data?.generatedAt && (
        <p className="text-right text-xs text-slate-400">
          Last checked: {new Date(data.generatedAt).toLocaleString()} · Automatic refresh every 30 seconds
        </p>
      )}
    </div>
  );
}
