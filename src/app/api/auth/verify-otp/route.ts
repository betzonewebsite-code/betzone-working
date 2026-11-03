import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { body, getIp, getUA, handler, HttpError, json } from "@/lib/server/http";
import { checkOtp } from "@/lib/server/otp";
import { rateLimit } from "@/lib/server/ratelimit";
import { verifySchema } from "@/lib/server/schemas";
import { issueSession, publicUser, setAuthCookies } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const ip = getIp(req);
  await rateLimit(`otp:ip:${ip}`, 30, 900);
  const input = await body(req, verifySchema);
  await rateLimit(`otp:email:${input.email}`, 10, 900);

  const found = await db.user.findUnique({ where: { email: input.email } });
  if (!found || found.status !== "ACTIVE") throw new HttpError(400, "Code expired or not found. Request a new one.", "OTP_INVALID");

  const rec = await checkOtp(found.id, "REGISTER", input.code);
  const now = new Date();
  // Whichever channel carried the code is the one that is now proven.
  const proof = rec.channel === "EMAIL" ? { emailVerifiedAt: found.emailVerifiedAt ?? now } : { phoneVerifiedAt: found.phoneVerifiedAt ?? now };
  const user = await db.user.update({ where: { id: found.id }, data: { ...proof, lastLoginAt: now }, include: { wallet: true } });

  const res = json({ user: publicUser(user) });
  setAuthCookies(res, await issueSession(user, { ip, ua: getUA(req) }));
  audit("auth.verify", { userId: user.id, ip, metadata: { channel: rec.channel } });
  return res;
});
