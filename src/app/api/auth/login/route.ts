import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { body, getIp, getUA, handler, HttpError, json } from "@/lib/server/http";
import { issueOtp } from "@/lib/server/otp";
import { burnTime, verifyPassword } from "@/lib/server/password";
import { parsePhone } from "@/lib/server/phone";
import { rateLimit } from "@/lib/server/ratelimit";
import { loginSchema } from "@/lib/server/schemas";
import { issueSession, publicUser, setAuthCookies } from "@/lib/server/session";

const MAX_FAILS = 5, LOCK_MIN = 15;
const BAD = () => new HttpError(401, "Wrong email, phone number or password.", "BAD_CREDENTIALS");

export const POST = handler(async (req) => {
  const ip = getIp(req);
  await rateLimit(`login:ip:${ip}`, 30, 900);
  const input = await body(req, loginSchema);
  const id = input.identifier.trim();
  const where = id.includes("@") ? { email: id.toLowerCase() } : { phone: parsePhone(id) };
  await rateLimit(`login:id:${id.toLowerCase()}`, 15, 900);

  const user = await db.user.findUnique({ where, include: { wallet: true } });
  if (!user || user.status === "CLOSED") { await burnTime(input.password); audit("auth.login_fail", { ip }); throw BAD(); }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new HttpError(429, `Too many wrong passwords. Try again in ${mins} min.`, "ACCOUNT_LOCKED");
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    const fails = user.failedLoginCount + 1;
    await db.user.update({ where: { id: user.id }, data: fails >= MAX_FAILS ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60_000) } : { failedLoginCount: fails } });
    audit("auth.login_fail", { userId: user.id, ip });
    throw BAD();
  }

  if (!user.emailVerifiedAt && !user.phoneVerifiedAt) {
    await issueOtp(user, "REGISTER", "EMAIL", ip).catch((e) => { if (!(e instanceof HttpError) || e.status !== 429) throw e; }); // cooldown is fine: a code was just sent
    throw new HttpError(403, "Verify your email to continue.", "NOT_VERIFIED", { email: user.email });
  }
  if (user.status === "SUSPENDED") throw new HttpError(403, "This account is suspended. Please contact support.", "SUSPENDED");
  if (user.status === "SELF_EXCLUDED") throw new HttpError(403, "This account is self-excluded. Please contact support.", "SELF_EXCLUDED");

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const res = json({ user: publicUser(user) });
  setAuthCookies(res, await issueSession(user, { ip, ua: getUA(req) }));
  audit("auth.login", { userId: user.id, ip });
  return res;
});
