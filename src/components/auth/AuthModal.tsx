"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { useAuth, type Channel } from "@/store/authStore";

const field = "h-11 w-full rounded border border-[var(--line)] bg-transparent px-3 text-sm";

export default function AuthModal() {
  const { modal, step, otpChannel, otpHint, smsFallback, openModal, closeModal, login, register, verifyOtp, resendOtp } = useAuth();
  const [identifier, setIdentifier] = useState(""), [email, setEmail] = useState(""), [phone, setPhone] = useState("");
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [dob, setDob] = useState("");
  const [terms, setTerms] = useState(false), [code, setCode] = useState("");
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [cool, setCool] = useState(0);
  const [err, setErr] = useState<string | null>(null), [info, setInfo] = useState<string | null>(null);

  useEffect(() => { setErr(null); setInfo(null); }, [modal, step]);
  useEffect(() => { if (step === "otp") setCool(60); }, [step]);
  useEffect(() => { if (cool > 0) { const t = setTimeout(() => setCool((c) => c - 1), 1000); return () => clearTimeout(t); } }, [cool]);
  useEffect(() => { if (!modal) { setPassword(""); setConfirm(""); setCode(""); setTerms(false); } }, [modal]);
  useEffect(() => {
    if (!modal) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [modal, closeModal]);

  if (!modal) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (step === "otp") {
      if (!/^\d{6}$/.test(code)) return setErr("Enter the 6-digit code.");
      setBusy(true); const r = await verifyOtp(code); setBusy(false);
      return r.ok ? undefined : setErr(r.error ?? "Could not verify the code.");
    }
    if (modal === "register") {
      if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter a valid email address.");
      if (password !== confirm) return setErr("The two passwords do not match.");
      if (!dob) return setErr("Enter your date of birth.");
      if (!terms) return setErr("Please confirm you are 18 or older and accept the terms.");
      setBusy(true); const r = await register({ email, phone, password, dateOfBirth: dob }); setBusy(false);
      return r.ok ? undefined : setErr(r.error ?? "Could not register.");
    }
    setBusy(true); const r = await login(identifier, password); setBusy(false);
    if (!r.ok) setErr(r.error ?? "Could not log in.");
  }
  async function resend(channel: Channel) {
    setErr(null); setInfo(null);
    const r = await resendOtp(channel);
    if (r.ok) { setCool(60); setInfo(channel === "EMAIL" ? "New code sent by email." : "New code sent by SMS."); } else setErr(r.error ?? "Could not resend.");
  }

  const tab = (m: "login" | "register", label: string) => (
    <button type="button" role="tab" aria-selected={modal === m} onClick={() => openModal(m)}
      className={`flex-1 py-3 text-sm font-bold ${modal === m ? "border-b-2 border-brand text-brand" : "text-neutral-500"}`}>{label}</button>
  );
  const label = "mb-1 block text-xs font-semibold";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Log in or register">
      <button aria-label="Close" className="absolute inset-0 bg-black/60" onClick={closeModal} />
      <div className="relative max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-xl bg-[var(--card)] sm:rounded-xl">
        <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
          <span className="font-extrabold">Bet<span className="ml-0.5 rounded bg-white px-1 text-brand">Zone</span></span>
          <button onClick={closeModal} aria-label="Close"><X size={18} /></button>
        </div>

        {step === "form" && <div role="tablist" className="flex border-b border-[var(--line)]">{tab("login", "Login")}{tab("register", "Register")}</div>}

        <form onSubmit={submit} className="space-y-3 p-4" noValidate>
          {step === "otp" ? (
            <>
              <h2 className="font-bold">{otpChannel === "EMAIL" ? "Check your email" : "Check your phone"}</h2>
              <p className="text-sm text-neutral-600">
                We sent a 6-digit code {otpChannel === "EMAIL" ? "to" : "by SMS to"} <b>{otpHint}</b>.
                {otpChannel === "EMAIL" && " If you cannot see it, check your spam folder."}
              </p>
              <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} aria-label="6-digit code"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${field} text-center text-xl tracking-[0.5em]`} />
              <div className="flex flex-col gap-1.5">
                <button type="button" onClick={() => resend(otpChannel)} disabled={cool > 0} className="w-fit text-xs font-semibold text-brand disabled:text-neutral-400">
                  {cool > 0 ? `Resend code in ${cool}s` : "Resend code"}
                </button>
                {smsFallback && otpChannel === "EMAIL" && (
                  <button type="button" onClick={() => resend("SMS")} disabled={cool > 0} className="w-fit text-xs text-neutral-600 underline disabled:text-neutral-400">
                    No email? Send the code by SMS instead
                  </button>
                )}
                {otpChannel === "SMS" && (
                  <button type="button" onClick={() => resend("EMAIL")} disabled={cool > 0} className="w-fit text-xs text-neutral-600 underline disabled:text-neutral-400">
                    Send the code by email instead
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {modal === "login" ? (
                <div>
                  <label htmlFor="idn" className={label}>Email or phone number</label>
                  <input id="idn" autoFocus autoComplete="username" placeholder="you@example.com or 024 123 4567" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={field} />
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="em" className={label}>Email address</label>
                    <input id="em" type="email" autoFocus autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                    <p className="mt-1 text-2xs text-neutral-500">We will email you a code to confirm it.</p>
                  </div>
                  <div>
                    <label htmlFor="ph" className={label}>Phone number</label>
                    <input id="ph" inputMode="tel" autoComplete="tel" placeholder="024 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
                    <p className="mt-1 text-2xs text-neutral-500">Used for mobile money payments.</p>
                  </div>
                </>
              )}
              <div>
                <label htmlFor="pw" className={label}>Password</label>
                <div className="relative">
                  <input id="pw" type={show ? "text" : "password"} autoComplete={modal === "login" ? "current-password" : "new-password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} className={`${field} pr-10`} />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {modal === "register" && <p className="mt-1 text-2xs text-neutral-500">At least 8 characters, with a letter and a number.</p>}
              </div>
              {modal === "register" && (
                <>
                  <div>
                    <label htmlFor="pw2" className={label}>Confirm password</label>
                    <input id="pw2" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label htmlFor="dob" className={label}>Date of birth</label>
                    <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={field} />
                  </div>
                  <label className="flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 accent-brand" />
                    <span>I am 18 or older and I accept the Terms and Conditions. I understand betting involves risk.</span>
                  </label>
                </>
              )}
            </>
          )}

          {err && <p role="alert" className="text-xs font-semibold text-drop">{err}</p>}
          {info && <p role="status" className="text-xs font-semibold text-win">{info}</p>}
          <button type="submit" disabled={busy} className="cta-red w-full disabled:opacity-60">
            {busy ? "Please wait…" : step === "otp" ? "Verify" : modal === "register" ? "Register" : "Login"}
          </button>
          {step === "otp" && <button type="button" onClick={closeModal} className="w-full text-xs text-neutral-500 underline">Cancel</button>}
          <p className="text-center text-2xs text-neutral-500">Gamble responsibly. 18+ only.</p>
        </form>
      </div>
    </div>
  );
}
