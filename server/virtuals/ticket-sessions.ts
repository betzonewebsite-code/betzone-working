import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "../../src/lib/server/db";
import { env } from "../../src/lib/server/env";
import { HttpError } from "../../src/lib/server/http";
import { publishUser } from "../../src/lib/server/events";
import { evaluateTicketTx } from "../../src/lib/server/betting/settle";
import { resultFor } from "../../src/lib/server/betting/settlement-calculations";
import { simulate, type Goal } from "./sim";

type RoundMatch = {
  i: number;
  fixtureId: string;
  leagueKey: "VIRTUAL-PL" | "VIRTUAL-CHAMPIONSHIP";
  home: string;
  away: string;
  lamH: number;
  lamA: number;
};

type SessionResult = {
  fixtureId: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  goals: Goal[];
};

const sha = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function kickOffVirtualTicket(userId: string, ticketId: string) {
  const seed = randomBytes(32).toString("hex");
  const startedAt = new Date();
  const endsAt = new Date(
    startedAt.getTime() + env.VIRTUALS_PLAY_SEC * 1000
  );

  const started = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "BetTicket" WHERE "id" = ${ticketId} FOR UPDATE
    `;

    const ticket = await tx.betTicket.findFirst({
      where: { id: ticketId, userId, isVirtual: true },
      include: { virtualSession: true, legs: true },
    });

    if (!ticket || !ticket.virtualSession) {
      throw new HttpError(404, "Instant Virtual ticket not found.");
    }

    const session = ticket.virtualSession;

    await tx.$queryRaw`
      SELECT "id" FROM "VirtualTicketSession"
      WHERE "id" = ${session.id} FOR UPDATE
    `;

    if (ticket.status !== "OPEN") {
      throw new HttpError(409, "This virtual ticket is no longer open.");
    }

    if (session.userId !== userId) {
      throw new HttpError(403, "You cannot start another customer's ticket.");
    }

    if (session.status !== "READY") {
      throw new HttpError(409, "This ticket's matches have already been started.");
    }

    const fixtureIds = session.fixtureIds as string[];
    const legFixtureIds = [...new Set(ticket.legs.map((leg) => leg.fixtureId))];

    if (
      !Array.isArray(fixtureIds) ||
      fixtureIds.length === 0 ||
      fixtureIds.length !== legFixtureIds.length ||
      fixtureIds.some((id) => !legFixtureIds.includes(id))
    ) {
      throw new HttpError(409, "The virtual ticket's match list is invalid.");
    }

    const results: SessionResult[] = [];

    for (const fixtureId of fixtureIds) {
      const fixture = await tx.fixture.findFirst({
        where: {
          id: fixtureId,
          source: "virtual",
        },
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          status: true,
          league: { select: { externalId: true } },
        },
      });

      if (
        !fixture ||
        !["VIRTUAL-PL", "VIRTUAL-CHAMPIONSHIP"].includes(
          fixture.league.externalId
        )
      ) {
        throw new HttpError(409, "A ticket match is not a supported virtual fixture.");
      }

      const round = await tx.virtualRound.findFirst({
        where: {
          status: "BETTING",
          matches: { array_contains: [{ fixtureId }] },
        },
        select: { number: true, matches: true },
      });

      if (!round) {
        throw new HttpError(409, "A ticket match has no available simulation data.");
      }

      const match = (round.matches as RoundMatch[]).find(
        (item) => item.fixtureId === fixtureId
      );

      if (
        !match ||
        !Number.isFinite(match.lamH) ||
        !Number.isFinite(match.lamA) ||
        match.lamH <= 0 ||
        match.lamA <= 0 ||
        match.home !== fixture.homeTeam ||
        match.away !== fixture.awayTeam
      ) {
        throw new HttpError(409, "A ticket match has invalid simulation data.");
      }

      const result = simulate(seed, round.number, match.i, match.lamH, match.lamA);

      results.push({
        fixtureId,
        home: match.home,
        away: match.away,
        hs: result.hs,
        as: result.as,
        goals: result.goals,
      });
    }

    const claimed = await tx.virtualTicketSession.updateMany({
      where: { id: session.id, userId, status: "READY" },
      data: {
        status: "RUNNING",
        seed,
        seedHash: sha(seed),
        results: results as unknown as Prisma.InputJsonValue,
        startedAt,
        endsAt,
      },
    });

    if (claimed.count !== 1) {
      throw new HttpError(409, "This ticket's matches have already been started.");
    }

    return {
      sessionId: session.id,
      status: "RUNNING",
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      matches: results.map((match) => ({
        fixtureId: match.fixtureId,
        home: match.home,
        away: match.away,
      })),
    };
  }, { timeout: 20_000 });

  await publishUser(userId, "bet", { ticketId, virtualSession: true });
  return started;
}

async function finishTicketSession(sessionId: string) {
  const reference = await db.virtualTicketSession.findUnique({
    where: { id: sessionId },
    select: { ticketId: true },
  });

  if (!reference) return null;

  const ticketId = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "BetTicket"
      WHERE "id" = ${reference.ticketId} FOR UPDATE
    `;

    await tx.$queryRaw`
      SELECT "id" FROM "VirtualTicketSession"
      WHERE "id" = ${sessionId} FOR UPDATE
    `;

    const session = await tx.virtualTicketSession.findUnique({
      where: { id: sessionId },
      include: { ticket: { include: { legs: true } } },
    });

    if (!session) return null;

    if (session.ticketId !== reference.ticketId) {
      throw new Error(`Virtual ticket session ${sessionId} changed ticket ownership.`);
    }

    if (session.status === "DONE") {
      return session.ticket.status === "OPEN" ? session.ticketId : null;
    }

    if (
      session.status !== "RUNNING" ||
      !session.endsAt ||
      session.endsAt > new Date()
    ) {
      return null;
    }

    const ticket = await tx.betTicket.findFirst({
      where: {
        id: session.ticketId,
        userId: session.userId,
        isVirtual: true,
      },
      include: { legs: true },
    });

    if (!ticket || ticket.status !== "OPEN") {
      await tx.virtualTicketSession.update({
        where: { id: session.id },
        data: { status: "DONE" },
      });
      return null;
    }

    const results = session.results as unknown as SessionResult[] | null;

    if (!Array.isArray(results) || results.length === 0) {
      throw new Error(`Virtual ticket session ${session.id} has no results.`);
    }

    const resultMap = new Map(results.map((result) => [result.fixtureId, result]));
    const fixtureIds = session.fixtureIds as string[];

    if (
      fixtureIds.length !== results.length ||
      fixtureIds.some((id) => !resultMap.has(id))
    ) {
      throw new Error(`Virtual ticket session ${session.id} has inconsistent results.`);
    }

    for (const leg of ticket.legs) {
      if (leg.result !== "PENDING") continue;

      const match = resultMap.get(leg.fixtureId);
      if (!match) {
        throw new Error(`Missing private result for virtual ticket leg ${leg.id}.`);
      }

      const market = leg.marketId
        ? await tx.market.findUniqueOrThrow({
            where: { id: leg.marketId },
            select: { type: true, line: true },
          })
        : null;

      const odds = leg.oddsId
        ? await tx.marketOdds.findUniqueOrThrow({
            where: { id: leg.oddsId },
            select: { key: true },
          })
        : null;

      const selectionResult = resultFor(
        market?.type ?? "ONE_X_TWO",
        odds?.key ?? "",
        leg.line === null ? null : Number(leg.line),
        match.hs,
        match.as
      );

      await tx.betLeg.updateMany({
        where: { id: leg.id, ticketId: ticket.id, result: "PENDING" },
        data: {
          result: selectionResult,
          settledAt: new Date(),
        },
      });
    }

    await tx.virtualTicketSession.update({
      where: { id: session.id },
      data: { status: "DONE" },
    });

    return ticket.id;
  }, { timeout: 20_000 });

  if (ticketId) await evaluateTicketTx(ticketId);
  return ticketId;
}

let busy = false;

export function startVirtualTicketSessions() {
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;

    try {
      const now = new Date();

      const expired = await db.virtualTicketSession.findMany({
        where: {
          status: "RUNNING",
          endsAt: { lte: now },
        },
        select: { id: true },
        take: 100,
      });

      for (const session of expired) {
        try {
          await finishTicketSession(session.id);
        } catch (error) {
          console.error(`[virtual-ticket-sessions] failed to finish ${session.id}:`, error);
        }
      }

      const completed = await db.virtualTicketSession.findMany({
        where: {
          status: "DONE",
          ticket: { status: "OPEN" },
        },
        select: { ticketId: true },
        take: 100,
      });

      for (const session of completed) {
        try {
          await evaluateTicketTx(session.ticketId);
        } catch (error) {
          console.error(`[virtual-ticket-sessions] failed to settle ticket ${session.ticketId}:`, error);
        }
      }
    } catch (error) {
      console.error("[virtual-ticket-sessions]", error);
    } finally {
      busy = false;
    }
  }, 500);

  return () => clearInterval(timer);
}
