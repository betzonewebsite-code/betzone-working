import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { body, getIp, handler, HttpError, json } from "@/lib/server/http";
import { failWithdrawal } from "@/lib/server/payments/withdraw";
import { queues, retryOpts } from "@/lib/server/queues";

// Large withdrawals wait here for a person to approve or reject them.
export const POST = handler(async (req) => {
  const admin = await requireAdmin(req);
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  const { action } = await body(req, z.object({ action: z.enum(["approve", "reject"]) }));
  const tx = await db.transaction.findUnique({ where: { id } });
  if (!tx || tx.type !== "WITHDRAWAL" || tx.status !== "PROCESSING") throw new HttpError(404, "No pending withdrawal with that id.");
  if (action === "approve") await queues().payouts.add("payout", { txId: id }, { ...retryOpts, jobId: `payout-${id}` });
  else await failWithdrawal(tx.providerRef!, "Rejected by admin");
  audit(`admin.withdrawal_${action}`, { userId: admin.id, ip: getIp(req), metadata: { txId: id } });
  return json({ ok: true });
});
