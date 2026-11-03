import { db } from "@/lib/server/db";
import { handler, HttpError, json } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`report-${user.id}`, 20, 3600);
  const id = new URL(req.url).pathname.split("/").at(-2) ?? "";
  const post = await db.feedPost.findUnique({ where: { id } });
  if (!post) throw new HttpError(404, "Post not found.");
  await db.$transaction(async (tx) => {
    const made = await tx.feedReport.createMany({ data: [{ postId: id, userId: user.id }], skipDuplicates: true });
    if (!made.count) return;                                                    // already reported by this player
    const p = await tx.feedPost.update({ where: { id }, data: { reports: { increment: 1 } } });
    if (p.reports >= 3) await tx.feedPost.update({ where: { id }, data: { hidden: true } });   // three reports hide a post until a human looks
  });
  return json({ ok: true });
});
