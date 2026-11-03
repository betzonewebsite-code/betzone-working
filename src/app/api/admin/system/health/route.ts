import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { redisReady } from "@/lib/server/redis";
import { queues } from "@/lib/server/queues";

export const dynamic = "force-dynamic";

async function timedCheck<T>(check: () => Promise<T>) {
  const started = Date.now();
  try {
    const details = await check();
    return { status: "healthy" as const, latencyMs: Date.now() - started, details };
  } catch {
    return { status: "unavailable" as const, latencyMs: Date.now() - started, details: null };
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);

    const [database, redis, latestFixture] = await Promise.all([
      timedCheck(async () => {
        await db.$queryRaw`SELECT 1`;
        return "Database connection successful";
      }),
      timedCheck(async () => {
        const client = await redisReady();
        await client.ping();
        return "Redis responds to PING";
      }),
      db.fixture.findFirst({
        orderBy: { lastSyncedAt: "desc" },
        select: { lastSyncedAt: true },
      }).catch(() => null),
    ]);

    const queueHealth = await timedCheck(async () => {
      const q = queues();
      const [settlement, payouts] = await Promise.all([
        q.settlement.getJobCounts("waiting", "active", "delayed", "failed", "completed"),
        q.payouts.getJobCounts("waiting", "active", "delayed", "failed", "completed"),
      ]);
      return { settlement, payouts };
    });

    const providerConfig = [
      { name: "sportmonks", priority: env.SPORTS_PRIMARY === "sportmonks" ? "primary" : env.SPORTS_SECONDARY === "sportmonks" ? "secondary" : env.SPORTS_TERTIARY === "sportmonks" ? "tertiary" : "not selected", configured: Boolean(env.SPORTMONKS_API_KEY) },
      { name: "sportsgameodds", priority: env.SPORTS_PRIMARY === "sportsgameodds" ? "primary" : env.SPORTS_SECONDARY === "sportsgameodds" ? "secondary" : env.SPORTS_TERTIARY === "sportsgameodds" ? "tertiary" : "not selected", configured: Boolean(env.SPORTSGAMEODDS_API_KEY) },
      { name: "the-odds-api", priority: env.SPORTS_PRIMARY === "the-odds-api" ? "primary" : env.SPORTS_SECONDARY === "the-odds-api" ? "secondary" : env.SPORTS_TERTIARY === "the-odds-api" ? "tertiary" : "not selected", configured: Boolean(env.THE_ODDS_API_KEY) },
    ];

    const integrations = [
      ...providerConfig.map((provider) => ({
        name: provider.name,
        priority: provider.priority,
        status: provider.priority === "not selected" ? "not selected" : provider.configured ? "configured" : "missing credentials",
        liveConnectivityChecked: false,
      })),
      { name: "Paystack", priority: "payments", status: env.PAYSTACK_SECRET_KEY && env.PAYSTACK_PUBLIC_KEY ? "configured" : "incomplete configuration", liveConnectivityChecked: false },
      { name: "Email", priority: "notifications", status: env.EMAIL_PROVIDER === "console" ? "console provider" : env.BREVO_API_KEY ? "configured" : "missing credentials", liveConnectivityChecked: false },
      { name: "SMS", priority: "notifications", status: env.SMS_PROVIDER === "console" ? "console provider" : env.SMS_PROVIDER === "arkesel" ? (env.SMS_API_KEY ? "configured" : "missing credentials") : (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM ? "configured" : "missing credentials"), liveConnectivityChecked: false },
    ];

    const services = [
      { service: "Database", ...database },
      { service: "Redis", ...redis },
      { service: "Background queues", ...queueHealth },
    ];

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      services,
      integrations,
      latestFixtureUpdate: latestFixture?.lastSyncedAt?.toISOString() ?? null,
      notes: [
        "Provider status reports configuration only; provider APIs are not contacted by this health check.",
        "Latest fixture update is not proof of a successful poll by every provider.",
        "Queue inspection is read-only; no jobs are added, removed, or processed.",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("[admin system health]", error);
    return NextResponse.json(
      { error: "Unable to load system health." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

