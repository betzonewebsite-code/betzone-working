"use client";
import { useState } from "react";
import AmountPicker from "./AmountPicker";
import { api } from "@/lib/api";
import { MAX_DEP, MIN_DEP, fmt } from "@/lib/limits";
import { useAuth } from "@/store/authStore";

export default function DepositFlow() {
  const user = useAuth((s) => s.user);
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return <div className="panel space-y-3 p-6 text-center"><p className="text-sm">Log in to make a deposit.</p><button onClick={() => useAuth.getState().openModal("login")} className="cta-red">Log in</button></div>;

  async function pay() {
    setErr(null);
    if (amount < MIN_DEP || amount > MAX_DEP) return setErr(`Enter an amount between ${MIN_DEP} and ${fmt(MAX_DEP)}.`);
    setBusy(true);
    const r = await api("/api/wallet/deposit", { body: { amount } });
    if (r.ok) { window.location.href = r.data.authorizationUrl; return; }   // Paystack's secure page takes the payment
    setBusy(false);
    setErr(r.data.error ?? "Could not start the payment.");
  }

  return (
    <div className="panel space-y-4 p-4">
      <p className="text-sm">Balance: <b className="tabular-nums">{user.currency} {fmt(user.balance)}</b></p>
      <AmountPicker value={amount} onChange={setAmount} />
      <p className="text-xs text-neutral-500">You will pay on Paystack&apos;s secure page with mobile money or a card. BetZone never sees your card number or wallet PIN.</p>
      {err && <p role="alert" className="text-xs font-semibold text-drop">{err}</p>}
      <button onClick={pay} disabled={busy} className="cta-red w-full disabled:opacity-60">{busy ? "Opening payment…" : `Pay ${user.currency} ${fmt(amount)}`}</button>
    </div>
  );
}
