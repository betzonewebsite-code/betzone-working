"use client";

import { useRef, useState } from "react";
import { X, Trash2, Play } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/authStore";

export type VirtualSlipItem = {
  key: string;
  oddsId: string;
  fixtureId: string;
  marketId: string;
  selectionId: string;
  match: string;
  marketName: string;
  pick: string;
  odds: number;
  pickedOdds: number;
};

type BetMode = "single" | "multiple" | "system";

const SUPER_BONUS: Record<number, number> = {
  3: 3,
  4: 5,
  5: 8,
  6: 12,
  7: 15,
  8: 20,
  9: 25,
  10: 30,
};

function getCombinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];

  const [first, ...rest] = items;

  return [
    ...getCombinations(rest, size - 1).map((combination) => [
      first,
      ...combination,
    ]),
    ...getCombinations(rest, size),
  ];
}

function getSystemReturn(
  odds: number[],
  stake: number,
  systemSize: number
): number {
  const combinations = getCombinations(odds, systemSize);

  if (!combinations.length) return 0;

  const stakePerCombination = stake / combinations.length;

  return combinations.reduce((total, combination) => {
    const combinationOdds = combination.reduce(
      (product, odd) => product * odd,
      1
    );

    return total + stakePerCombination * combinationOdds;
  }, 0);
}

function getMultipleBonus(odds: number[]): number {
  const qualifyingSelections = odds.filter((odd) => odd >= 1.2).length;

  if (qualifyingSelections < 3) return 0;

  return SUPER_BONUS[Math.min(qualifyingSelections, 10)] ?? 0;
}

export default function VirtualBetslip({
  items,
  onRemove,
  onClear,
  onClose,
}: {
  items: VirtualSlipItem[];
  onRemove: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const user = useAuth((s) => s.user);

  const [mode, setMode] = useState<BetMode>("single");
  const [stake, setStake] = useState("10");
  const [systemSize, setSystemSize] = useState(2);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [ticketIds, setTicketIds] = useState<string[]>([]);
  const [kickoffBusy, setKickoffBusy] = useState(false);

  const attempt = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `virtual-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const amount = Number(stake);

  const validStake =
    Number.isFinite(amount) &&
    amount > 0 &&
    Math.round(amount * 100) === amount * 100;

  const odds = items.map((item) => item.odds);

  const totalOdds = odds.reduce((total, odd) => total * odd, 1);

  const distinctFixtures =
    new Set(items.map((item) => item.fixtureId)).size === items.length;

  const effectiveSystemSize = Math.min(
    systemSize,
    Math.max(2, items.length - 1)
  );

  const combinationCount =
    items.length >= 3
      ? getCombinations(items, effectiveSystemSize).length
      : 0;

  const multipleBonus = getMultipleBonus(odds);

  const singleTotalStake = amount * items.length;

  const singlePotentialReturn = items.reduce(
    (total, item) => total + amount * item.odds,
    0
  );

  const multiplePotentialReturn =
    amount * totalOdds +
    ((amount * totalOdds - amount) * multipleBonus) / 100;

  const systemPotentialReturn = getSystemReturn(
    odds,
    amount,
    effectiveSystemSize
  );

  const totalStake =
    mode === "single" ? singleTotalStake : amount;

  const potentialReturn =
    mode === "single"
      ? singlePotentialReturn
      : mode === "multiple"
        ? multiplePotentialReturn
        : systemPotentialReturn;

  function changeMode(nextMode: BetMode) {
    setMode(nextMode);
    setMessage("");
  }

  async function placeVirtualBet() {
    if (!user) {
      useAuth.getState().openModal("login");
      return;
    }

    if (!items.length || !validStake) {
      setMessage("Enter a valid stake and select at least one outcome.");
      return;
    }

    if (items.some((item) => !Number.isFinite(item.odds) || item.odds < 1)) {
      setMessage("One or more selections have invalid odds.");
      return;
    }

    if (mode === "multiple" && items.length < 2) {
      setMessage("A Multiple needs at least 2 selections.");
      return;
    }

    if (mode === "system" && items.length < 3) {
      setMessage("A System bet needs at least 3 selections.");
      return;
    }

    if (mode !== "single" && !distinctFixtures) {
      setMessage("Select only one outcome from each match.");
      return;
    }

    if (
      mode === "system" &&
      (effectiveSystemSize < 2 || effectiveSystemSize >= items.length)
    ) {
      setMessage("Choose a valid System combination size.");
      return;
    }

    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await api("/api/bets/place", {
        body: {
          tab: mode,
          selections: items.map((item) => ({
            oddsId: item.oddsId,
            odds: item.odds,
          })),
          stake: mode === "single" ? undefined : amount,
          stakes:
            mode === "single"
              ? Object.fromEntries(
                  items.map((item) => [item.oddsId, amount])
                )
              : undefined,
          systemSize: mode === "system" ? effectiveSystemSize : undefined,
          flexiCut: 0,
          acceptOddsChange: false,
          idempotencyKey: attempt.current,
        },
      });

      if (!response.ok) {
        if (response.data.code === "ODDS_CHANGED") {
          setMessage(
            "The odds have changed. Close this slip, review the updated odds and select again."
          );
        } else {
          setMessage(
            response.data.error ?? "Could not place the virtual bet."
          );
        }
        return;
      }

      useAuth.getState().setBalance(response.data.balance);

      const tickets = Array.isArray(response.data.tickets)
        ? response.data.tickets
        : [];

      const ids = tickets
        .map((ticket: { id?: string }) => ticket.id)
        .filter((id: unknown): id is string => typeof id === "string");

      setTicketIds(ids);
      setSuccess(true);

      setMessage(
        tickets.length
          ? `${mode === "single" ? "Virtual singles" : mode === "multiple" ? "Virtual multiple" : "Virtual system"} placed successfully. ${tickets.length} ticket${tickets.length === 1 ? "" : "s"} created.`
          : "Virtual bet placed successfully. View My Bets for your ticket."
      );

      attempt.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `virtual-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      onClear();
    } catch {
      setMessage("Network problem. Check My Bets before trying again.");
    } finally {
      setBusy(false);
    }
  }

  async function kickOff() {
    if (!ticketIds.length) return;

    setKickoffBusy(true);
    setMessage("");

    try {
      const results = await Promise.all(
        ticketIds.map(async (id) => {
          const response = await fetch(
            `/api/virtuals/my-bets/${encodeURIComponent(id)}/kickoff`,
            {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
            }
          );

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.error ?? "Could not kick off the virtual ticket."
            );
          }

          return data;
        })
      );

      setMessage(
        results.length
          ? "Your virtual ticket session has started. Follow its progress in My Bets."
          : "Ticket session could not be started."
      );

      setTicketIds([]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start the virtual ticket."
      );
    } finally {
      setKickoffBusy(false);
    }
  }

  const modes: { value: BetMode; label: string }[] = [
    { value: "single", label: "Single" },
    { value: "multiple", label: "Multiple" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Instant Virtuals betslip"
        className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-2xl bg-white text-[#222] shadow-2xl"
      >
        <header className="flex items-center justify-between bg-[#1a1e26] px-4 py-4 text-white">
          <div>
            <h2 className="text-base font-extrabold">
              Instant Virtuals Betslip
            </h2>
            <p className="text-xs text-white/65">
              {items.length} selection{items.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close virtual betslip"
            className="rounded-lg bg-white/10 p-2"
          >
            <X size={19} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {!success && (
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#f0f2f4] p-1">
              {modes.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => changeMode(tab.value)}
                  aria-pressed={mode === tab.value}
                  className={`rounded-lg py-3 text-sm font-extrabold transition ${
                    mode === tab.value
                      ? "bg-[#1fa24a] text-white shadow-sm"
                      : "text-[#626b75] hover:bg-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {items.length === 0 && !success ? (
            <div className="py-10 text-center">
              <p className="font-bold text-[#424a54]">
                Your virtual slip is empty
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Select green odds from an Instant Virtual match.
              </p>
            </div>
          ) : null}

          {items.map((item) => (
            <article
              key={item.key}
              className="rounded-xl border border-[#e4e7eb] bg-[#f8f9fa] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{item.match}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {item.marketName}
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-[#17703a]">
                    {item.pick}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-md bg-[#d8eedd] px-3 py-2 text-sm font-black text-[#17703a]">
                    {item.odds.toFixed(2)}
                  </span>

                  {!success && (
                    <button
                      type="button"
                      onClick={() => onRemove(item.key)}
                      aria-label={`Remove ${item.pick}`}
                      className="text-neutral-500 hover:text-red-600"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}

          {items.length > 0 && !success && (
            <>
              {mode === "single" && (
                <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                  Each selection is placed as a separate Single ticket. The
                  stake below applies to every selection.
                </p>
              )}

              {mode === "multiple" && (
                <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                  All selections must win for the Multiple to pay out. Choose
                  only one outcome per match.
                </p>
              )}

              {mode === "system" && (
                <div className="space-y-2 rounded-lg bg-blue-50 p-3">
                  <p className="text-xs text-blue-800">
                    A System splits your stake equally across all combinations
                    of the selected size. Choose only one outcome per match.
                  </p>

                  <label className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-blue-900">
                      Combination size
                    </span>

                    <select
                      value={effectiveSystemSize}
                      onChange={(event) =>
                        setSystemSize(Number(event.target.value))
                      }
                      disabled={items.length < 3}
                      className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-900 outline-none"
                    >
                      {items.length >= 3
                        ? Array.from(
                            { length: items.length - 2 },
                            (_, index) => index + 2
                          ).map((size) => (
                            <option key={size} value={size}>
                              {size}-fold
                            </option>
                          ))
                        : <option value={2}>2-fold</option>}
                    </select>
                  </label>

                  {items.length >= 3 && (
                    <p className="text-[11px] text-blue-800">
                      {combinationCount} combinations
                    </p>
                  )}
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-bold text-neutral-600">
                  {mode === "single"
                    ? "Stake per selection (GHS)"
                    : mode === "system"
                      ? "Total System stake (GHS)"
                      : "Stake (GHS)"}
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stake}
                  onChange={(event) => setStake(event.target.value)}
                  className="w-full rounded-lg border border-[#d7dce2] px-3 py-3 text-base font-bold outline-none focus:border-[#1fa24a]"
                />
              </label>

              <div className="space-y-2 rounded-lg bg-[#f8f9fa] p-3">
                {mode === "multiple" && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Combined odds</span>
                    <strong className="tabular-nums">
                      {totalOdds.toFixed(2)}
                    </strong>
                  </div>
                )}

                {mode === "multiple" && multipleBonus > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Super Bonus</span>
                    <strong className="text-[#17703a]">
                      {multipleBonus}%
                    </strong>
                  </div>
                )}

                {mode === "system" && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Combinations</span>
                    <strong>{combinationCount}</strong>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-500">
                    {mode === "single" ? "Total stake" : "Stake"}
                  </span>
                  <strong className="tabular-nums">
                    GHS {validStake ? totalStake.toFixed(2) : "0.00"}
                  </strong>
                </div>

                <div className="flex items-center justify-between border-t border-[#e5e7eb] pt-3">
                  <span className="text-xs font-bold text-[#42634b]">
                    Potential return
                  </span>
                  <strong className="text-lg text-[#17703a]">
                    GHS{" "}
                    {validStake && Number.isFinite(potentialReturn)
                      ? potentialReturn.toFixed(2)
                      : "0.00"}
                  </strong>
                </div>
              </div>

              {mode !== "single" && !distinctFixtures && (
                <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  Remove extra selections so there is only one selection per
                  match.
                </p>
              )}

              {mode === "multiple" && items.length < 2 && (
                <p className="text-xs text-amber-700">
                  Add at least one more selection to place a Multiple.
                </p>
              )}

              {mode === "system" && items.length < 3 && (
                <p className="text-xs text-amber-700">
                  Add at least 3 selections to place a System bet.
                </p>
              )}

              <button
                type="button"
                onClick={onClear}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e0e3e7] py-2 text-xs font-bold text-neutral-500"
              >
                <Trash2 size={14} /> Clear virtual selections
              </button>
            </>
          )}

          {message && (
            <p
              className={`rounded-lg p-3 text-sm ${
                success
                  ? "bg-[#eef7f0] text-[#17703a]"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message}
            </p>
          )}

          {success && (
            <div className="space-y-2">
              {ticketIds.length > 0 && (
                <button
                  type="button"
                  disabled={kickoffBusy}
                  onClick={() => void kickOff()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1fa24a] py-3 font-extrabold text-white disabled:opacity-60"
                >
                  <Play size={16} />
                  {kickoffBusy ? "Starting..." : "Kick Off"}
                </button>
              )}

              <a
                href="/instant-virtual/my-bets"
                className="block w-full rounded-lg bg-[#232833] py-3 text-center text-sm font-bold text-white"
              >
                View My Bets
              </a>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-[#dfe3e8] py-3 text-sm font-bold"
              >
                Keep Betting
              </button>
            </div>
          )}
        </div>

        {items.length > 0 && !success && (
          <footer className="border-t border-[#e5e7eb] bg-white p-4">
            <button
              type="button"
              disabled={busy || !validStake}
              onClick={() => void placeVirtualBet()}
              className="w-full rounded-xl bg-[#1fa24a] py-4 text-sm font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Placing virtual bet..." : "Place Virtual Bet"}
            </button>

            <p className="mt-2 text-center text-[10px] text-neutral-500">
              Bets are placed using your authenticated BETZONE wallet.
            </p>
          </footer>
        )}
      </section>
    </div>
  );
}