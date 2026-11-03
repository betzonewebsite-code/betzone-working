"use client";
import { create } from "zustand";
import { api } from "@/lib/api";

export type AuthUser = { id: string; email: string; phone: string; firstName: string | null; lastName: string | null; kycStatus: string; role: string; currency: string; balance: string; emailVerified: boolean; phoneVerified: boolean; hasPin: boolean };
type Res = { ok: boolean; error?: string };
type Modal = "login" | "register" | null;
export type Channel = "EMAIL" | "SMS";

type State = {
  user: AuthUser | null;
  status: "loading" | "anon" | "authed";
  modal: Modal; step: "form" | "otp";
  pendingEmail: string | null; otpChannel: Channel; otpHint: string; smsFallback: boolean;
  openModal: (m: Exclude<Modal, null>) => void;
  closeModal: () => void;
  load: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<Res>;
  register: (i: { email: string; phone: string; password: string; dateOfBirth: string }) => Promise<Res>;
  verifyOtp: (code: string) => Promise<Res>;
  resendOtp: (channel: Channel) => Promise<Res>;
  logout: () => Promise<void>;
  setBalance: (b: string) => void;
};

const maskEmail = (e: string) => { const [u, d] = e.split("@"); return `${u.slice(0, 2)}***@${d}`; };

export const useAuth = create<State>((set, get) => {
  const signedIn = (user: AuthUser) => set({ user, status: "authed", modal: null, step: "form", pendingEmail: null });
  return {
    user: null, status: "loading", modal: null, step: "form", pendingEmail: null, otpChannel: "EMAIL", otpHint: "", smsFallback: true,
    setBalance: (balance) => set((st) => (st.user ? { user: { ...st.user, balance } } : st)),
    openModal: (modal) => set({ modal, step: "form" }),
    closeModal: () => set({ modal: null, step: "form", pendingEmail: null }),

    load: async () => {
      const r = await api("/api/auth/me");
      r.ok ? set({ user: r.data.user, status: "authed" }) : set({ user: null, status: "anon" });
    },
    login: async (identifier, password) => {
      const r = await api("/api/auth/login", { body: { identifier, password } });
      if (r.ok) { signedIn(r.data.user); return { ok: true }; }
      if (r.status === 403 && r.data.code === "NOT_VERIFIED") {
        set({ pendingEmail: r.data.email, otpChannel: "EMAIL", otpHint: maskEmail(r.data.email), smsFallback: true, step: "otp" });
        return { ok: true };
      }
      return { ok: false, error: r.data.error };
    },
    register: async (i) => {
      const r = await api("/api/auth/register", { body: { ...i, acceptTerms: true } });
      if (!r.ok) return { ok: false, error: r.data.error };
      set({ pendingEmail: i.email.trim().toLowerCase(), otpChannel: "EMAIL", otpHint: r.data.email, smsFallback: !!r.data.smsFallback, step: "otp" });
      return { ok: true };
    },
    verifyOtp: async (code) => {
      const r = await api("/api/auth/verify-otp", { body: { email: get().pendingEmail, code } });
      if (r.ok) { signedIn(r.data.user); return { ok: true }; }
      return { ok: false, error: r.data.error };
    },
    resendOtp: async (channel) => {
      const r = await api("/api/auth/resend-otp", { body: { email: get().pendingEmail, channel } });
      if (!r.ok) return { ok: false, error: r.data.error };
      const email = get().pendingEmail ?? "";
      set({ otpChannel: channel, otpHint: channel === "EMAIL" ? maskEmail(email) : "your registered phone number" });
      return { ok: true };
    },
    logout: async () => { await api("/api/auth/logout", { method: "POST", body: {} }); set({ user: null, status: "anon" }); },
  };
});
