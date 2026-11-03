import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { handler, json, HttpError } from "@/lib/server/http";

const querySchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "SELF_EXCLUDED", "CLOSED"]).optional(),
  kycStatus: z.enum(["NONE", "PENDING", "VERIFIED", "REJECTED"]).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = handler(async (req) => {
  await requireAdmin(req);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  }

  const { status, kycStatus, q, limit } = parsed.data;

  const where: Prisma.UserWhereInput = {
    role: "USER",
    ...(status ? { status } : {}),
    ...(kycStatus ? { kycStatus } : {}),
    ...(q ? {
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [users, count, statusCounts] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        status: true,
        kycStatus: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        lockedUntil: true,
        failedLoginCount: true,
        wallet: {
          select: {
            balance: true,
            currency: true,
          },
        },
        limits: {
          select: {
            dailyDeposit: true,
            weeklyDeposit: true,
            monthlyDeposit: true,
            dailyStake: true,
            coolOffUntil: true,
            selfExcludedUntil: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            tickets: true,
            transactions: true,
          },
        },
      },
    }),
    db.user.count({ where }),
    db.user.groupBy({
      by: ["status"],
      where: { role: "USER" },
      _count: { id: true },
    }),
  ]);

  return json({
    users: users.map((user) => ({
      ...user,
      wallet: user.wallet
        ? {
            ...user.wallet,
            balance: Number(user.wallet.balance),
          }
        : null,
      limits: user.limits
        ? {
            ...user.limits,
            dailyDeposit: user.limits.dailyDeposit === null ? null : Number(user.limits.dailyDeposit),
            weeklyDeposit: user.limits.weeklyDeposit === null ? null : Number(user.limits.weeklyDeposit),
            monthlyDeposit: user.limits.monthlyDeposit === null ? null : Number(user.limits.monthlyDeposit),
            dailyStake: user.limits.dailyStake === null ? null : Number(user.limits.dailyStake),
          }
        : null,
    })),
    count,
    limit,
    statusCounts: statusCounts.map((item) => ({
      status: item.status,
      count: item._count.id,
    })),
  });
});
