"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/authStore";

/** Withdrawals go to the player's own phone, so the number must be proven first. */
export default function PhoneVerify() {
  const user = useAuth((s) => s.user)!;
  const [sent, setSent] = useState(false), [code, setCode] = useState(""), [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setBusy(true); setErr(null);
    const r = await api("/api/auth/phone/send", { body: {} });
    setBusy(false);
    r.ok ? setSent(true) : setErr(r.data.error ?? "Could not send the code.");
  }
  async function verify() {
    setBusy(true); setErr(null);
    const r = await api("/api/auth/phone/verify", { body: { code } });
    if (r.ok) { await useAuth.getState().load(); return; }
    setBusy(false); setErr(r.data.error ?? "Wrong code.");
  }
  return (
    <div className="panel space-y-3 p-4">
      <h2 className="font-bold">Verify your phone number</h2>
      <p className="text-sm text-neutral-600">Withdrawals are paid to <b>{user.phone}</b>. We will text you a code to confirm it is yours.</p>
      {sent && <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} aria-label="6-digit code" onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-11 w-full rounded border border-[var(--line)] bg-transparent text-center text-xl tracking-[0.5em]" />}
      {err && <p role="alert" className="text-xs font-semibold text-drop">{err}</p>}
      <button onClick={sent ? verify : send} disabled={busy || (sent && code.length !== 6)} className="cta-red w-full disabled:opacity-60">{sent ? "Verify" : "Send code by SMS"}</button>
    </div>
  );
}
