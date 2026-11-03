import bcrypt from "bcryptjs";

const COST = 12; // ~250 ms per hash. Raise it as hardware gets faster.
export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Burn the same time as a real check when the account does not exist, so response time does not reveal which numbers are registered.
let dummy: string | null = null;
export async function burnTime(plain: string) {
  dummy ??= await bcrypt.hash("dummy-password-for-timing", COST);
  await bcrypt.compare(plain, dummy);
}
