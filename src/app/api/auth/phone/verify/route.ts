import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { body, getIp, handler, json } from "@/lib/server/http";
import { checkOtp } from "@/lib/server/otp";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`phone-verify-${user.id}`, 10, 900);
  const { code } = await body(req, z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }));
  await checkOtp(user.id, "LOGIN", code);
  await db.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
  audit("auth.verify_phone", { userId: user.id, ip: getIp(req) });
  return json({ ok: true });
});
