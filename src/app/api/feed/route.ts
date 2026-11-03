import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { isValidCodeShape, normalizeCode } from "@/lib/server/bookingCode";
import { body, handler, HttpError, json } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

const handle = (userId: string) => `Player-${createHash("sha256").update(userId).digest("hex").slice(0, 5).toUpperCase()}`;   // no real names or contact details are shown
const BAD_NOTE = /(https?:|www\.|\.com|\.net|@\w|\d{8,}|whatsapp|telegram|dm me|inbox)/i;                                    // blocks links, phone numbers and "contact me" scams

export const GET = handler(async () => {
  const posts = await db.feedPost.findMany({ where: { hidden: false }, orderBy: { createdAt: "desc" }, take: 30 });
  const codes = await db.bookingCode.findMany({ where: { code: { in: posts.map((p) => p.code) }, expiresAt: { gt: new Date() } } });
  const oddsIds = [...new Set(codes.flatMap((c) => (c.legs as { oddsId: string }[]).map((l) => l.oddsId)))];
  const rows = await db.marketOdds.findMany({ where: { id: { in: oddsIds } }, include: { market: { include: { fixture: true } } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return json({
    posts: posts.map((p) => {
      const c = codes.find((x) => x.code === p.code);
      const legs = c ? (c.legs as { oddsId: string }[]).map((l) => byId.get(l.oddsId)).filter((r) => !!r).map((r) => ({
        match: `${r!.market.fixture.homeTeam} v ${r!.market.fixture.awayTeam}`, market: r!.market.name, pick: r!.label, odds: Number(r!.odds),
        open: r!.status === "OPEN" && r!.market.status === "OPEN" && r!.market.fixture.bettingOpen && ["SCHEDULED", "LIVE", "HALFTIME"].includes(r!.market.fixture.status),
      })) : [];
      return { id: p.id, author: handle(p.userId), note: p.note, code: p.code, createdAt: p.createdAt.toISOString(), expired: !c, legs, totalOdds: legs.length ? legs.reduce((a, l) => a * l.odds, 1) : null };
    }),
  });
});

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`feed-${user.id}`, 5, 3600);
  const i = await body(req, z.object({ code: z.string().min(4).max(12), note: z.string().trim().min(3, "Write a short note").max(140, "Keep it under 140 characters") }));
  const code = normalizeCode(i.code);
  if (!isValidCodeShape(code)) throw new HttpError(400, "That is not a valid booking code.");
  if (BAD_NOTE.test(i.note)) throw new HttpError(400, "Notes cannot contain links, phone numbers or contact requests.", "BAD_NOTE");
  const rec = await db.bookingCode.findUnique({ where: { code } });
  if (!rec || rec.expiresAt < new Date()) throw new HttpError(404, "Code not found or expired.");
  const post = await db.feedPost.create({ data: { userId: user.id, code, note: i.note } });
  return json({ id: post.id }, 201);
});
