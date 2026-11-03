import { redisReady } from "./redis";

export const USER_CHANNEL = "betzone:user";

/** Pushes a private event to one user's open browser tabs via the Socket.io gateway. Never throws. */
export async function publishUser(userId: string, event: "balance" | "bet", data: Record<string, unknown>) {
  try { await (await redisReady()).publish(USER_CHANNEL, JSON.stringify({ userId, event, data })); }
  catch (e) { console.warn("[events] could not publish:", (e as Error).message); }
}
