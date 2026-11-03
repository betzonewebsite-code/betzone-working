import { env } from "../src/lib/server/env";
import { redisReady } from "../src/lib/server/redis";
import { startGateway } from "./gateway";
import { startPayouts } from "./workers/payouts";
import { startVirtuals } from "./virtuals/engine";
import { startSettlement } from "./workers/settlement";
import { startVirtualTicketSessions } from "./virtuals/ticket-sessions";

async function main() {
  await redisReady();
  console.log(`[platform] ${env.NODE_ENV} mode`);

  const gateway = startGateway();
  const stopSettlement = startSettlement();
  const stopPayouts = startPayouts();
  const stopVirtuals = startVirtuals();
  const stopVirtualTicketSessions = startVirtualTicketSessions();

  const shutdown = () => {
    console.log("[platform] shutting down");
    stopSettlement();
    stopPayouts();
    stopVirtuals();
    stopVirtualTicketSessions();
    gateway.close();
    setTimeout(() => process.exit(0), 1500);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});