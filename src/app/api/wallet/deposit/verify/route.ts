import { z } from "zod";
import { handler, HttpError, json } from "@/lib/server/http";
import { finalizeDeposit } from "@/lib/server/payments/deposit";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const ref = z.string().min(8).max(80).safeParse(new URL(req.url).searchParams.get("reference"));
  if (!ref.success) throw new HttpError(400, "Missing payment reference.");
  const mine = await db.transaction.findFirst({ where: { providerRef: ref.data, userId: user.id } });
  if (!mine) throw new HttpError(404, "Deposit not found.");
  return json(await finalizeDeposit(ref.data));
});
