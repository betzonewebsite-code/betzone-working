import { getIp, handler, HttpError, json } from "@/lib/server/http";
import { issueOtp } from "@/lib/server/otp";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";
import { smsAvailable } from "@/lib/server/sms";

// Proves the player owns the phone number payouts will go to. Uses the LOGIN purpose label for this check.
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`phone-send-${getIp(req)}`, 10, 3600);
  if (user.phoneVerifiedAt) return json({ ok: true, alreadyVerified: true });
  if (!smsAvailable()) throw new HttpError(503, "SMS is not available right now.", "SMS_UNAVAILABLE");
  return json({ ok: true, ...(await issueOtp(user, "LOGIN", "SMS", getIp(req))) });
});
