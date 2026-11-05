"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import NavBar from "@/components/layout/NavBar";
import BottomNav from "@/components/layout/BottomNav";

export default function RouteChrome() {
  const pathname = usePathname();
  const isStandaloneVirtuals = pathname === "/virtuals";

  if (isStandaloneVirtuals) return null;

  return (
    <>
      <div className="relative z-40">
        <Header />
        <NavBar />
      </div>
      <BottomNav />
    </>
  );
}
