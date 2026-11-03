/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../env";
import { HttpError } from "../http";

const BASE = "https://api.paystack.co";

async function ps(path: string, body?: unknown): Promise<any> {
  if (!env.PAYSTACK_SECRET_KEY) throw new HttpError(503, "Payments are not configured.", "PAYMENTS_OFF");
  const r = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await r.json().catch(() => ({}))) as any;
  if (!r.ok || json.status === false) { console.error("[paystack]", path, r.status, json.message); throw new HttpError(502, json.message ?? "The payment provider returned an error.", "PAYMENT_PROVIDER"); }
  return json.data;
}

// Amounts are in the currency's smallest unit (pesewas for GHS).
export const initializeTransaction = (p: { email: string; amountPesewas: number; reference: string; metadata: object }) =>
  ps("/transaction/initialize", { email: p.email, amount: p.amountPesewas, currency: env.DEFAULT_CURRENCY, reference: p.reference, callback_url: `${env.CLIENT_ORIGIN}/me/deposit/return`, channels: ["mobile_money", "card"], metadata: p.metadata }) as Promise<{ authorization_url: string; reference: string }>;
export const verifyTransaction = (reference: string) => ps(`/transaction/verify/${encodeURIComponent(reference)}`) as Promise<{ status: string; amount: number; currency: string; reference: string }>;
export const createRecipient = (p: { name: string; phone: string; bankCode: string }) =>
  ps("/transferrecipient", { type: "mobile_money", name: p.name, account_number: p.phone, bank_code: p.bankCode, currency: env.DEFAULT_CURRENCY }) as Promise<{ recipient_code: string }>;
export const initiateTransfer = (p: { amountPesewas: number; recipient: string; reference: string }) =>
  ps("/transfer", { source: "balance", amount: p.amountPesewas, recipient: p.recipient, reference: p.reference, reason: "BetZone withdrawal", currency: env.DEFAULT_CURRENCY }) as Promise<{ status: string; transfer_code: string }>;

export function validSignature(raw: string, header: string | null) {
  if (!header || !env.PAYSTACK_SECRET_KEY) return false;
  const mac = createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(raw).digest("hex");
  const a = Buffer.from(mac), b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Paystack's bank codes for Ghana mobile money. Confirm against Paystack's current list before going live.
export const NETWORK_CODES: Record<string, string> = { mtn: "MTN", telecel: "VOD", airteltigo: "ATL" };
