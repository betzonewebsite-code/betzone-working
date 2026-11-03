import { createHmac, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { HttpError } from "./http";

export type Game = { id: string; title: string; category: "virtual-instant" | "virtual-scheduled" | "crash" | "slots" | "other"; thumb?: string; launchUrl: string };

export function catalog(): Game[] {
  try { const c = JSON.parse(env.GAMES_CATALOG); return Array.isArray(c) ? c : []; } catch { return []; }
}
const secret = () => {
  if (!env.GAMES_WALLET_SECRET) throw new HttpError(503, "Games are not connected yet.", "GAMES_OFF");
  return env.GAMES_WALLET_SECRET;
};

/** Short-lived token the game provider sends back on every wallet call, so it can only act for this player. */
export async function signPlayerToken(userId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setAudience("games").setIssuer("betzone").setExpirationTime("2h").sign(new TextEncoder().encode(secret()));
}
export async function verifyPlayerToken(token: string): Promise<string> {
  try { return (await jwtVerify(token, new TextEncoder().encode(secret()), { audience: "games", issuer: "betzone" })).payload.sub as string; }
  catch { throw new HttpError(401, "Invalid or expired player token.", "BAD_TOKEN"); }
}
/** Provider requests carry HMAC-SHA256(body) in the x-signature header, using the shared secret. */
export function validProviderSignature(raw: string, header: string | null) {
  if (!header) return false;
  const mac = createHmac("sha256", secret()).update(raw).digest("hex");
  const a = Buffer.from(mac), b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
