
import { z } from "zod";

const money = z.number()
  .positive()
  .max(10_000_000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
    "Use at most 2 decimal places"
  );

export const placeSchema = z.object({
  tab: z.enum(["single", "multiple", "system"]),
  selections: z.array(
    z.object({
      oddsId: z.string().min(5).max(40),
      odds: z.number().min(1).max(1000),
    })
  ).min(1).max(30),
  stake: money.optional(),
  stakes: z.record(z.string(), money).optional(),
  flexiCut: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
  ]).default(0),
  systemSize: z.number().int().min(2).max(10).optional(),
  acceptOddsChange: z.boolean().default(false),
  idempotencyKey: z.string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/),
}).superRefine((data, ctx) => {
  if (data.tab === "system") {
    if (data.systemSize === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["systemSize"],
        message: "Select a System combination size.",
      });
    } else if (data.systemSize >= data.selections.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["systemSize"],
        message: "System size must be smaller than the number of selections.",
      });
    }

    if (!data.stake) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stake"],
        message: "Enter a System bet stake.",
      });
    }
  } else if (data.systemSize !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["systemSize"],
      message: "System size is only valid for System bets.",
    });
  }
});

export const cashoutSchema = z.object({
  fraction: z.number().min(0.05).max(1),
  expectedAmount: z.number().positive(),
  idempotencyKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9-]+$/),
});

export const autoSchema = z.object({
  target: z.number().positive().max(10_000_000).nullable(),
});

export const depositSchema = z.object({
  amount: money,
});

export const withdrawSchema = z.object({
  amount: money,
  network: z.enum(["mtn", "telecel", "airteltigo"]),
  pin: z.string().regex(/^\d{4}$/, "PIN is 4 digits"),
});

export const pinSchema = z.object({
  password: z.string().min(1).max(72),
  pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
});
