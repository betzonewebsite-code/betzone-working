import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { OtpChannel, OtpPurpose } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { otpEmail, sendEmail } from "./email";
import { HttpError } from "./http";
import { sendSms } from "./sms";

const RESEND_COOLDOWN_SEC = 60;
const MAX_PER_DAY = 8;   // email + SMS attempts combined
const hash = (userId: string, purpose: OtpPurpose, code: string) =>
  createHmac("sha256", `${env.JWT_REFRESH_SECRET}:otp`).update(`${userId}:${purpose}:${code}`).digest("hex");

type Target = { id: string; email: string; phone: string };

/** Creates a code and delivers it by the chosen channel. EMAIL (Brevo) is the primary channel, SMS the fallback. */
export async function issueOtp(user: Target, purpose: OtpPurpose, channel: OtpChannel, ip?: string) {
  const now = Date.now();
  const last = await db.otpCode.findFirst({ where: { userId: user.id, purpose }, orderBy: { createdAt: "desc" } });
  if (last && now - last.createdAt.getTime() < RESEND_COOLDOWN_SEC * 1000) {
    const wait = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - (now - last.createdAt.getTime())) / 1000);
    throw new HttpError(429, `Wait ${wait}s before requesting another code.`, "OTP_COOLDOWN");
  }
  const today = await db.otpCode.count({ where: { userId: user.id, createdAt: { gte: new Date(now - 86_400_000) } } });
  if (today >= MAX_PER_DAY) throw new HttpError(429, "Too many codes requested today. Try again tomorrow.", "OTP_DAILY_LIMIT");

  await db.otpCode.updateMany({ where: { userId: user.id, purpose, consumedAt: null }, data: { consumedAt: new Date() } }); // older codes stop working
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const target = channel === "EMAIL" ? user.email : user.phone;
  const rec = await db.otpCode.create({
    data: { userId: user.id, channel, target, purpose, codeHash: hash(user.id, purpose, code), expiresAt: new Date(now + env.OTP_TTL_SEC * 1000), ip },
  });
  const minutes = Math.round(env.OTP_TTL_SEC / 60);
  try {
    if (channel === "EMAIL") await sendEmail({ to: user.email, ...otpEmail(code, minutes) });
    else await sendSms(user.phone, `Your BetZone code is ${code}. It expires in ${minutes} min. Never share it with anyone.`);
  } catch (e) {
    await db.otpCode.delete({ where: { id: rec.id } }).catch(() => {});
    throw e;
  }
  return { channel, expiresInSec: env.OTP_TTL_SEC, resendInSec: RESEND_COOLDOWN_SEC };
}

/** Throws unless the code is right. A correct code is single-use. Returns the record so the caller knows which channel proved ownership. */
export async function checkOtp(userId: string, purpose: OtpPurpose, code: string) {
  const rec = await db.otpCode.findFirst({ where: { userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!rec) throw new HttpError(400, "Code expired or not found. Request a new one.", "OTP_INVALID");
  if (rec.attempts >= env.OTP_MAX_ATTEMPTS) throw new HttpError(429, "Too many wrong tries. Request a new code.", "OTP_LOCKED");

  const ok = timingSafeEqual(Buffer.from(hash(userId, purpose, code)), Buffer.from(rec.codeHash));
  if (!ok) {
    await db.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "Wrong code. Check it and try again.", "OTP_WRONG");
  }
  const used = await db.otpCode.updateMany({ where: { id: rec.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (used.count !== 1) throw new HttpError(400, "Code already used.", "OTP_INVALID");
  return rec;
}
