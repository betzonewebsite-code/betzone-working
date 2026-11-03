import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { generateCode } from "@/lib/server/bookingCode";
import { body, getIp, handler, HttpError, json } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";

export const POST = handler(async (req) => {
  await rateLimit(`book-${getIp(req)}`, 30, 3600);
  const { oddsIds } = await body(req, z.object({ oddsIds: z.array(z.string().min(5).max(40)).min(1).max(30) }));
  const found = await db.marketOdds.count({ where: { id: { in: oddsIds } } });
  if (found !== oddsIds.length) throw new HttpError(409, "Some selections are no longer available.", "SELECTION_GONE");
  // Try to insert and retry on a clash, instead of loading every existing code.
  for (let i = 0; i < 6; i++) {
    const code = generateCode(() => false);
    try {
      await db.bookingCode.create({ data: { code, legs: oddsIds.map((oddsId) => ({ oddsId })), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
      return json({ code }, 201);
    } catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; }
  }
  throw new HttpError(503, "Could not create a code. Try again.");
});
