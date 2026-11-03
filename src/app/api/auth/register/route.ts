import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { audit } from "@/lib/server/audit";
import { maskEmail } from "@/lib/server/email";
import { body, getIp, handler, HttpError, json } from "@/lib/server/http";
import { issueOtp } from "@/lib/server/otp";
import { hashPassword } from "@/lib/server/password";
import { maskPhone, parsePhone } from "@/lib/server/phone";
import { rateLimit } from "@/lib/server/ratelimit";
import { ageOn, registerSchema } from "@/lib/server/schemas";
import { smsAvailable } from "@/lib/server/sms";

export const POST = handler(async (req) => {
  const ip = getIp(req);
  await rateLimit(`register:${ip}`, 5, 3600);
  const input = await body(req, registerSchema);
  const phone = parsePhone(input.phone);
  const email = input.email;

  if (ageOn(input.dateOfBirth) < env.MIN_AGE) throw new HttpError(403, `You must be ${env.MIN_AGE} or older to register.`, "UNDERAGE");

  const matches = await db.user.findMany({ where: { OR: [{ email }, { phone }] } });
  if (matches.some((u) => u.emailVerifiedAt || u.phoneVerifiedAt))
    throw new HttpError(409, "This email or phone number is already registered. Please log in.", "ALREADY_REGISTERED");

  const passwordHash = await hashPassword(input.password);
  const dateOfBirth = new Date(`${input.dateOfBirth}T00:00:00Z`);
  // Leftovers from earlier unfinished sign-ups hold no money and no history, so they are replaced.
  const user = await db.$transaction(async (tx) => {
    const ids = matches.map((m) => m.id);
    if (ids.length) {
      await tx.wallet.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    }
    return tx.user.create({ data: { email, phone, passwordHash, dateOfBirth, wallet: { create: { currency: env.DEFAULT_CURRENCY } } } });
  });

  const otp = await issueOtp(user, "REGISTER", "EMAIL", ip);   // email (Brevo) first
  audit("auth.register", { userId: user.id, ip });
  return json({ email: maskEmail(email), phone: maskPhone(phone), smsFallback: smsAvailable(), ...otp }, 201);
});
