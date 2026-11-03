"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Renders children only after mount. Use around anything fed by persisted stores to avoid hydration mismatches. */
export default function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}
