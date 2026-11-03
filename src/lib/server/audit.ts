import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Fire-and-forget security log. A logging failure must never break a login. */
export function audit(action: string, d: { userId?: string | null; ip?: string; metadata?: Record<string, unknown> } = {}) {
  void db.auditLog
    .create({ data: { action, userId: d.userId ?? null, ip: d.ip, metadata: (d.metadata ?? undefined) as Prisma.InputJsonValue | undefined } })
    .catch((e) => console.error("[audit]", e));
}
