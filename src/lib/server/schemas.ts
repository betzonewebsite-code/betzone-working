import { z } from "zod";

export const emailField = z.string().trim().toLowerCase().email("Enter a valid email address").max(254, "Email is too long");
export const phoneField = z.string().trim().min(7, "Enter your phone number").max(20, "Phone number is too long");
export const passwordField = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .regex(/[A-Za-z]/, "Password needs at least one letter")
  .regex(/\d/, "Password needs at least one number");
const dob = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth").refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1900 && d.getTime() < Date.now();
}, "Enter a valid date of birth");

export const registerSchema = z.object({
  email: emailField, phone: phoneField, password: passwordField, dateOfBirth: dob,
  acceptTerms: z.literal(true, { message: "You must accept the terms to register" }),
});
export const loginSchema = z.object({ identifier: z.string().trim().min(3, "Enter your email or phone number").max(254), password: z.string().min(1, "Enter your password").max(72) });
export const verifySchema = z.object({ email: emailField, code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });
export const resendSchema = z.object({ email: emailField, channel: z.enum(["EMAIL", "SMS"]).default("EMAIL") });

export function ageOn(dobStr: string, now = new Date()) {
  const d = new Date(`${dobStr}T00:00:00Z`);
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}
