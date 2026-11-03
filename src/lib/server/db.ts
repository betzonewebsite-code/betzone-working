import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// One client per process. In Next dev mode, hot reload would otherwise open a new connection pool every save.
const g = globalThis as unknown as { __prisma?: PrismaClient };
export const db = g.__prisma ?? new PrismaClient({ log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
if (env.NODE_ENV !== "production") g.__prisma = db;
