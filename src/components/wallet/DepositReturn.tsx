"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/limits";
import { useAuth } from "@/store/authStore";

/** The page Paystack sends the player back to. It asks the server to confirm the payment, which credits the wallet exactly once. */
export default function DepositReturn() {
  const sp = useSearchParams();
  const reference = sp.get("reference") ?? sp.get("trxref");
  const [state, setState] = useState<{ status: string; amount?: string; error?: string }>({ status: "CHECKING" });

  useEffect(() => {
    if (!reference) { setState({ status: "ERROR", error: "No payment reference found." }); return; }
    let tries = 0, stop = false;
    const check = async () => {
      const r = await api(`/api/wallet/deposit/verify?reference=${encodeURIComponent(reference)}`);
      if (stop) return;
      if (!r.ok) return setState({ status: "ERROR", error: r.data.error ?? "Could not check the payment." });
      setState({ status: r.data.status, amount: r.data.amount });
      if (r.data.status === "SUCCESSFUL") void useAuth.getState().load();
      else if (r.data.status === "PENDING" && ++tries < 10) setTimeout(check, 3000);     // mobile money can take a moment to confirm
    };
    void check();
    return () => { stop = true; };
  }, [reference]);

  return (
    <div className="panel space-y-3 p-6 text-center">
      {state.status === "CHECKING" && <p>Checking your payment…</p>}
      {state.status === "PENDING" && <p>Waiting for confirmation. Approve the prompt on your phone if you have not yet. This page updates by itself.</p>}
      {state.status === "SUCCESSFUL" && <p className="text-lg font-bold text-win">Deposit of {fmt(state.amount ?? 0)} received.</p>}
      {state.status === "FAILED" && <p className="text-lg font-bold text-drop">The payment was not completed. You have not been charged.</p>}
      {state.status === "ERROR" && <p className="font-semibold text-drop">{state.error}</p>}
      <div className="flex justify-center gap-2">
        <Link href="/" className="cta-red">Start betting</Link>
        <Link href="/me/transactions" className="rounded border border-brand px-3 py-2 text-sm font-bold text-brand">History</Link>
      </div>
    </div>
  );
}
