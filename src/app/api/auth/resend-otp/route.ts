import { db } from "@/lib/server/db";
import { body, getIp, handler, HttpError, json } from "@/lib/server/http";
import { issueOtp } from "@/lib/server/otp";
import { rateLimit } from "@/lib/server/ratelimit";
import { resendSchema } from "@/lib/server/schemas";
import { smsAvailable } from "@/lib/server/sms";

export const POST = handler(async (req) => {
  const ip = getIp(req);
  await rateLimit(`resend:ip:${ip}`, 10, 3600);
  const { email, channel } = await body(req, resendSchema);
  if (channel === "SMS" && !smsAvailable()) throw new HttpError(400, "SMS codes are not available right now. Use email.", "SMS_UNAVAILABLE");

  const user = await db.user.findUnique({ where: { email } });
  // Same answer whether or not the address is registered, so this cannot be used to look people up.
  if (user && !user.emailVerifiedAt && !user.phoneVerifiedAt) await issueOtp(user, "REGISTER", channel, ip);
  return json({ ok: true, resendInSec: 60 });
});
