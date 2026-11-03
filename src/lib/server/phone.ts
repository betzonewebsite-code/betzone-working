import { parsePhoneNumberFromString } from "libphonenumber-js";
import { HttpError } from "./http";
import { env } from "./env";

/** "024 123 4567" -> "+233241234567". Rejects anything that is not a valid number. */
export function parsePhone(input: string): string {
  const p = parsePhoneNumberFromString(input, env.COUNTRY_CODE as never);
  if (!p || !p.isValid()) throw new HttpError(400, "Enter a valid phone number.", "BAD_PHONE");
  return p.number;
}
export const maskPhone = (e164: string) => `${e164.slice(0, 5)}****${e164.slice(-3)}`;
