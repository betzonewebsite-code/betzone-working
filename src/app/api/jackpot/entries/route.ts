import { db } from "@/lib/server/db";
import { handler, json } from "@/lib/server/http";
import { fixed } from "@/lib/server/money";
import { requireUser } from "@/lib/server/session";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const rows = await db.jackpotEntry.findMany({ where: { userId: user.id }, include: { round: { include: { matches: true } } }, orderBy: { createdAt: "desc" }, take: 30 });
  return json({ entries: rows.map((e) => ({ id: e.id, title: e.round.title, status: e.round.status, correct: e.correct, total: e.round.matches.length, payout: fixed(e.payout), createdAt: e.createdAt.toISOString() })) });
});
