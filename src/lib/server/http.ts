import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { env } from "./env";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) { super(message); }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

// Only trust x-forwarded-for when you run behind your own proxy / load balancer.
export const getIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
export const getUA = (req: NextRequest) => req.headers.get("user-agent") ?? undefined;

/** CSRF defence for cookie auth, on top of SameSite: reject state-changing requests from other origins. */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowedOrigins = env.ALLOWED_CLIENT_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);

  if (origin && !allowedOrigins.includes(origin)) {
    throw new HttpError(403, "Request blocked (origin not allowed).", "BAD_ORIGIN");
  }
}

export async function body<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new HttpError(400, "Invalid request body."); }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? "Invalid input.");
  return r.data;
}

/** Wraps a route: origin check, then turns thrown errors into clean JSON. Never leaks internals. */
export function handler(fn: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      if (req.method !== "GET") assertSameOrigin(req);
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code, ...e.extra }, e.status);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return json({ error: "That record already exists.", code: "DUPLICATE" }, 409);
      console.error("[api error]", e);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

