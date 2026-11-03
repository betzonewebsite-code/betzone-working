"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AmountPicker from "./AmountPicker";
import PhoneVerify from "./PhoneVerify";
import PinSetup from "./PinSetup";
import { api } from "@/lib/api";
import { MIN_WD, NETWORKS, fmt } from "@/lib/limits";
import { useAuth } from "@/store/authStore";

type Tx = { id: string; status: "PENDING" | "PROCESSING" | "SUCCESSFUL" | "FAILED" | "REVERSED" };
const STEPS = ["Requested", "Processing", "Paid"];

function Tracker({ id, needsApproval, onAgain }: { id: string; needsApproval: boolean; onAgain: () => void }) {
  const [status, setStatus] = useState<Tx["status"]>("PROCESSING");
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      const r = await api("/api/wallet/transactions?type=withdrawal&limit=10");
      const t = (r.data?.transactions as Tx[] | undefined)?.find((x) => x.id === id);
      if (stop || !t) return;
      setStatus(t.status);
      if (t.status === "PROCESSING" || t.status === "PENDING") setTimeout(poll, 4000); else void useAuth.getState().load();
    };
    void poll();
    return () => { stop = true; };
  }, [id]);
  const at = status === "SUCCESSFUL" ? 2 : 1;
  const failed = status === "FAILED" || status === "REVERSED";
  return (
    <div className="panel space-y-4 p-4">
      <ol className="flex items-center" aria-label="Withdrawal status">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col items-center gap-1 text-center text-xs">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full font-bold ${failed ? "bg-odds-bg text-neutral-500" : i <= at ? (status === "SUCCESSFUL" ? "bg-win text-white" : "bg-brand text-white") : "bg-odds-bg text-neutral-500"}`}>{i + 1}</span>
            <span className={i <= at && !failed ? "font-bold" : "text-neutral-500"}>{s}</span>
          </li>
        ))}
      </ol>
      {needsApproval && status === "PROCESSING" && <p className="text-center text-sm">This amount needs a quick manual review before it is sent.</p>}
      {status === "SUCCESSFUL" && <p className="text-center text-sm font-bold text-win">Sent to your phone.</p>}
      {failed && <p className="text-center text-sm font-bold text-drop">The withdrawal failed and the money was returned to your balance.</p>}
      <div className="flex justify-center gap-2">
        <button onClick={onAgain} className="rounded border border-brand px-3 py-1.5 text-sm font-bold text-brand">Another withdrawal</button>
        <Link href="/me/transactions" className="cta-red">History</Link>
      </div>
    </div>
  );
}

export default function WithdrawFlow() {
  const user = useAuth((s) => s.user);
  const [network, setNetwork] = useState("mtn"), [amount, setAmount] = useState(0), [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; needsApproval: boolean } | null>(null);

  if (!user) return <div className="panel space-y-3 p-6 text-center"><p className="text-sm">Log in to withdraw.</p><button onClick={() => useAuth.getState().openModal("login")} className="cta-red">Log in</button></div>;
  if (!user.phoneVerified) return <PhoneVerify />;
  if (!user.hasPin) return <PinSetup />;
  if (sent) return <Tracker id={sent.id} needsApproval={sent.needsApproval} onAgain={() => { setSent(null); setAmount(0); setPin(""); }} />;
  const balance = Number(user.balance);

  async function submit() {
    setErr(null);
    if (amount < MIN_WD) return setErr(`The minimum withdrawal is ${MIN_WD}.`);
    if (amount > balance) return setErr("That is more than your balance.");
    setBusy(true);
    const r = await api("/api/wallet/withdraw", { body: { amount, network, pin } });
    setBusy(false); setPin("");
    if (r.ok) { void useAuth.getState().load(); setSent({ id: r.data.id, needsApproval: r.data.needsApproval }); } else setErr(r.data.error ?? "Could not withdraw.");
  }
  return (
    <div className="panel space-y-4 p-4">
      <p className="text-sm">Available: <b className="tabular-nums">{user.currency} {fmt(balance)}</b></p>
      <p className="rounded bg-brand-soft p-2 text-xs text-brand">Payouts go only to your verified number <b>{user.phone}</b>.</p>
      <div>
        <label htmlFor="net" className="mb-1 block text-xs font-semibold">Network</label>
        <select id="net" value={network} onChange={(e) => setNetwork(e.target.value)} className="h-10 w-full rounded border border-[var(--line)] bg-transparent px-2 text-sm">
          {NETWORKS.map((n) => <option key={n.id} value={n.id} className="text-ink">{n.label}</option>)}
        </select>
      </div>
      <AmountPicker value={amount} onChange={setAmount} chips={[10, 50, 100]} max={Math.max(balance, 0)} />
      <button type="button" onClick={() => setAmount(balance)} className="text-xs font-semibold text-brand underline">Withdraw everything</button>
      <div>
        <label htmlFor="pin" className="mb-1 block text-xs font-semibold">Withdrawal PIN</label>
        <input id="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="h-10 w-full rounded border border-[var(--line)] bg-transparent px-3 text-center tracking-[0.5em]" />
      </div>
      {err && <p role="alert" className="text-xs font-semibold text-drop">{err}</p>}
      <button onClick={submit} disabled={busy || balance <= 0 || pin.length !== 4} className="cta-red w-full disabled:opacity-40">{busy ? "Sending…" : "Withdraw"}</button>
      {balance <= 0 && <p className="text-xs text-neutral-500">Nothing to withdraw yet. <Link href="/me/deposit" className="font-bold text-brand underline">Make a deposit</Link>.</p>}
    </div>
  );
}
