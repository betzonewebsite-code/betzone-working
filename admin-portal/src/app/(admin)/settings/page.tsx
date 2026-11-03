"use client";

import { useCallback, useEffect, useState } from "react";

type Setting = {
  key: string;
  label: string;
  value: string | number | boolean;
  unit?: string;
  currency?: string;
};

type SettingGroup = {
  key: string;
  label: string;
  settings: Setting[];
};

type SettingsResponse = {
  generatedAt: string;
  readOnly: boolean;
  groups: SettingGroup[];
  notes: string[];
};

function displayValue(setting: Setting) {
  if (typeof setting.value === "boolean") {
    return setting.value ? "Enabled" : "Disabled";
  }

  if (setting.currency) {
    return `${setting.currency} ${Number(setting.value).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const value =
    typeof setting.value === "number"
      ? setting.value.toLocaleString("en-GH")
      : setting.value;

  return setting.unit ? `${value} ${setting.unit}` : String(value);
}

function dateTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-GH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    setError("");
    setRefreshing(true);

    try {
      const response = await fetch("/api/backend/admin/settings", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to load platform settings.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load platform settings.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Platform Settings & Configuration
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review the validated operational rules currently used by the BETZONE backend.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSettings()}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh settings"}
        </button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-blue-700" aria-hidden="true">ⓘ</span>
          <div>
            <p className="font-semibold text-blue-900">
              Read-only server configuration
            </p>
            <p className="mt-1 text-sm text-blue-800">
              These values are loaded from the validated backend environment.
              They are not editable here. Changes must go through a controlled
              server configuration update and deployment.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading platform configuration...
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                Configuration groups
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.groups.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Betting, payments, virtual games and regional settings
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                Configuration values
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.groups.reduce(
                  (total, group) => total + group.settings.length,
                  0,
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Validated values returned by the backend
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {data.groups.map((group) => (
              <section
                key={group.key}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">
                    {group.label}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {group.settings.length} configuration values
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
                  {group.settings.map((setting) => (
                    <div
                      key={setting.key}
                      className="min-w-0 bg-white px-5 py-4"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        {setting.label}
                      </p>
                      <p className="mt-2 break-words text-lg font-bold text-slate-900">
                        {displayValue(setting)}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-400">
                        {setting.key}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">
              Configuration management notes
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {data.notes.map((note, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-slate-400" aria-hidden="true">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              Last retrieved: {dateTime(data.generatedAt)}
            </p>
          </section>
        </>
      ) : (
        !error && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No platform configuration is available.
          </div>
        )
      )}

      <p className="text-xs text-slate-500">
        Sensitive credentials and secret values are intentionally excluded.
        This page does not modify betting rules, payment limits, wallet balances,
        or platform configuration.
      </p>
    </div>
  );
}
