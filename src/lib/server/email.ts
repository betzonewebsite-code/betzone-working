import { env } from "./env";
import { HttpError } from "./http";

type Mail = { to: string; subject: string; html: string; text: string };

/** Sends one transactional email through Brevo's API (plain fetch, no SDK). The sender address must be verified in Brevo. */
export async function sendEmail(m: Mail) {
  try {
    if (env.EMAIL_PROVIDER === "console") {
      console.log(`\n[EMAIL:console] to ${m.to}\nSubject: ${m.subject}\n${m.text}\n`);   // development only
      return;
    }
    if (!env.BREVO_API_KEY) throw new Error("BREVO_API_KEY missing");
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
        to: [{ email: m.to }],
        subject: m.subject, htmlContent: m.html, textContent: m.text, tags: ["otp"],
      }),
    });
    if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 300)}`);
  } catch (e) {
    console.error("[email] send failed:", e);
    throw new HttpError(502, "We could not send the email. Please try again.", "EMAIL_FAILED");
  }
}

export function otpEmail(code: string, minutes: number): Omit<Mail, "to"> {
  const text = `Your BetZone verification code is ${code}.\nIt expires in ${minutes} minutes. Never share it with anyone.\nIf you did not try to register, ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
  <h2 style="margin:0 0 12px;color:#E30613">BetZone</h2>
  <p>Use this code to verify your email address:</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#F4F5F7;padding:14px;text-align:center;border-radius:6px">${code}</p>
  <p style="color:#555;font-size:13px">It expires in ${minutes} minutes. Never share it with anyone. BetZone staff will never ask for it.</p>
  <p style="color:#999;font-size:12px">If you did not try to register, you can ignore this email.</p></div>`;
  return { subject: `${code} is your BetZone verification code`, html, text };
}

export const maskEmail = (e: string) => { const [u, d] = e.split("@"); return `${u.slice(0, 2)}***@${d}`; };
