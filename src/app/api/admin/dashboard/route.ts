import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/http";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);

    const [totalUsers, totalFixtures, totalBetTickets, totalTransactions] =
      await Promise.all([
        db.user.count(),
        db.fixture.count(),
        db.betTicket.count(),
        db.transaction.count(),
      ]);

    return NextResponse.json({
      totalUsers,
      totalFixtures,
      totalBetTickets,
      totalTransactions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error("[admin dashboard]", error);
    return NextResponse.json(
      { error: "Unable to load dashboard data." },
      { status: 500 },
    );
  }
}
