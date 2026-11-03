import { Worker } from "bullmq";
import { db } from "../../src/lib/server/db";
import { queues, redisConnection, retryOpts } from "../../src/lib/server/queues";
import { failWithdrawal, sendPayout } from "../../src/lib/server/payments/withdraw";
import { finalizeDeposit } from "../../src/lib/server/payments/deposit";
import { loop } from "./settlement";

export function startPayouts() {
  const worker = new Worker("payouts", async (job) => sendPayout(job.data.txId as string), { connection: redisConnection(), concurrency: 2 });
  worker.on("failed", async (job, err) => {
    console.error(`[payouts] ${job?.data?.txId} failed (attempt ${job?.attemptsMade}):`, err.message);
    // After the last retry the money goes back to the player's wallet.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const tx = await db.transaction.findUnique({ where: { id: job.data.txId } });
      if (tx?.providerRef) await failWithdrawal(tx.providerRef, `Payout failed: ${err.message}`);
    }
  });

  // Safety net for missed webhooks: ask Paystack about deposits that are still pending, and expire the very old ones.
  const reconcileDeposits = async () => {
    const pending = await db.transaction.findMany({ where: { type: "DEPOSIT", status: "PENDING", createdAt: { lt: new Date(Date.now() - 10 * 60_000) } }, take: 50 });
    for (const t of pending) {
      if (!t.providerRef) continue;
      await finalizeDeposit(t.providerRef).catch((e) => console.warn("[deposits]", t.providerRef, e.message));
      if (Date.now() - t.createdAt.getTime() > 24 * 3_600_000)
        await db.transaction.updateMany({ where: { id: t.id, status: "PENDING" }, data: { status: "FAILED", failureReason: "Expired" } });
    }
  };
  // If the app crashed after debiting a withdrawal but before queuing its payout, queue it now. The job id stops duplicates.
  const requeue = async () => {
    const stuck = await db.transaction.findMany({ where: { type: "WITHDRAWAL", status: "PROCESSING", createdAt: { lt: new Date(Date.now() - 2 * 60_000) } }, take: 50 });
    for (const t of stuck) {
      const meta = (t.metadata ?? {}) as { needsApproval?: boolean; transferCode?: string };
      if (!meta.needsApproval && !meta.transferCode) await queues().payouts.add("payout", { txId: t.id }, { ...retryOpts, jobId: `payout-${t.id}` });
    }
  };
  const stops = [loop("deposit-reconcile", 5 * 60_000, reconcileDeposits), loop("payout-requeue", 60_000, requeue)];
  return () => { stops.forEach((s) => s()); void worker.close(); };
}
