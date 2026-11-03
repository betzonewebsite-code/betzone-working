import { Worker } from "bullmq";
import { db } from "../../src/lib/server/db";
import { runAutoCashouts } from "../../src/lib/server/betting/cashout";
import { settleFixture } from "../../src/lib/server/betting/settle";
import { settleJackpots } from "../../src/lib/server/jackpot";
import { queues, redisConnection, retryOpts } from "../../src/lib/server/queues";

/** Runs fn every `ms` without ever overlapping itself. */
export function loop(name: string, ms: number, fn: () => Promise<unknown>) {
  let busy = false;
  const t = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (e) { console.error(`[${name}]`, (e as Error).message); } finally { busy = false; }
  }, ms);
  return () => clearInterval(t);
}

export function startSettlement() {
  const worker = new Worker("settlement", async (job) => settleFixture(job.data.fixtureId as string), { connection: redisConnection(), concurrency: 3 });
  worker.on("completed", (job, n) => { if (n) console.log(`[settlement] fixture ${job.data.fixtureId}: ${n} tickets checked`); });
  worker.on("failed", (job, err) => console.error(`[settlement] fixture ${job?.data?.fixtureId} failed (attempt ${job?.attemptsMade}):`, err.message));

  // Finds finished matches that still have open legs and queues one job per match.
  const scan = async () => {
    const stale = new Date(Date.now() - 48 * 3_600_000);
    const fixtures = await db.fixture.findMany({
      where: {
        legs: { some: { result: "PENDING" } },
        OR: [{ status: "FINISHED" }, { status: { in: ["CANCELLED", "ABANDONED"] } }, { status: "POSTPONED", kickoffAt: { lt: stale } }],
      },
      select: { id: true, status: true, result: true },
      take: 200,
    });
    const bucket = Math.floor(Date.now() / 300_000);                 // a failed job can be retried every 5 minutes
    for (const f of fixtures) {
      if (f.status === "FINISHED") {
        const result = f.result as { agreed?: boolean | null; source?: string; note?: string } | null;
        const singleSourceApproved = result?.agreed === null &&
          (result.source === "virtual" || result.note === "single source");
        if (result?.agreed !== true && !singleSourceApproved) continue;
      }
      await queues().settlement.add("fixture", { fixtureId: f.id }, { ...retryOpts, jobId: `fx-${f.id}-${bucket}` });
    }
  };
  const stops = [loop("settlement-scan", 15_000, scan), loop("auto-cashout", 5_000, runAutoCashouts), loop("jackpot", 30_000, settleJackpots)];
  return () => { stops.forEach((s) => s()); void worker.close(); };
}
