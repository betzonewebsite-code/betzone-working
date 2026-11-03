import { db } from "@/lib/server/db";
import { cashoutInclude } from "@/lib/server/betting/cashout";
import { ticketDto } from "@/lib/server/betting/dto";
import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

type SessionGoal = {
  minute: number;
  side: "h" | "a";
};

type SessionResult = {
  fixtureId: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  goals: SessionGoal[];
};

function getLiveMatches(session: {
  status: string;
  results: unknown;
  startedAt: Date | null;
  endsAt: Date | null;
}) {
  if (
    (session.status !== "RUNNING" && session.status !== "DONE") ||
    !Array.isArray(session.results)
  ) {
    return [];
  }

  const now = Date.now();
  const start = session.startedAt?.getTime() ?? now;
  const end = session.endsAt?.getTime() ?? now;
  const duration = Math.max(1, end - start);

  const minute =
    session.status === "DONE"
      ? 90
      : Math.max(0, Math.min(90, Math.floor(((now - start) / duration) * 90)));

  return (session.results as SessionResult[]).map((match) => {
    const goals = Array.isArray(match.goals)
      ? match.goals.filter(
          (goal) =>
            Number.isInteger(goal.minute) &&
            goal.minute >= 1 &&
            goal.minute <= 90 &&
            (goal.side === "h" || goal.side === "a") &&
            (session.status === "DONE" || goal.minute <= minute)
        )
      : [];

    return {
      fixtureId: match.fixtureId,
      home: match.home,
      away: match.away,
      minute,
      homeScore: goals.filter((goal) => goal.side === "h").length,
      awayScore: goals.filter((goal) => goal.side === "a").length,
      goals,
      status: session.status,
    };
  });
}

export const GET = handler(async (req) => {
  const user = await requireUser(req);

  const tickets = await db.betTicket.findMany({
    where: {
      userId: user.id,
      isVirtual: true,
    },
    include: {
      ...cashoutInclude,
      virtualSession: true,
    },
    orderBy: { placedAt: "desc" },
    take: 100,
  });

  return json({
    tickets: tickets.map((ticket) => {
      const session = ticket.virtualSession;

      return {
        ...ticketDto(ticket),
        virtualSession: session
          ? {
              id: session.id,
              status: session.status,
              fixtureIds: session.fixtureIds,
              startedAt: session.startedAt?.toISOString() ?? null,
              endsAt: session.endsAt?.toISOString() ?? null,
              matches: getLiveMatches(session),
            }
          : null,
      };
    }),
  });
});
