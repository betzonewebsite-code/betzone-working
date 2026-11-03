"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type League = {
  id: string;
  name: string;
  country: string;
  sport: string;
};

type Selection = {
  id: string;
  dbId: string;
  key: string;
  label: string;
  odds: number;
  previous: number | null;
  locked: boolean;
};

type Market = {
  id: string;
  dbId: string;
  name: string;
  selections: Selection[];
};

type Fixture = {
  id: string;
  sport: string;
  country: string;
  league: string;
  leagueKey: string;
  home: string;
  away: string;
  kickoff: string;
  status: string;
  live: boolean;
  bettingOpen: boolean;
  markets: Market[];
};

type ApiPayload = {
  fixtures?: Fixture[];
  leagues?: League[];
  count?: number;
  error?: string;
  message?: string;
};

const sports = [
  ["SOCCER", "Football"],
  ["BASKETBALL", "Basketball"],
  ["TENNIS", "Tennis"],
  ["TABLE_TENNIS", "Table tennis"],
  ["ICE_HOCKEY", "Ice hockey"],
  ["BASEBALL", "Baseball"],
  ["ESPORTS", "Esports"],
] as const;

const marketTypes = [
  ["ONE_X_TWO", "1X2 — Match result"],
  ["OVER_UNDER", "Over / Under"],
  ["DOUBLE_CHANCE", "Double chance"],
  ["BTTS", "Both teams to score"],
  ["ASIAN_HANDICAP", "Asian handicap"],
  ["MONEYLINE", "Moneyline"],
  ["NEXT_GOAL", "Next goal"],
] as const;

const initialSelections = {
  ONE_X_TWO: [
    { key: "1", label: "Home", odds: 2.1 },
    { key: "X", label: "Draw", odds: 3.2 },
    { key: "2", label: "Away", odds: 3.4 },
  ],
  OVER_UNDER: [
    { key: "over", label: "Over", odds: 1.9 },
    { key: "under", label: "Under", odds: 1.9 },
  ],
  DOUBLE_CHANCE: [
    { key: "1x", label: "Home or Draw", odds: 1.3 },
    { key: "12", label: "Home or Away", odds: 1.3 },
    { key: "x2", label: "Draw or Away", odds: 1.5 },
  ],
  BTTS: [
    { key: "gg", label: "Yes", odds: 1.9 },
    { key: "ng", label: "No", odds: 1.9 },
  ],
  ASIAN_HANDICAP: [
    { key: "home", label: "Home", odds: 1.9 },
    { key: "away", label: "Away", odds: 1.9 },
  ],
  MONEYLINE: [
    { key: "home", label: "Home", odds: 1.9 },
    { key: "away", label: "Away", odds: 1.9 },
  ],
  NEXT_GOAL: [
    { key: "home", label: "Home", odds: 2.2 },
    { key: "none", label: "No goal", odds: 5 },
    { key: "away", label: "Away", odds: 2.2 },
  ],
} as const;

function formatKickoff(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function request<T>(method: string, body?: unknown, query = ""): Promise<T> {
  const response = await fetch(`/api/backend/admin/matches${query}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
  }
  return payload as T;
}

export function MatchesOddsControl() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [kickoffAt, setKickoffAt] = useState("");
  const [selectedMarketType, setSelectedMarketType] =
    useState<keyof typeof initialSelections>("ONE_X_TWO");
  const [marketName, setMarketName] = useState("Match result");
  const [marketLine, setMarketLine] = useState("");
  const [oddsDrafts, setOddsDrafts] = useState<Record<string, string>>({});
  const [marketTarget, setMarketTarget] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (sportFilter) params.set("sport", sportFilter);
      if (search.trim()) params.set("q", search.trim());
      params.set("limit", "200");
      const result = await request<ApiPayload>("GET", undefined, `?${params.toString()}`);
      setFixtures(result.fixtures ?? []);
      setLeagues(result.leagues ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load matches.");
    } finally {
      setLoading(false);
    }
  }, [search, sportFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableLeagues = useMemo(
    () => leagues.filter((league) => !sportFilter || league.sport === sportFilter),
    [leagues, sportFilter],
  );

  useEffect(() => {
    if (leagueId && !availableLeagues.some((league) => league.id === leagueId)) {
      setLeagueId("");
    }
  }, [availableLeagues, leagueId]);

  async function mutate(key: string, payload: unknown, successMessage: string) {
    setBusyKey(key);
    setError("");
    setNotice("");
    try {
      await request("PATCH", payload);
      setNotice(successMessage);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The change could not be saved.");
    } finally {
      setBusyKey("");
    }
  }

  async function createFixture(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId) {
      setError("Select a league before creating the fixture.");
      return;
    }
    const league = availableLeagues.find((item) => item.id === leagueId);
    if (!league) {
      setError("Choose a valid league.");
      return;
    }

    setBusyKey("create-fixture");
    setError("");
    setNotice("");
    try {
      await request("POST", {
        sport: league.sport,
        leagueId,
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        kickoffAt: new Date(kickoffAt).toISOString(),
      });
      setHomeTeam("");
      setAwayTeam("");
      setKickoffAt("");
      setNotice("Fixture created successfully. Add its markets and odds below.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fixture could not be created.");
    } finally {
      setBusyKey("");
    }
  }

  async function saveOdds(selection: Selection) {
    const raw = oddsDrafts[selection.dbId] ?? String(selection.odds);
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 1 || value > 10000) {
      setError("Odds must be a number greater than 1 and no more than 10000.");
      return;
    }
    await mutate(
      `odds-${selection.dbId}`,
      { action: "updateOdds", selectionId: selection.dbId, odds: value },
      `Odds saved for ${selection.label}.`,
    );
    setOddsDrafts((old) => ({ ...old, [selection.dbId]: String(value) }));
  }

  async function createMarket(fixture: Fixture) {
    const selections = initialSelections[selectedMarketType].map((selection) => ({
      ...selection,
      odds: Number(selection.odds),
    }));
    const line = marketLine.trim() === "" ? null : Number(marketLine);
    if (line !== null && !Number.isFinite(line)) {
      setError("Market line must be a valid number.");
      return;
    }
    await mutate(
      `market-${fixture.id}`,
      {
        action: "createMarket",
        fixtureId: fixture.id,
        marketType: selectedMarketType,
        marketName: marketName.trim() || marketTypes.find(([key]) => key === selectedMarketType)?.[1],
        line,
        lineKey: line === null ? "" : String(line),
        selections,
      },
      "Market and its initial odds were created.",
    );
    setMarketTarget(null);
    setMarketLine("");
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            BETZONE · Trading
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Matches &amp; Odds Control Center
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage real fixtures, publish markets, update prices, and control betting availability.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh data"}
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Create fixture</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select an existing league. New fixtures start scheduled with betting enabled and no markets.
          </p>
        </div>
        <form onSubmit={createFixture} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium text-slate-700">
            Sport
            <select
              value={sportFilter}
              onChange={(event) => setSportFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
            >
              <option value="">All sports</option>
              {sports.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            League
            <select
              required
              value={leagueId}
              onChange={(event) => setLeagueId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
            >
              <option value="">Choose league</option>
              {availableLeagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}{league.country ? ` · ${league.country}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Home team
            <input required maxLength={100} value={homeTeam} onChange={(event) => setHomeTeam(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Away team
            <input required maxLength={100} value={awayTeam} onChange={(event) => setAwayTeam(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Kickoff (your local time)
            <input required type="datetime-local" value={kickoffAt} onChange={(event) => setKickoffAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <div className="md:col-span-2 xl:col-span-5">
            <button type="submit" disabled={busyKey === "create-fixture"} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
              {busyKey === "create-fixture" ? "Creating…" : "Create fixture"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teams or leagues…"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-3 text-sm"
          />
          <div className="flex items-center rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600">
            {loading ? "Loading…" : `${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {!loading && fixtures.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No fixtures matched this search. Try another team, league, or sport.
          </div>
        )}

        {fixtures.map((fixture) => (
          <article key={fixture.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-4 md:flex-row md:items-start md:justify-between md:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>{fixture.country}</span>
                  <span>·</span>
                  <span>{fixture.league}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 uppercase">{fixture.sport}</span>
                  <span className={`rounded-full px-2 py-1 ${fixture.live ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                    {fixture.status}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-slate-900">
                  {fixture.home} <span className="font-medium text-slate-400">vs</span> {fixture.away}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{formatKickoff(fixture.kickoff)}</p>
                <p className="mt-1 text-xs text-slate-400">{fixture.markets.length} market(s)</p>
              </div>
              <button
                type="button"
                disabled={busyKey === `fixture-${fixture.id}`}
                onClick={() => void mutate(
                  `fixture-${fixture.id}`,
                  { action: "updateFixture", fixtureId: fixture.id, bettingOpen: !fixture.bettingOpen },
                  fixture.bettingOpen ? "Fixture betting has been disabled." : "Fixture betting has been enabled.",
                )}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${fixture.bettingOpen ? "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}
              >
                {fixture.bettingOpen ? "Disable fixture betting" : "Enable fixture betting"}
              </button>
            </div>

            <div className="space-y-4 p-4 md:p-5">
              {fixture.markets.map((market) => (
                <div key={market.dbId} className="rounded-lg border border-slate-200 p-3 md:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800">{market.name}</h4>
                      <p className="text-xs text-slate-500">{market.selections.length} selection(s)</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyKey === `market-status-${market.dbId}`}
                      onClick={() => void mutate(
                        `market-status-${market.dbId}`,
                        {
                          action: "setMarketStatus",
                          marketId: market.dbId,
                          marketStatus: market.selections.some((selection) => selection.locked) ? "OPEN" : "SUSPENDED",
                        },
                        "Market status updated.",
                      )}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {market.selections.some((selection) => selection.locked) ? "Manage market status" : "Suspend market"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {market.selections.map((selection) => (
                      <div key={selection.dbId} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800">{selection.label}</span>
                          <span className={`text-xs ${selection.locked ? "text-amber-700" : "text-emerald-700"}`}>
                            {selection.locked ? "Suspended" : "Open"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            aria-label={`Odds for ${selection.label}`}
                            type="number"
                            min="1.001"
                            max="10000"
                            step="0.001"
                            value={oddsDrafts[selection.dbId] ?? String(selection.odds)}
                            onChange={(event) => setOddsDrafts((old) => ({ ...old, [selection.dbId]: event.target.value }))}
                            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white p-2 text-sm"
                          />
                          <button
                            type="button"
                            disabled={busyKey === `odds-${selection.dbId}` || selection.locked || !fixture.bettingOpen}
                            onClick={() => void saveOdds(selection)}
                            className="rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
                          >
                            Save
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={busyKey === `selection-${selection.dbId}`}
                          onClick={() => void mutate(
                            `selection-${selection.dbId}`,
                            {
                              action: "setSelectionStatus",
                              selectionId: selection.dbId,
                              selectionStatus: selection.locked ? "OPEN" : "SUSPENDED",
                            },
                            `${selection.label} status updated.`,
                          )}
                          className="mt-2 text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:opacity-50"
                        >
                          {selection.locked ? "Reopen selection" : "Suspend selection"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {marketTarget === fixture.id ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <h4 className="font-bold text-slate-900">Add market and initial odds</h4>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Market type
                      <select
                        value={selectedMarketType}
                        onChange={(event) => {
                          const next = event.target.value as keyof typeof initialSelections;
                          setSelectedMarketType(next);
                          setMarketName(marketTypes.find(([key]) => key === next)?.[1] ?? "New market");
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
                      >
                        {marketTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Market display name
                      <input value={marketName} onChange={(event) => setMarketName(event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Line (optional)
                      <input value={marketLine} onChange={(event) => setMarketLine(event.target.value)} placeholder="e.g. 2.5" type="number" step="0.25" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5" />
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    Initial selections are populated with example prices. Review the generated market and prices before making it available to customers.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={busyKey === `market-${fixture.id}`} onClick={() => void createMarket(fixture)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                      {busyKey === `market-${fixture.id}` ? "Saving…" : "Create market"}
                    </button>
                    <button type="button" onClick={() => setMarketTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!fixture.bettingOpen}
                  onClick={() => {
                    setMarketTarget(fixture.id);
                    setSelectedMarketType("ONE_X_TWO");
                    setMarketName("Match result");
                    setMarketLine("");
                  }}
                  className="rounded-lg border border-dashed border-emerald-400 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
                >
                  + Add market
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      <p className="text-xs leading-5 text-slate-500">
        Changes are saved to the backend. Odds updates are blocked when the fixture or market is closed to betting.
        Creating a fixture does not automatically publish odds; add and review its markets separately.
      </p>
    </main>
  );
}
