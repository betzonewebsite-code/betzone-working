"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import BetSlip from "@/components/betslip/BetSlip";
import { useBetslip } from "@/store/betslipStore";

export default function MobileSlipSheet() {
  const open = useBetslip((s) => s.open);
  const setOpen = useBetslip((s) => s.setOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Bet slip">
      <button aria-label="Close bet slip" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="absolute inset-x-0 bottom-0 animate-slide-in rounded-t-xl bg-[var(--canvas)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button onClick={() => setOpen(false)} aria-label="Close" className="mb-1 ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white"><X size={14} /></button>
        <BetSlip />
      </div>
    </div>
  );
}
