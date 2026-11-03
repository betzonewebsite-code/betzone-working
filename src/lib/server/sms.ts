import { env } from "./env";
import { HttpError } from "./http";

/** Sends one SMS. Providers use plain fetch (no SDK). Check each provider's current API docs before going live. */
export async function sendSms(toE164: string, message: string) {
  try {
    if (env.SMS_PROVIDER === "console") {
      if (env.NODE_ENV === "production") throw new Error("SMS provider not configured");
      console.log(`\n[SMS:console] to ${toE164}: ${message}\n`);   // development only
      return;
    }
    if (env.SMS_PROVIDER === "arkesel") {
      if (!env.SMS_API_KEY) throw new Error("SMS_API_KEY missing");
      const r = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: { "api-key": env.SMS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ sender: env.SMS_SENDER_ID, message, recipients: [toE164.replace("+", "")] }),
      });
      if (!r.ok) throw new Error(`Arkesel ${r.status}`);
      return;
    }
    if (env.SMS_PROVIDER === "twilio") {
      const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: tok, TWILIO_FROM: from } = env;
      if (!sid || !tok || !from) throw new Error("Twilio settings missing");
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: toE164, From: from, Body: message }),
      });
      if (!r.ok) throw new Error(`Twilio ${r.status}`);
    }
  } catch (e) {
    console.error("[sms] send failed:", e);
    throw new HttpError(502, "We could not send the SMS. Please try again.", "SMS_FAILED");
  }
}

/** The SMS fallback is offered only when a real provider is configured (or in development). */
export const smsAvailable = () => env.SMS_PROVIDER !== "console" || env.NODE_ENV !== "production";
