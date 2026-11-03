/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { finalizeDeposit } from "@/lib/server/payments/deposit";
import { validSignature } from "@/lib/server/payments/paystack";
import {
  completeWithdrawal,
  failWithdrawal,
} from "@/lib/server/payments/withdraw";

// Paystack webhooks stay disabled until the real secret is configured.
// Never process a payment event without verifying its signature.
export async function POST(req: NextRequest) {
  if (!process.env.PAYSTACK_SECRET_KEY?.trim()) {
    console.error(
      "[Paystack webhook] Disabled: PAYSTACK_SECRET_KEY is not configured."
    );

    return NextResponse.json(
      { error: "Paystack webhook is not configured yet." },
      { status: 503 }
    );
  }

  const raw = await req.text();

  let signatureIsValid = false;

  try {
    signatureIsValid = validSignature(
      raw,
      req.headers.get("x-paystack-signature")
    );
  } catch (error) {
    console.error(
      "[Paystack webhook] Signature verification failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  if (!signatureIsValid) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let evt: { event: string; data: any };

  try {
    evt = JSON.parse(raw) as { event: string; data: any };
  } catch {
    return new NextResponse("invalid payload", { status: 400 });
  }

  if (!evt.event || !evt.data) {
    return new NextResponse("invalid payload", { status: 400 });
  }

  const eventId = `${evt.event}-${evt.data?.id ?? evt.data?.reference
    }`;

  if (eventId.endsWith("-undefined")) {
    return new NextResponse("missing event identifier", { status: 400 });
  }

  // Paystack may deliver the same event more than once.
  // A unique database record prevents duplicate processing.
  let rec = await db.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: "paystack",
        eventId,
      },
    },
  });

  if (rec?.processedAt) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    rec ??= await db.webhookEvent.create({
      data: {
        provider: "paystack",
        eventId,
        payload: evt as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    // A concurrent delivery may have created the event record.
    const existing = await db.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: "paystack",
          eventId,
        },
      },
    });

    if (!existing) {
      console.error(
        "[Paystack webhook] Could not record event:",
        error instanceof Error ? error.message : "Unknown error"
      );

      return new NextResponse("retry", { status: 500 });
    }

    if (existing.processedAt) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    rec = existing;
  }

  try {
    const ref = evt.data?.reference as string | undefined;

    if (
      ["charge.success", "transfer.success", "transfer.failed", "transfer.reversed"].includes(
        evt.event
      ) &&
      !ref
    ) {
      return new NextResponse("missing reference", { status: 400 });
    }

    if (evt.event === "charge.success") {
      await finalizeDeposit(ref!);
    } else if (evt.event === "transfer.success") {
      await completeWithdrawal(ref!);
    } else if (
      evt.event === "transfer.failed" ||
      evt.event === "transfer.reversed"
    ) {
      await failWithdrawal(ref!, evt.event);
    }

    await db.webhookEvent.update({
      where: { id: rec.id },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "[Paystack webhook]",
      evt.event,
      error instanceof Error ? error.message : "Unknown error"
    );

    // Return an error so Paystack can retry delivery.
    return new NextResponse("retry", { status: 500 });
  }
}