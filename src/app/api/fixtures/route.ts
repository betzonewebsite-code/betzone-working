import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { fixtureInclude, toClientFixture } from "@/lib/server/fixtureDto";
import { handler, json, HttpError } from "@/lib/server/http";

const query = z.object({
  sport: z.enum(["SOCCER", "BASKETBALL", "TENNIS", "TABLE_TENNIS", "ICE_HOCKEY", "BASEBALL", "ESPORTS"]).optional(),
  league: z.string().max(40).optional(),            // our league key, e.g. EPL
  when: z.enum(["live", "upcoming", "all"]).default("all"),
  hours: z.coerce.number().int().min(1).max(24 * 14).optional(),   // only kick-offs within this many hours
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = handler(async (req) => {
  const p = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Bad query");
  const { sport, league, when, hours, q, limit } = p.data;

  const now = new Date();
  const where: Prisma.FixtureWhereInput = {
    source: { not: "virtual" },
    ...(sport ? { sport } : {}),
    ...(league ? { league: { externalId: league } } : {}),
    ...(q ? { OR: [{ homeTeam: { contains: q, mode: "insensitive" } }, { awayTeam: { contains: q, mode: "insensitive" } }, { league: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const liveSet = { in: ["LIVE", "HALFTIME"] as ("LIVE" | "HALFTIME")[] };
  const upcoming: Prisma.FixtureWhereInput = { status: "SCHEDULED", kickoffAt: { gte: new Date(now.getTime() - 5 * 60_000), ...(hours ? { lte: new Date(now.getTime() + hours * 3_600_000) } : {}) } };
  where.AND = [when === "live" ? { status: liveSet } : when === "upcoming" ? upcoming : { OR: [{ status: liveSet }, upcoming] }];

  const rows = await db.fixture.findMany({ where, include: fixtureInclude, orderBy: [{ league: { sortOrder: "asc" } }, { kickoffAt: "asc" }], take: limit });
  return json({ fixtures: rows.map(toClientFixture), serverTime: now.toISOString() });
});
