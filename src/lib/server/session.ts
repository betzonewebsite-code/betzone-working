import { createHash, randomBytes, randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { User, Wallet } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { HttpError } from "./http";
import { signAccess, verifyAccess } from "./jwt";
import { audit } from "./audit";

export const ACCESS_COOKIE = "bz_at";
export const REFRESH_COOKIE = "bz_rt";
const sha = (s: string) => createHash("sha256").update(s).digest("hex"); // refresh tokens are 384-bit random, so a fast hash is enough
type Meta = { ip?: string; ua?: string };
export type Tokens = { access: string; refresh: string; expiresAt: Date };

export async function issueSession(user: Pick<User, "id" | "role">, meta: Meta, familyId: string = randomUUID()): Promise<Tokens> {
  const refresh = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const s = await db.session.create({ data: { userId: user.id, familyId, tokenHash: sha(refresh), ip: meta.ip, userAgent: meta.ua?.slice(0, 300), expiresAt } });
  return { access: await signAccess({ sub: user.id, role: user.role, sid: s.id }), refresh, expiresAt };
}

/** One-time-use refresh: the old token is revoked and a new one issued in the same family. */
export async function rotateSession(token: string, meta: Meta): Promise<Tokens> {
  const rec = await db.session.findUnique({ where: { tokenHash: sha(token) }, include: { user: true } });
  if (!rec) throw new HttpError(401, "Session expired. Please log in again.", "SESSION_EXPIRED");

  if (rec.revokedAt) {
    // A second tab refreshing at the same moment is normal. A revoked token coming back later means it was stolen: kill the whole family.
    if (Date.now() - rec.revokedAt.getTime() < 10_000) throw new HttpError(401, "Refresh in progress.", "REFRESH_RACE");
    await db.session.updateMany({ where: { familyId: rec.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    audit("auth.refresh_reuse", { userId: rec.userId, ip: meta.ip });
    throw new HttpError(401, "Session expired. Please log in again.", "SESSION_EXPIRED");
  }
  if (rec.expiresAt < new Date() || rec.user.status !== "ACTIVE") throw new HttpError(401, "Session expired. Please log in again.", "SESSION_EXPIRED");

  const claimed = await db.session.updateMany({ where: { id: rec.id, revokedAt: null }, data: { revokedAt: new Date(), lastUsedAt: new Date() } });
  if (claimed.count !== 1) throw new HttpError(401, "Refresh in progress.", "REFRESH_RACE");
  return issueSession(rec.user, meta, rec.familyId);
}

export async function revokeByToken(token: string) {
  await db.session.updateMany({ where: { tokenHash: sha(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

const base = () => ({ httpOnly: true, secure: env.NODE_ENV === "production" } as const);
export function setAuthCookies(res: NextResponse, t: Tokens) {
  res.cookies.set(ACCESS_COOKIE, t.access, { ...base(), sameSite: "lax", path: "/", maxAge: env.ACCESS_TOKEN_TTL_MIN * 60 });
  // The refresh cookie is only sent to /api/auth/*, so it is not exposed to the rest of the site.
  res.cookies.set(REFRESH_COOKIE, t.refresh, { ...base(), sameSite: "strict", path: "/api/auth", expires: t.expiresAt });
}
export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...base(), sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...base(), sameSite: "strict", path: "/api/auth", maxAge: 0 });
}

/** Use at the top of any protected route. Re-reads the user from the database so suspensions take effect immediately. */
export async function requireUser(req: NextRequest) {
  const t = req.cookies.get(ACCESS_COOKIE)?.value;
  const p = t ? await verifyAccess(t) : null;
  if (!p) throw new HttpError(401, "Please log in.", "UNAUTHENTICATED");
  const user = await db.user.findUnique({ where: { id: p.userId }, include: { wallet: true } });
  if (!user || user.status !== "ACTIVE") throw new HttpError(401, "Please log in.", "UNAUTHENTICATED");
  return user;
}

export const publicUser = (u: User & { wallet: Wallet | null }) => ({
  id: u.id, email: u.email, phone: u.phone, emailVerified: !!u.emailVerifiedAt, phoneVerified: !!u.phoneVerifiedAt, hasPin: !!u.withdrawalPinHash, firstName: u.firstName, lastName: u.lastName, kycStatus: u.kycStatus, role: u.role,
  currency: u.wallet?.currency ?? env.DEFAULT_CURRENCY, balance: u.wallet?.balance.toFixed(2) ?? "0.00",
});
