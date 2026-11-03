import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { handler, json, HttpError } from "@/lib/server/http";

const querySchema = z.object({
  action: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = handler(async (req) => {
  await requireAdmin(req);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  }

  const { action, q, limit } = parsed.data;

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { ip: { contains: q, mode: "insensitive" } },
            { userId: { contains: q, mode: "insensitive" } },
            { user: { is: { email: { contains: q, mode: "insensitive" } } } },
            { user: { is: { firstName: { contains: q, mode: "insensitive" } } } },
            { user: { is: { lastName: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [events, count, actionCounts] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        userId: true,
        action: true,
        ip: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({
      by: ["action"],
      _count: { id: true },
      orderBy: { action: "asc" },
    }),
  ]);

  return json({
    events,
    count,
    limit,
    actionCounts: actionCounts.map((item) => ({
      action: item.action,
      count: item._count.id,
    })),
  });
});
