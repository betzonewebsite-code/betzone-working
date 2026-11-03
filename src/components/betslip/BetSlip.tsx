"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { X, Lock, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { multiple, single, flexi as flexiCalc, systemBet } from "@/lib/betMath";
import { fmt } from "@/lib/limits";
import { useAuth } from "@/store/authStore";
import { useBetslip } from "@/store/betslipStore";

export default function BetSlip() {
  const {
    items, tab, stake, singleStakes, flexi, systemSize, acceptChanges, bookedCode,
    setTab, setStake, setSingleStake, setFlexi, setSystemSize, setAccept, setOdds,
    remove, clear, book, loadCode
  } = useBetslip();

  const user = useAuth((s) => s.user);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const attempt = useRef<string>(crypto.randomUUID());

  const odds = items.map((i) => i.odds);
  const blocked = items.some((i) => i.suspended);
  const changed = items.some((i) => i.odds !== i.pickedOdds);
  const hasLive = items.some((i) => i.live);
  const multi = items.length >= 2 ? multiple(odds, stake) : null;
  const flex = flexi && items.length >= 2 ? flexiCalc(odds, stake, flexi) : null;
  const system = items.length >= 3 ? systemBet(odds, stake, systemSize) : null;
  const singleTotal = items.reduce((s, i) => s + (singleStakes[i.key] ?? 0), 0);
  const singleReturn = items.reduce((s, i) => s + single(i.odds, singleStakes[i.key] ?? 0), 0);

  const canPlace = !busy && !blocked && (
    (tab === "single" && singleTotal > 0) ||
    (tab === "multiple" && items.length >= 2 && stake > 0 && (flexi === 0 || !!flex)) ||
    (tab === "system" && items.length >= 3 && systemSize < items.length && stake > 0 && !!system)
  );

  async function onPlace() {
    if (!user) return useAuth.getState().openModal("login");

    setBusy(true);
    setMsg(null);

    try {
      const stakes = Object.fromEntries(
        items
          .filter((i) => (singleStakes[i.key] ?? 0) > 0)
          .map((i) => [i.oddsId, singleStakes[i.key]])
      );

      const r = await api("/api/bets/place", {
        body: {
          tab,
          selections: items.map((i) => ({ oddsId: i.oddsId, odds: i.odds })),
          stake: tab !== "single" ? stake : undefined,
          stakes: tab === "single" ? stakes : undefined,
          flexiCut: tab === "multiple" ? flexi : 0,
          systemSize: tab === "system" ? systemSize : undefined,
          acceptOddsChange: acceptChanges,
          idempotencyKey: attempt.current,
        }
      });

      if (r.ok) {
        useAuth.getState().setBalance(r.data.balance);
        attempt.current = crypto.randomUUID();
        clear();
        setMsg({
          ok: true,
          text: r.data.tickets.length > 1
            ? `${r.data.tickets.length} bets placed.`
            : `Bet placed (${r.data.tickets[0].publicId}).`,
          link: true
        });
      } else if (r.data.code === "ODDS_CHANGED") {
        setOdds(r.data.changes);
        attempt.current = crypto.randomUUID();
        setMsg({
          ok: false,
          text: "Some odds changed. Check the new odds, then place your bet again."
        });
      } else {
        setMsg({ ok: false, text: r.data.error ?? "Could not place the bet." });
      }
    } catch {
      setMsg({
        ok: false,
        text: "Network problem. Tap Place bet again; you will not be charged twice."
      });
    }

    setBusy(false);
  }

  async function onBook() {
    setBusy(true);
    try {
      await book();
      setMsg(null);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  async function onLoad() {
    if (!code.trim()) return;

    setBusy(true);
    const r = await loadCode(code);

    setMsg(
      r.ok
        ? {
            ok: true,
            text: r.warnings.length
              ? `Loaded with changes: ${r.warnings.join("; ")}`
              : "Code loaded."
          }
        : { ok: false, text: r.error ?? "Could not load code." }
    );

    if (r.ok) setCode("");
    setBusy(false);
  }

  async function copy() {
    if (!bookedCode) return;
    await navigator.clipboard.writeText(bookedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <aside className="flex max-h-[calc(100vh-120px)] flex-col overflow-hidden rounded border border-[#E1E5EA] bg-white shadow-md">

      {/* SportyBet-style dark betslip header */}
      <div className="flex items-center justify-between border-b border-[#303941] bg-[#1E252B] text-white">
        <div className="flex flex-1">
          {(["single", "multiple", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 px-2 py-3 text-xs font-bold capitalize transition-colors ${
                tab === t
                  ? "bg-[#263238] text-white after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[3px] after:bg-[#00A859]"
                  : "text-gray-400 hover:bg-[#303941] hover:text-white"
              }`}
            >
              {t}
              {t === "multiple" && items.length > 0 && (
                <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-[#1E252B]">
                  {items.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selection cards */}
      <div className="min-h-[100px] flex-1 overflow-y-auto bg-white no-scrollbar">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F4F7] text-[#89939C]">
              <Lock size={16} />
            </div>
            <p className="text-xs font-semibold text-[#68737D]">
              Your betslip is empty
            </p>
            <p className="mt-1 text-[11px] text-[#929BA3]">
              Select odds from a match or load a booking code below.
            </p>
          </div>
        ) : (
          items.map((i) => (
            <div
              key={i.key}
              className="animate-slide-in border-b border-[#E1E5EA] bg-white p-3 transition-colors hover:bg-[#FAFBFC]"
            >
              <div className="flex items-start gap-2">
                <button
                  aria-label={`Remove ${i.match}`}
                  onClick={() => remove(i.key)}
                  className="mt-0.5 rounded p-0.5 text-[#9AA2AA] transition hover:bg-red-50 hover:text-[#E30613]"
                >
                  <X size={14} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-[#263238]">
                    {i.pick}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] font-semibold text-[#68737D]">
                    {i.marketName} · {i.match}{i.live ? " · LIVE" : ""}
                  </div>
                </div>

                <div className={`flex items-center gap-1 rounded bg-[#F2F4F7] px-2 py-1 text-xs font-extrabold tabular-nums ${
                  i.odds > i.pickedOdds
                    ? "text-[#00A859]"
                    : i.odds < i.pickedOdds
                      ? "text-[#E30613]"
                      : "text-[#263238]"
                }`}>
                  {i.suspended ? (
                    <Lock size={13} className="text-[#E30613]" />
                  ) : (
                    fmt(i.odds)
                  )}
                </div>
              </div>

              {tab === "single" && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-[#68737D]">
                    Stake (GHS)
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="Enter stake"
                    value={singleStakes[i.key] ?? ""}
                    onChange={(e) => setSingleStake(i.key, Number(e.target.value) || 0)}
                    className="h-8 w-28 rounded border border-[#D5DADF] bg-white px-2 text-right text-xs font-bold text-[#263238] outline-none transition focus:border-[#00A859] focus:ring-1 focus:ring-[#00A859]/20"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bet calculations and stake controls */}
      {items.length > 0 && (
        <div className="space-y-3 border-t border-[#E1E5EA] bg-[#F2F4F7] p-3">

          {tab === "multiple" && (
            <>
              <div className="flex gap-1.5">
                {([0, 1, 2] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setFlexi(c)}
                    disabled={c > 0 && items.length - c < 2}
                    className={`flex-1 rounded border py-2 text-[11px] font-bold transition disabled:opacity-40 ${
                      flexi === c
                        ? "border-[#00A859] bg-[#E5F5ED] text-[#008744]"
                        : "border-[#D5DADF] bg-white text-[#68737D] hover:border-[#00A859]"
                    }`}
                  >
                    {c === 0 ? "No Flexi" : `Cut ${c}`}
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between text-xs font-bold text-[#263238]">
                Total Stake
                <div className="flex h-9 w-32 items-center rounded border border-[#D5DADF] bg-white px-2 focus-within:border-[#00A859]">
                  <span className="mr-1 text-[10px] font-bold text-[#68737D]">GHS</span>
                  <input
                    inputMode="decimal"
                    value={stake || ""}
                    onChange={(e) => setStake(Number(e.target.value) || 0)}
                    className="w-full bg-transparent text-right text-xs font-bold text-[#263238] outline-none"
                  />
                </div>
              </label>

              {multi && (
                <dl className="space-y-1 border-t border-[#E1E5EA] pt-2 text-[11px] text-[#68737D]">
                  <Row k="Total odds" v={fmt(multi.totalOdds)} />
                  <Row k="Total stake" v={`GHS ${fmt(stake)}`} />
                  {flex ? (
                    <>
                      <Row k={`Flexi: ${flex.combos} bets × ${fmt(flex.unitStake)}`} v="" />
                      <Row k="Min payout (cut legs lost)" v={fmt(flex.minPayout)} />
                      <Row k="Max payout" v={fmt(flex.maxPayout)} bold green />
                    </>
                  ) : (
                    <>
                      {multi.bonusPct > 0 && (
                        <Row k={`Super Bonus ${multi.bonusPct}%`} v={`+${fmt(multi.bonus)}`} green />
                      )}
                      <Row k="Potential payout" v={`GHS ${fmt(multi.payout)}`} bold green />
                    </>
                  )}
                </dl>
              )}
            </>
          )}

          {tab === "single" && (
            <div className="space-y-1 border-t border-[#E1E5EA] pt-2 text-[11px]">
              <Row k="Total stake" v={`GHS ${fmt(singleTotal)}`} />
              <Row k="Potential payout" v={`GHS ${fmt(singleReturn)}`} bold green />
            </div>
          )}

          {tab === "system" && (
            <>
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-[#263238]">
                  Choose your System combination
                </p>
                {items.length >= 3 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from(
                      { length: Math.min(10, items.length - 1) - 1 },
                      (_, index) => index + 2
                    ).map((size) => (
                      <button
                        key={size}
                        onClick={() => setSystemSize(size)}
                        className={`rounded border py-2 text-[11px] font-bold transition ${
                          systemSize === size
                            ? "border-[#00A859] bg-[#E5F5ED] text-[#008744]"
                            : "border-[#D5DADF] bg-white text-[#68737D] hover:border-[#00A859]"
                        }`}
                      >
                        {size}/{items.length}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
                    Add at least 3 selections from different matches to create a System bet.
                  </p>
                )}
              </div>

              <label className="flex items-center justify-between text-xs font-bold text-[#263238]">
                Total Stake
                <div className="flex h-9 w-32 items-center rounded border border-[#D5DADF] bg-white px-2 focus-within:border-[#00A859]">
                  <span className="mr-1 text-[10px] font-bold text-[#68737D]">GHS</span>
                  <input
                    inputMode="decimal"
                    value={stake || ""}
                    onChange={(e) => setStake(Number(e.target.value) || 0)}
                    className="w-full bg-transparent text-right text-xs font-bold text-[#263238] outline-none"
                  />
                </div>
              </label>

              {system && (
                <dl className="space-y-1 border-t border-[#E1E5EA] pt-2 text-[11px] text-[#68737D]">
                  <Row k="System combinations" v={`${system.combos} × GHS ${fmt(system.unitStake)}`} />
                  <Row k="Total stake" v={`GHS ${fmt(system.totalStake)}`} />
                  <Row k="Lowest single-combination return" v={`GHS ${fmt(system.minPayout)}`} />
                  <Row k="Maximum payout" v={`GHS ${fmt(system.maxPayout)}`} bold green />
                </dl>
              )}
            </>
          )}

          {changed && (
            <p className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
              Odds have changed since you added these.
            </p>
          )}

          {blocked && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-[11px] font-semibold text-[#C7040F]">
              Remove locked selections to place this bet.
            </p>
          )}

          {hasLive && (
            <p className="text-[10px] text-[#68737D]">
              In-play bets are confirmed after a short delay.
            </p>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-[#4B5660]">
            <input
              type="checkbox"
              checked={acceptChanges}
              onChange={(e) => setAccept(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#00A859]"
            />
            Accept odds changes
          </label>

          <div className="flex gap-2">
            <button
              onClick={clear}
              className="rounded border border-[#D5DADF] bg-white px-3 py-2 text-xs font-bold text-[#59636D] transition hover:bg-[#E9ECEF]"
            >
              Clear
            </button>

            <button
              disabled={!canPlace}
              onClick={onPlace}
              className="flex-1 rounded bg-[#00A859] px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#008744] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Placing..." : user ? "Place Bet" : "Log in to bet"}
            </button>
          </div>
        </div>
      )}

      {/* Booking code section */}
      <div className="space-y-2 border-t border-[#D5DADF] bg-[#F2F4F7] p-3">
        {bookedCode ? (
          <div className="flex items-center justify-between rounded bg-[#1E252B] px-3 py-2.5 text-white">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                Booking Code
              </div>
              <span className="font-mono text-base font-extrabold tracking-widest">
                {bookedCode}
              </span>
            </div>
            <button
              onClick={copy}
              aria-label="Copy booking code"
              className="rounded p-2 transition hover:bg-white/10"
            >
              {copied ? (
                <Check size={16} className="text-[#00A859]" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
        ) : (
          <button
            disabled={!items.length || busy}
            onClick={onBook}
            className="w-full rounded border border-[#00A859] bg-white py-2 text-xs font-bold text-[#008744] transition hover:bg-[#E5F5ED] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Book Bet
          </button>
        )}

        <div className="flex gap-1.5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onLoad()}
            maxLength={8}
            placeholder="Booking code e.g. BZ89K2"
            className="h-9 min-w-0 flex-1 rounded border border-[#D5DADF] bg-white px-2 font-mono text-xs text-[#263238] outline-none transition placeholder:text-[#A0A8AF] focus:border-[#00A859]"
          />
          <button
            disabled={busy}
            onClick={onLoad}
            className="rounded bg-[#1E252B] px-4 text-xs font-bold text-white transition hover:bg-[#303941] disabled:opacity-40"
          >
            Load
          </button>
        </div>

        {msg && (
          <p
            role="status"
            className={`rounded p-2 text-[11px] font-semibold ${
              msg.ok
                ? "border border-green-200 bg-green-50 text-[#008744]"
                : "border border-red-200 bg-red-50 text-[#C7040F]"
            }`}
          >
            {msg.text}{" "}
            {msg.link && (
              <Link href="/my-bets" className="font-bold underline">
                View in My Bets
              </Link>
            )}
          </p>
        )}
      </div>
    </aside>
  );
}

function Row({
  k, v, bold, green
}: {
  k: string;
  v: string;
  bold?: boolean;
  green?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-2 ${
      bold ? "text-xs font-extrabold" : ""
    } ${green ? "text-[#008744]" : "text-[#68737D]"}`}>
      <dt>{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  );
}
