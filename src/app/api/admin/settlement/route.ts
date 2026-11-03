import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { handler, json, HttpError } from "@/lib/server/http";

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = handler(async (req) => {
  await requireAdmin(req);

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );

  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  }

  const { q, limit } = parsed.data;

  const fixtures = await db.fixture.findMany({
    where: {
      source: { not: "virtual" },
      status: { in: ["FINISHED", "CANCELLED", "POSTPONED", "ABANDONED"] },
      legs: { some: { result: "PENDING" } },
      ...(q
        ? {
            OR: [
              { homeTeam: { contains: q, mode: "insensitive" as const } },
              { awayTeam: { contains: q, mode: "insensitive" as const } },
              { league: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      sport: true,
      homeTeam: true,
      awayTeam: true,
      homeScore: true,
      awayScore: true,
      status: true,
      kickoffAt: true,
      result: true,
      league: { select: { name: true } },
    },
    orderBy: [{ kickoffAt: "desc" }, { id: "asc" }],
    take: limit,
  });

  const fixtureIds = fixtures.map((fixture) => fixture.id);

  const pendingLegs = fixtureIds.length
    ? await db.betLeg.findMany({
        where: {
          fixtureId: { in: fixtureIds },
          result: "PENDING",
        },
        select: {
          fixtureId: true,
          ticketId: true,
          ticket: { select: { status: true } },
        },
      })
    : [];

  const counts = new Map<string, { pendingSelections: number; openTickets: Set<string> }>();

  for (const leg of pendingLegs) {
    let entry = counts.get(leg.fixtureId);

    if (!entry) {
      entry = { pendingSelections: 0, openTickets: new Set<string>() };
      counts.set(leg.fixtureId, entry);
    }

    entry.pendingSelections += 1;

    if (leg.ticket.status === "OPEN") {
      entry.openTickets.add(leg.ticketId);
    }
  }

  const rows = fixtures.map((fixture) => {
    const count = counts.get(fixture.id);

    return {
      ...fixture,
      kickoffAt: fixture.kickoffAt.toISOString(),
      pendingSelections: count?.pendingSelections ?? 0,
      affectedOpenTickets: count?.openTickets.size ?? 0,
      providerAgreement: (
        fixture.result !== null &&
        typeof fixture.result === "object" &&
        !Array.isArray(fixture.result) &&
        "agreed" in fixture.result
      )
        ? (fixture.result as { agreed?: boolean | null }).agreed ?? null
        : null,
    };
  });

  return json({
    fixtures: rows,
    count: rows.length,
    summary: {
      fixtures: rows.length,
      pendingSelections: rows.reduce((sum, row) => sum + row.pendingSelections, 0),
      affectedOpenTickets: rows.reduce((sum, row) => sum + row.affectedOpenTickets, 0),
    },
    limit,
  });
});
