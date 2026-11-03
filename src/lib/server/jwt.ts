import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = "betzone", AUDIENCE = "betzone-web";

export const signAccess = (p: { sub: string; role: string; sid: string }) =>
  new SignJWT({ role: p.role, sid: p.sid })
    .setProtectedHeader({ alg: "HS256" }).setSubject(p.sub).setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt().setExpirationTime(`${env.ACCESS_TOKEN_TTL_MIN}m`).sign(key);

export async function verifyAccess(token: string) {
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    return { userId: payload.sub as string, role: payload.role as string, sid: payload.sid as string };
  } catch { return null; }
}
