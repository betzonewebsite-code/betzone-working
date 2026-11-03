"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/authStore";

export default function PinSetup() {
  const hasPin = useAuth((s) => !!s.user?.hasPin);
  const [password, setPassword] = useState(""), [pin, setPin] = useState(""), [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false);
  const field = "h-10 w-full rounded border border-[var(--line)] bg-transparent px-3 text-sm";
  const digits = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/\D/g, "").slice(0, 4));

  async function save() {
    setMsg(null);
    if (pin !== again) return setMsg({ ok: false, text: "The two PINs do not match." });
    setBusy(true);
    const r = await api("/api/wallet/pin", { body: { password, pin } });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.data.error ?? "Could not save the PIN." });
    setPassword(""); setPin(""); setAgain("");
    setMsg({ ok: true, text: hasPin ? "PIN changed." : "PIN created." });
    await useAuth.getState().load();
  }
  return (
    <div className="panel space-y-3 p-4">
      <h2 className="font-bold">{hasPin ? "Change withdrawal PIN" : "Create a withdrawal PIN"}</h2>
      <input type="password" autoComplete="current-password" placeholder="Your account password" aria-label="Account password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      <input type="password" inputMode="numeric" autoComplete="off" placeholder="New 4-digit PIN" aria-label="New PIN" value={pin} onChange={digits(setPin)} className={`${field} text-center tracking-[0.5em]`} />
      <input type="password" inputMode="numeric" autoComplete="off" placeholder="Repeat PIN" aria-label="Repeat PIN" value={again} onChange={digits(setAgain)} className={`${field} text-center tracking-[0.5em]`} />
      {msg && <p role="alert" className={`text-xs font-semibold ${msg.ok ? "text-win" : "text-drop"}`}>{msg.text}</p>}
      <button onClick={save} disabled={busy || pin.length !== 4 || !password} className="cta-red w-full disabled:opacity-60">{hasPin ? "Change PIN" : "Create PIN"}</button>
    </div>
  );
}
