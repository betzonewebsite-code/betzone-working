"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type SettlementFixture = {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  kickoffAt: string;
  result: unknown;
  league: { name: string };
  pendingSelections: number;
  affectedOpenTickets: number;
  providerAgreement: boolean | null;
};

type SettlementResponse = {
  fixtures: SettlementFixture[];
  count: number;
  limit: number;
  summary: {
    fixtures: number;
    pendingSelections: number;
    affectedOpenTickets: number;
  };
};

function dateTime(value: string) {
  return new Date(value).toLocaleString();
}

function AgreementBadge({ agreed }: { agreed: boolean | null }) {
  if (agreed === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 size={13} /> Agreed
      </span>
    );
  }

  if (agreed === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
        <XCircle size={13} /> Disputed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
      <Clock3 size={13} /> Not confirmed
    </span>
  );
}

function FixtureStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    FINISHED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-600",
    POSTPONED: "bg-amber-50 text-amber-700",
    ABANDONED: "bg-red-50 text-red-700",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function SettlementPage() {
  const [data, setData] = useState<SettlementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadFixtures = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("q", search.trim());

      const response = await fetch(
        `/api/backend/admin/settlement?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.message || `Request failed (${response.status})`,
        );
      }

      setData(result as SettlementResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load settlement records.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadFixtures();
  }, [loadFixtures]);

  const fixtures = data?.fixtures ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            BETZONE / BETTING OPERATIONS
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            Settlement Engine
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Review completed fixtures, outstanding selections and affected open
            tickets before any settlement is processed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadFixtures()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-emerald-400 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <ShieldCheck size={19} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-bold">Read-only settlement review</p>
          <p className="mt-1 leading-5">
            This screen does not settle bets, issue payouts, refund stakes or
            modify wallet balances. It displays fixtures that have pending
            selections for administrative review.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="flex items-center gap-2 font-bold">
            <XCircle size={18} />
            Settlement records could not be loaded
          </div>
          <p className="mt-2">{error}</p>
          <p className="mt-1 text-red-700">
            Check your administrator session and confirm that the BETZONE
            backend is running.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Activity size={17} /> Fixtures requiring review
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900">
            {loading && !data ? "…" : data?.summary.fixtures ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertCircle size={17} /> Pending selections
          </div>
          <p className="mt-3 text-3xl font-black text-amber-700">
            {loading && !data ? "…" : data?.summary.pendingSelections ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <Activity size={17} /> Affected open tickets
          </div>
          <p className="mt-3 text-3xl font-black text-blue-700">
            {loading && !data ? "…" : data?.summary.affectedOpenTickets ?? 0}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-bold text-slate-900">
              Fixtures awaiting settlement review
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Completed or discontinued fixtures with selections still marked
              pending.
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadFixtures();
              }}
              placeholder="Search team or league"
              maxLength={100}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-bold">Fixture</th>
                <th className="px-5 py-3 font-bold">Sport / League</th>
                <th className="px-5 py-3 font-bold">Final score</th>
                <th className="px-5 py-3 font-bold">Fixture status</th>
                <th className="px-5 py-3 font-bold">Pending selections</th>
                <th className="px-5 py-3 font-bold">Affected open tickets</th>
                <th className="px-5 py-3 font-bold">Provider agreement</th>
                <th className="px-5 py-3 font-bold">Kickoff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    Loading settlement records…
                  </td>
                </tr>
              ) : fixtures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    No fixtures with pending selections were found.
                  </td>
                </tr>
              ) : (
                fixtures.map((fixture) => (
                  <tr key={fixture.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">
                        {fixture.homeTeam} vs {fixture.awayTeam}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Fixture ID: {fixture.id}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-700">
                        {fixture.sport.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {fixture.league.name}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-black text-slate-900">
                        {fixture.homeScore} – {fixture.awayScore}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <FixtureStatus status={fixture.status} />
                    </td>
                    <td className="px-5 py-4 font-bold text-amber-700">
                      {fixture.pendingSelections}
                    </td>
                    <td className="px-5 py-4 font-bold text-blue-700">
                      {fixture.affectedOpenTickets}
                    </td>
                    <td className="px-5 py-4">
                      <AgreementBadge agreed={fixture.providerAgreement} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {dateTime(fixture.kickoffAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
          <span>
            Showing {fixtures.length} of {data?.count ?? 0} matching fixtures.
            Maximum 100 per request.
          </span>
          <span>Read-only · No settlement or wallet actions are enabled.</span>
        </div>
      </section>
    </div>
  );
}
