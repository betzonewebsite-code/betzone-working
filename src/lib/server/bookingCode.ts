// No 0/O/1/I/L so codes can be read aloud or typed from a screenshot.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateCode(exists: (c: string) => boolean): string {
  for (let i = 0; i < 20; i++) {
    let c = "BZ";
    for (const b of crypto.getRandomValues(new Uint8Array(4))) c += ALPHABET[b % ALPHABET.length];
    if (!exists(c)) return c;
  }
  throw new Error("Could not allocate a unique booking code");
}
export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");
export const isValidCodeShape = (c: string) => /^BZ[2-9A-HJKMNP-Z]{4}$/.test(c);
