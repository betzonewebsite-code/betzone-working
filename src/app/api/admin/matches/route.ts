import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { fixtureInclude, toClientFixture } from "@/lib/server/fixtureDto";
import { body, handler, json, HttpError } from "@/lib/server/http";

const sports = [
  "SOCCER", "BASKETBALL", "TENNIS", "TABLE_TENNIS",
  "ICE_HOCKEY", "BASEBALL", "ESPORTS",
] as const;

const querySchema = z.object({
  sport: z.enum(sports).optional(),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const createFixtureSchema = z.object({
  sport: z.enum(sports),
  leagueId: z.string().min(1),
  homeTeam: z.string().trim().min(1).max(100),
  awayTeam: z.string().trim().min(1).max(100),
  kickoffAt: z.string().datetime({ offset: true }),
});

const mutationSchema = z.object({
  action: z.enum([
    "updateFixture",
    "updateOdds",
    "setMarketStatus",
    "setSelectionStatus",
    "createMarket",
  ]),
  fixtureId: z.string().optional(),
  marketId: z.string().optional(),
  selectionId: z.string().optional(),
  kickoffAt: z.string().datetime({ offset: true }).optional(),
  homeTeam: z.string().trim().min(1).max(100).optional(),
  awayTeam: z.string().trim().min(1).max(100).optional(),
  bettingOpen: z.boolean().optional(),
  odds: z.number().finite().min(1.001).max(10000).optional(),
  marketStatus: z.enum(["OPEN", "SUSPENDED", "CLOSED"]).optional(),
  selectionStatus: z.enum(["OPEN", "SUSPENDED"]).optional(),
  marketType: z.enum([
    "ONE_X_TWO", "OVER_UNDER", "DOUBLE_CHANCE", "BTTS",
    "NEXT_GOAL", "ASIAN_HANDICAP", "MONEYLINE",
  ]).optional(),
  marketName: z.string().trim().min(1).max(100).optional(),
  line: z.number().finite().min(-1000).max(1000).nullable().optional(),
  lineKey: z.string().max(30).optional(),
  selections: z.array(z.object({
    key: z.string().trim().min(1).max(40),
    label: z.string().trim().min(1).max(80),
    odds: z.number().finite().min(1.001).max(10000),
  })).min(1).max(20).optional(),
});

export const GET = handler(async (req) => {
  await requireAdmin(req);

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  }

  const { sport, q, limit } = parsed.data;
  const where: Prisma.FixtureWhereInput = {
    source: { not: "virtual" },
    ...(sport ? { sport } : {}),
    ...(q ? {
      OR: [
        { homeTeam: { contains: q, mode: "insensitive" } },
        { awayTeam: { contains: q, mode: "insensitive" } },
        { league: { name: { contains: q, mode: "insensitive" } } },
      ],
    } : {}),
  };

  const [fixtures, leagues] = await Promise.all([
    db.fixture.findMany({
      where,
      include: fixtureInclude,
      orderBy: [{ kickoffAt: "desc" }, { id: "asc" }],
      take: limit,
    }),
    db.league.findMany({
      orderBy: [{ sport: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, country: true, sport: true },
    }),
  ]);

  return json({
    fixtures: fixtures.map(toClientFixture),
    count: fixtures.length,
    leagues,
  });
});

export const POST = handler(async (req) => {
  await requireAdmin(req);
  const input = await body(req, createFixtureSchema);

  if (input.homeTeam.toLowerCase() === input.awayTeam.toLowerCase()) {
    throw new HttpError(400, "Home and away teams must be different.");
  }

  const league = await db.league.findUnique({
    where: { id: input.leagueId },
    select: { id: true, sport: true },
  });

  if (!league) throw new HttpError(404, "Selected league was not found.");
  if (league.sport !== input.sport) {
    throw new HttpError(400, "The selected sport does not match the league.");
  }

  const fixture = await db.fixture.create({
    data: {
      source: "admin",
      externalId: `admin-${randomUUID()}`,
      leagueId: league.id,
      sport: input.sport,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      kickoffAt: new Date(input.kickoffAt),
      status: "SCHEDULED",
      bettingOpen: true,
    },
    include: fixtureInclude,
  });

  return json({ ok: true, fixture: toClientFixture(fixture) }, 201);
});

export const PATCH = handler(async (req) => {
  await requireAdmin(req);
  const input = await body(req, mutationSchema);

  if (input.action === "updateFixture") {
    if (!input.fixtureId) throw new HttpError(400, "Fixture ID is required.");

    const data: Prisma.FixtureUpdateInput = {};
    if (input.homeTeam !== undefined) data.homeTeam = input.homeTeam;
    if (input.awayTeam !== undefined) data.awayTeam = input.awayTeam;
    if (input.kickoffAt !== undefined) data.kickoffAt = new Date(input.kickoffAt);
    if (input.bettingOpen !== undefined) data.bettingOpen = input.bettingOpen;

    if (Object.keys(data).length === 0) {
      throw new HttpError(400, "No fixture changes were provided.");
    }

    const existing = await db.fixture.findUnique({
      where: { id: input.fixtureId },
      select: { id: true, source: true },
    });
    if (!existing || existing.source === "virtual") {
      throw new HttpError(404, "Fixture not found or cannot be edited.");
    }

    const fixture = await db.fixture.update({
      where: { id: input.fixtureId },
      data,
      include: fixtureInclude,
    });

    return json({ ok: true, fixture: toClientFixture(fixture) });
  }

  if (input.action === "updateOdds") {
    if (!input.selectionId || input.odds === undefined) {
      throw new HttpError(400, "Selection ID and valid odds are required.");
    }

    const selection = await db.marketOdds.findUnique({
      where: { id: input.selectionId },
      include: { market: { include: { fixture: true } } },
    });

    if (!selection || selection.market.fixture.source === "virtual") {
      throw new HttpError(404, "Selection not found.");
    }
    if (
      selection.market.status !== "OPEN" ||
      !selection.market.fixture.bettingOpen ||
      selection.market.fixture.status === "FINISHED" ||
      selection.market.fixture.status === "CANCELLED"
    ) {
      throw new HttpError(409, "Open the fixture and market before changing odds.");
    }

    const updated = await db.marketOdds.update({
      where: { id: selection.id },
      data: {
        previousOdds: selection.odds,
        odds: input.odds,
      },
    });

    return json({
      ok: true,
      selection: {
        id: updated.id,
        key: updated.key,
        label: updated.label,
        odds: Number(updated.odds),
      },
    });
  }

  if (input.action === "setMarketStatus") {
    if (!input.marketId || !input.marketStatus) {
      throw new HttpError(400, "Market ID and status are required.");
    }

    const market = await db.market.findUnique({
      where: { id: input.marketId },
      include: { fixture: true },
    });
    if (!market || market.fixture.source === "virtual") {
      throw new HttpError(404, "Market not found.");
    }
    if (market.status === "SETTLED" || market.status === "VOID") {
      throw new HttpError(409, "Settled or void markets cannot be reopened here.");
    }

    const updated = await db.market.update({
      where: { id: market.id },
      data: {
        status: input.marketStatus,
        suspendedReason: input.marketStatus === "SUSPENDED" ? "Suspended by admin" : null,
      },
    });

    return json({ ok: true, market: { id: updated.id, status: updated.status } });
  }

  if (input.action === "setSelectionStatus") {
    if (!input.selectionId || !input.selectionStatus) {
      throw new HttpError(400, "Selection ID and status are required.");
    }

    const selection = await db.marketOdds.findUnique({
      where: { id: input.selectionId },
      include: { market: { include: { fixture: true } } },
    });
    if (!selection || selection.market.fixture.source === "virtual") {
      throw new HttpError(404, "Selection not found.");
    }
    if (selection.market.status !== "OPEN") {
      throw new HttpError(409, "Reopen the market before changing a selection.");
    }

    const updated = await db.marketOdds.update({
      where: { id: selection.id },
      data: { status: input.selectionStatus },
    });

    return json({ ok: true, selection: { id: updated.id, status: updated.status } });
  }

  if (input.action === "createMarket") {
    if (!input.fixtureId || !input.marketType || !input.marketName || !input.selections) {
      throw new HttpError(400, "Fixture, market type, market name, and selections are required.");
    }

    const fixture = await db.fixture.findUnique({
      where: { id: input.fixtureId },
      select: { id: true, source: true, bettingOpen: true, status: true },
    });
    if (!fixture || fixture.source === "virtual") {
      throw new HttpError(404, "Fixture not found.");
    }
    if (!fixture.bettingOpen || fixture.status === "FINISHED" || fixture.status === "CANCELLED") {
      throw new HttpError(409, "This fixture is not open for market creation.");
    }

    const keys = input.selections.map((selection) => selection.key.toLowerCase());
    if (new Set(keys).size !== keys.length) {
      throw new HttpError(400, "Selection keys must be unique within a market.");
    }

    const lineKey = input.lineKey ?? (
      input.line === undefined || input.line === null ? "" : String(input.line)
    );

    const market = await db.$transaction(async (tx) => {
      const created = await tx.market.create({
        data: {
          fixtureId: fixture.id,
          type: input.marketType!,
          name: input.marketName!,
          line: input.line ?? undefined,
          lineKey,
          status: "OPEN",
        },
      });

      await tx.marketOdds.createMany({
        data: input.selections!.map((selection) => ({
          marketId: created.id,
          key: selection.key.toLowerCase(),
          label: selection.label,
          odds: selection.odds,
          status: "OPEN" as const,
        })),
      });

      return tx.market.findUniqueOrThrow({
        where: { id: created.id },
        include: { odds: { orderBy: { id: "asc" } } },
      });
    });

    return json({
      ok: true,
      market: {
        id: market.id,
        name: market.name,
        type: market.type,
        status: market.status,
        selections: market.odds.map((selection) => ({
          id: selection.id,
          key: selection.key,
          label: selection.label,
          odds: Number(selection.odds),
        })),
      },
    }, 201);
  }

  throw new HttpError(400, "Unsupported action.");
});
