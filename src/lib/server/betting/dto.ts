import { fixed } from "../money";
import { computeOffer, type TicketFull } from "./cashout";
import { Prisma } from "@prisma/client";

type SettledTicket = Prisma.BetTicketGetPayload<{
  include: { legs: true };
}>;

export function ticketDto(t: TicketFull | SettledTicket) {
  const cashout = t.status === "OPEN"
    ? computeOffer(t as TicketFull).offer
    : { available: false as const, reason: "This bet is settled." };

  return {
    id: t.id, publicId: t.publicId, type: t.type, flexiCut: t.flexiCut, status: t.status,
    stake: fixed(t.stake), remainingStake: fixed(t.remainingStake), totalOdds: t.totalOdds.toFixed(2), bonusPct: Number(t.bonusPct),
    potentialPayout: fixed(t.potentialPayout), payout: fixed(t.payout), cashedOut: fixed(t.cashedOutAmount),
    autoCashoutTarget: t.autoCashoutTarget ? fixed(t.autoCashoutTarget) : null,
    placedAt: t.placedAt.toISOString(), settledAt: t.settledAt?.toISOString() ?? null,
    cashout,
    legs: t.legs.map((l) => ({ id: l.id, fixtureId: l.fixtureId, matchName: l.matchName, marketName: l.marketName, pickLabel: l.pickLabel, oddsTaken: l.oddsTaken.toFixed(2), result: l.result, live: l.placedLive })),
  };
}
