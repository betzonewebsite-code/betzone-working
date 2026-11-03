// Server-only. Never import this from a "use client" file.
// Secrets must never be exposed to the browser.
import "dotenv/config";
import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

    ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    OTP_TTL_SEC: z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

    // Email
    EMAIL_PROVIDER: z.enum(["console", "brevo"]).default("console"),
    BREVO_API_KEY: z.string().optional(),
    EMAIL_FROM_ADDRESS: z
      .string()
      .email()
      .default("no-reply@betzone.local"),
    EMAIL_FROM_NAME: z.string().default("BetZone"),

    // SMS
    SMS_PROVIDER: z
      .enum(["console", "arkesel", "twilio"])
      .default("console"),
    SMS_API_KEY: z.string().optional(),
    SMS_SENDER_ID: z.string().default("BetZone"),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM: z.string().optional(),

    // Sports providers
    SPORTS_PRIMARY: z
      .enum(["sportmonks", "sportsgameodds", "the-odds-api"])
      .default("sportmonks"),
    SPORTS_SECONDARY: z
      .enum(["sportmonks", "sportsgameodds", "the-odds-api", "none"])
      .default("sportsgameodds"),
    SPORTMONKS_API_KEY: z.string().optional(),
    SPORTSGAMEODDS_API_KEY: z.string().optional(),
    SGO_BOOKMAKERS: z.string().default("pinnacle,bet365"),
    THE_ODDS_API_KEY: z.string().optional(),
    ODDS_API_REGIONS: z.string().default("uk,eu"),
    SPORTS_LEAGUES: z
      .string()
      .default("EPL,UCL,LALIGA,SERIEA,BUNDESLIGA,LIGUE1,NBA"),
    SPORTS_POLL_LIVE_SEC: z.coerce.number().int().min(5).default(15),
    SPORTS_POLL_UPCOMING_SEC: z.coerce.number().int().min(60).default(600),
    SPORTS_TERTIARY: z.string().default("none"),

    // Paystack: credentials may be added after provider approval.
    // Webhook signature verification must remain enabled.
    PAYSTACK_SECRET_KEY: z.string().optional(),
    PAYSTACK_PUBLIC_KEY: z.string().optional(),

    // Betting and money rules
    LIVE_BET_DELAY_SEC: z.coerce.number().int().min(0).max(30).default(5),
    MIN_STAKE: z.coerce.number().positive().default(1),
    MAX_STAKE: z.coerce.number().positive().default(10000),
    MAX_PAYOUT: z.coerce.number().positive().default(500000),
    CASHOUT_MARGIN_PCT: z.coerce.number().min(0).max(50).default(5),
    DEPOSIT_MIN: z.coerce.number().positive().default(1),
    DEPOSIT_MAX: z.coerce.number().positive().default(10000),
    WITHDRAWAL_MIN: z.coerce.number().positive().default(5),
    WITHDRAWAL_AUTO_APPROVE_MAX: z.coerce.number().positive().default(500),
    WITHDRAWAL_DAILY_MAX: z.coerce.number().positive().default(5000),
    WITHDRAWAL_KYC_ABOVE: z.coerce.number().positive().default(1000),

    // Virtual games
    VIRTUALS_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    VIRTUALS_MARGIN_PCT: z.coerce.number().min(2).max(30).default(10),
    VIRTUALS_BETTING_SEC: z.coerce.number().int().min(20).max(300).default(60),
    VIRTUALS_PLAY_SEC: z.coerce.number().int().min(10).max(120).default(15),

    JACKPOT_HOUSE_PCT: z.coerce.number().min(0).max(50).default(20),

    // Games and virtuals
    GAMES_WALLET_SECRET: z
      .string()
      .min(24)
      .optional()
      .or(z.literal("")),
    GAMES_CATALOG: z.string().default("[]"),

    DEFAULT_CURRENCY: z.string().length(3).default("GHS"),
    COUNTRY_CODE: z.string().length(2).default("GH"),
    MIN_AGE: z.coerce.number().int().min(18).default(18),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:3000"),
    ALLOWED_CLIENT_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
    SOCKET_PORT: z.coerce.number().int().default(4000),
  })
  .superRefine((e, ctx) => {
    if (e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Access and refresh secrets must differ",
      });
    }

    if (e.NODE_ENV === "production") {
      if (e.EMAIL_PROVIDER === "console") {
        ctx.addIssue({
          code: "custom",
          path: ["EMAIL_PROVIDER"],
          message: "console email is not allowed in production",
        });
      }

      if (e.EMAIL_PROVIDER === "brevo" && !e.BREVO_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["BREVO_API_KEY"],
          message: "Required when EMAIL_PROVIDER=brevo",
        });
      }

      if (
        e.SPORTS_PRIMARY === "sportmonks" &&
        !e.SPORTMONKS_API_KEY
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["SPORTMONKS_API_KEY"],
          message: "Required in production",
        });
      }

      if (
        (e.SPORTS_PRIMARY === "sportsgameodds" ||
          e.SPORTS_SECONDARY === "sportsgameodds") &&
        !e.SPORTSGAMEODDS_API_KEY
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["SPORTSGAMEODDS_API_KEY"],
          message: "Required in production",
        });
      }

      if (
        (e.SPORTS_PRIMARY === "the-odds-api" ||
          e.SPORTS_SECONDARY === "the-odds-api" ||
          e.SPORTS_TERTIARY === "the-odds-api") &&
        !e.THE_ODDS_API_KEY
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["THE_ODDS_API_KEY"],
          message: "Required in production",
        });
      }

      // PAYSTACK_SECRET_KEY is intentionally not required for build-time
      // environment validation. Payment webhooks must still reject requests
      // when the secret is missing and verify signatures when configured.
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");

  for (const issue of parsed.error.issues) {
    console.error(
      `  ${issue.path.join(".")}: ${issue.message}`
    );
  }

  throw new Error("Fix your .env file (see .env.example)");
}

export const env = parsed.data;

