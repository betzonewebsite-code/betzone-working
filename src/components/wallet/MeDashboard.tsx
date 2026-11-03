"use client";
import Link from "next/link";
import { fmt } from "@/lib/limits";
import { useAuth } from "@/store/authStore";

export default function MeDashboard() {
  const { user, status, openModal, logout } = useAuth();
  const tile = "panel flex h-20 flex-col items-center justify-center gap-1 text-sm font-semibold hover:bg-brand-soft";
  if (status === "loading") return <p className="panel p-6 text-center text-sm text-neutral-500">Loading…</p>;
  if (!user) return <div className="panel space-y-3 p-6 text-center"><p className="text-sm">Log in or register to see your account.</p><button onClick={() => openModal("login")} className="cta-red">Log in</button></div>;
  const chip = (ok: boolean, label: string) => <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${ok ? "bg-win text-white" : "bg-odds-bg text-ink"}`}>{label}{ok ? " ✓" : ""}</span>;
  return (
    <div className="space-y-3">
      <div className="panel space-y-2 p-4">
        <div className="text-2xs font-bold uppercase text-neutral-500">Balance</div>
        <div className="text-2xl font-bold tabular-nums">{user.currency} {fmt(user.balance)}</div>
        <div className="truncate text-xs text-neutral-500">{user.email} · {user.phone}</div>
        <div className="flex flex-wrap gap-1">{chip(user.emailVerified, "Email")}{chip(user.phoneVerified, "Phone")}{chip(user.hasPin, "PIN")}{chip(user.kycStatus === "VERIFIED", "ID")}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link href="/me/deposit" className={tile}>Deposit</Link>
        <Link href="/me/withdraw" className={tile}>Withdraw</Link>
        <Link href="/me/transactions" className={tile}>Transactions</Link>
        <Link href="/my-bets" className={tile}>My Bets</Link>
        <Link href="/me/security" className={tile}>Security {!user.hasPin && <span className="text-2xs text-brand">Set PIN</span>}</Link>
        <button onClick={() => void logout()} className={tile}>Log out</button>
      </div>
      <p className="text-2xs text-neutral-500">Betting can be addictive. Only stake what you can afford to lose. Need a break? Contact support to set limits or self-exclude.</p>
    </div>
  );
}
