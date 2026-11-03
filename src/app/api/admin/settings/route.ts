import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/http";
import { env } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      readOnly: true,
      groups: [
        {
          key: "betting",
          label: "Betting Rules",
          settings: [
            { key: "LIVE_BET_DELAY_SEC", label: "Live bet delay", value: env.LIVE_BET_DELAY_SEC, unit: "seconds" },
            { key: "MIN_STAKE", label: "Minimum stake", value: env.MIN_STAKE, currency: env.DEFAULT_CURRENCY },
            { key: "MAX_STAKE", label: "Maximum stake", value: env.MAX_STAKE, currency: env.DEFAULT_CURRENCY },
            { key: "MAX_PAYOUT", label: "Maximum payout", value: env.MAX_PAYOUT, currency: env.DEFAULT_CURRENCY },
            { key: "CASHOUT_MARGIN_PCT", label: "Cashout margin", value: env.CASHOUT_MARGIN_PCT, unit: "percent" },
          ],
        },
        {
          key: "payments",
          label: "Payment Limits",
          settings: [
            { key: "DEPOSIT_MIN", label: "Minimum deposit", value: env.DEPOSIT_MIN, currency: env.DEFAULT_CURRENCY },
            { key: "DEPOSIT_MAX", label: "Maximum deposit", value: env.DEPOSIT_MAX, currency: env.DEFAULT_CURRENCY },
            { key: "WITHDRAWAL_MIN", label: "Minimum withdrawal", value: env.WITHDRAWAL_MIN, currency: env.DEFAULT_CURRENCY },
            { key: "WITHDRAWAL_AUTO_APPROVE_MAX", label: "Automatic approval threshold", value: env.WITHDRAWAL_AUTO_APPROVE_MAX, currency: env.DEFAULT_CURRENCY },
            { key: "WITHDRAWAL_DAILY_MAX", label: "Daily withdrawal maximum", value: env.WITHDRAWAL_DAILY_MAX, currency: env.DEFAULT_CURRENCY },
            { key: "WITHDRAWAL_KYC_ABOVE", label: "KYC required above", value: env.WITHDRAWAL_KYC_ABOVE, currency: env.DEFAULT_CURRENCY },
          ],
        },
        {
          key: "virtuals",
          label: "Virtual Games",
          settings: [
            { key: "VIRTUALS_ENABLED", label: "Virtual games enabled", value: env.VIRTUALS_ENABLED },
            { key: "VIRTUALS_MARGIN_PCT", label: "Virtual games margin", value: env.VIRTUALS_MARGIN_PCT, unit: "percent" },
            { key: "VIRTUALS_BETTING_SEC", label: "Betting period", value: env.VIRTUALS_BETTING_SEC, unit: "seconds" },
            { key: "VIRTUALS_PLAY_SEC", label: "Play period", value: env.VIRTUALS_PLAY_SEC, unit: "seconds" },
            { key: "JACKPOT_HOUSE_PCT", label: "Jackpot house percentage", value: env.JACKPOT_HOUSE_PCT, unit: "percent" },
          ],
        },
        {
          key: "regional",
          label: "Regional Configuration",
          settings: [
            { key: "DEFAULT_CURRENCY", label: "Default currency", value: env.DEFAULT_CURRENCY },
            { key: "COUNTRY_CODE", label: "Country code", value: env.COUNTRY_CODE },
            { key: "MIN_AGE", label: "Minimum age", value: env.MIN_AGE, unit: "years" },
          ],
        },
      ],
      notes: [
        "These values come from validated server environment configuration.",
        "Changes require a controlled server configuration update and deployment.",
        "Secrets and provider credentials are intentionally excluded.",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("[admin settings]", error);
    return NextResponse.json(
      { error: "Unable to load platform settings." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
