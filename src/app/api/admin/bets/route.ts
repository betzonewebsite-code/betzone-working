import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { handler, json, HttpError } from "@/lib/server/http";

const querySchema = z.object({
  status: z.enum(["OPEN", "WON", "LOST", "VOID", "CASHED_OUT"]).optional(),
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

  const { status, q, limit } = parsed.data;

  const where: Prisma.BetTicketWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { publicId: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q, mode: "insensitive" } } },
        { user: { firstName: { contains: q, mode: "insensitive" } } },
        { user: { lastName: { contains: q, mode: "insensitive" } } },
      ],
    } : {}),
  };

  const [tickets, count] = await Promise.all([
    db.betTicket.findMany({
      where,
      orderBy: [{ placedAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        publicId: true,
        userId: true,
        type: true,
        stake: true,
        remainingStake: true,
        totalOdds: true,
        bonusPct: true,
        potentialPayout: true,
        payout: true,
        cashedOutAmount: true,
        status: true,
        placedAt: true,
        settledAt: true,
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        legs: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            fixtureId: true,
            matchName: true,
            marketName: true,
            pickLabel: true,
            oddsTaken: true,
            line: true,
            placedLive: true,
            result: true,
            settledAt: true,
          },
        },
      },
    }),
    db.betTicket.count({ where }),
  ]);

  return json({
    tickets: tickets.map((ticket) => ({
      ...ticket,
      stake: Number(ticket.stake),
      remainingStake: Number(ticket.remainingStake),
      totalOdds: Number(ticket.totalOdds),
      bonusPct: Number(ticket.bonusPct),
      potentialPayout: Number(ticket.potentialPayout),
      payout: Number(ticket.payout),
      cashedOutAmount: Number(ticket.cashedOutAmount),
      legs: ticket.legs.map((leg) => ({
        ...leg,
        oddsTaken: Number(leg.oddsTaken),
        line: leg.line === null ? null : Number(leg.line),
      })),
    })),
    count,
    limit,
  });
});
