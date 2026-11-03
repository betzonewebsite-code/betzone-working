"use client";
import { useEffect } from "react";
import { getSocket } from "@/lib/socketClient";
import { useAuth } from "@/store/authStore";
import { useBetslip } from "@/store/betslipStore";
import { useFixtureStore, type Change } from "@/store/fixtureStore";

/** Mount once in the root layout. Connects to the gateway and feeds live updates into the match list and the bet slip. */
export default function LiveOddsBridge() {
  const userId = useAuth((s) => s.user?.id);

  useEffect(() => {
    const fx = useFixtureStore.getState();
    void fx.load();                                               // the page works even if the live gateway is down
    const s = getSocket();
    let timer: ReturnType<typeof setTimeout>;
    const reloadSoon = () => { clearTimeout(timer); timer = setTimeout(() => void useFixtureStore.getState().load(), 1500); };

    const onConnect = () => { useFixtureStore.getState().setConnected(true); void useFixtureStore.getState().load(); };   // reload after any gap so nothing is missed
    const onDisconnect = () => useFixtureStore.getState().setConnected(false);
    const onUpdate = (p: { changes: Change[] }) => {
      const { updates, locks, unknown } = useFixtureStore.getState().apply(p.changes);
      const slip = useBetslip.getState();
      slip.applyOdds(updates);
      slip.applyLocks(locks);
      if (unknown) reloadSoon();
    };
    const onBalance = (d: { balance: string }) => useAuth.getState().setBalance(d.balance);
    const onBet = () => window.dispatchEvent(new Event("bz:bets"));

    s.on("connect", onConnect); s.on("disconnect", onDisconnect);
    s.on("fixtures:update", onUpdate); s.on("user:balance", onBalance); s.on("user:bet", onBet);
    return () => { clearTimeout(timer); s.off("connect", onConnect); s.off("disconnect", onDisconnect); s.off("fixtures:update", onUpdate); s.off("user:balance", onBalance); s.off("user:bet", onBet); };
  }, []);

  // Reconnect when the player logs in or out, so the gateway puts them in (or removes them from) their private room.
  useEffect(() => { const s = getSocket(); if (s.connected) { s.disconnect(); s.connect(); } }, [userId]);
  return null;
}
