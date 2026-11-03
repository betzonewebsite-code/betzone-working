"use client";
import { useEffect } from "react";
import { useAuth } from "@/store/authStore";

/** Mount once in the root layout. Checks the session cookie on first load. */
export default function AuthBootstrap() {
  useEffect(() => { void useAuth.getState().load(); }, []);
  return null;
}
