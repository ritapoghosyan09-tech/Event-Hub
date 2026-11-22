/**
 * Card payments, provider-agnostic.
 *
 *   buyer books paid tickets
 *     → seats HELD, booking PENDING (bookings-core, holdUntil)
 *     → startCheckoutWith: provider checkout page + a payments row
 *   provider webhook "completed"
 *     → confirmHeldBookingWith: tickets issued, payment SUCCEEDED
 *     → paid after the seats were resold? refund at once, booking REFUNDED
 *   provider webhook "expired", or the cron sweep after the hold time
 *     → expireHeldBookingWith: seats back on sale
 *
 * Every webhook is recorded in webhook_events (unique per provider + event id)
 * and processed once, however often the provider retries.
 *
 * Prisma and the provider are passed in so tests exercise this file directly.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { cancelBookingWith, confirmHeldBookingWith, expireHeldBookingWith } from "./bookings-core";

type Client = InstanceType<typeof PrismaClient>;

export type CheckoutInput = {
  bookingId: string;
  bookingCode: string;
  currency: string;
  customerEmail: string;
  lines: { name: string; unitAmountMinor: number; quantity: number }[];
  expiresAt: Date;
  successUrl: string;
  cancelUrl: string;
  description: string;
};

export type PaymentEvent =
  | { id: string; kind: "completed"; checkoutRef: string; bookingId: string; amountMinor: number }
  | { id: string; kind: "expired"; checkoutRef: string; bookingId: string }
  | { id: string; kind: "ignored"; type: string };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<{ ref: string; url: string }>;
  /** Stops a checkout from being paid. "paid" means it completed first: wait for its webhook. */
  closeCheckout(ref: string): Promise<"closed" | "paid">;
  refund(checkoutRef: string, amountMinor: number): Promise<void>;
  /** Verifies the signature and maps the provider's event. Throws on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent>;
}

export function platformFee(amountMinor: number, bps = Number(process.env.PLATFORM_FEE_BPS ?? 0)) {
  return Math.round((amountMinor * Math.max(0, bps)) / 10_000);
}

export async function startCheckoutWith(prisma: Client, provider: PaymentProvider, input: CheckoutInput) {
  const session = await provider.createCheckout(input);
  const amount = input.lines.reduce((s, l) => s + l.unitAmountMinor * l.quantity, 0);
  await prisma.payment.create({
    data: {
      id: randomUUID(),
      bookingId: input.bookingId,
      provider: provider.name,
      providerPaymentRef: session.ref,
      status: "REQUIRES_ACTION",
      amountMinor: amount,
      currency: input.currency,
      platformFeeMinor: platformFee(amount),
    },
  });
  return session;
}

export type HandleResult =
  | "duplicate"
  | "ignored"
  | "confirmed"
  | "already-confirmed"
  | "refunded-unavailable"
  | "expired"
  | "not-found";

export async function handlePaymentEventWith(
  prisma: Client,
  provider: PaymentProvider,
  event: PaymentEvent,
  hooks: { onConfirmed?: (bookingId: string) => Promise<unknown> | void } = {},
  now = new Date(),
): Promise<HandleResult> {
  // Record first; a retry of an event already processed stops here.
  const existing = await prisma.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: provider.name, providerEventId: event.id } } });
  if (existing?.processedAt) return "duplicate";
  const row =
    existing ??
    (await prisma.webhookEvent.create({
      data: { id: randomUUID(), provider: provider.name, providerEventId: event.id, type: event.kind === "ignored" ? event.type : `checkout.${event.kind}` },
    }));

  try {
    const result = await apply(prisma, provider, event, hooks, now);
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { processedAt: new Date(), error: null } });
    return result;
  } catch (e) {
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { error: String((e as Error).message ?? e).slice(0, 500) } });
    throw e; // the provider retries
  }
}

async function apply(
  prisma: Client,
  provider: PaymentProvider,
  event: PaymentEvent,
  hooks: { onConfirmed?: (bookingId: string) => Promise<unknown> | void },
  now: Date,
): Promise<HandleResult> {
  if (event.kind === "ignored") return "ignored";
  const payment = await prisma.payment.findUnique({ where: { providerPaymentRef: event.checkoutRef } });
  if (!payment || payment.bookingId !== event.bookingId) return "not-found";

  if (event.kind === "expired") {
    if (payment.status === "REQUIRES_ACTION") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Checkout expired" } });
    }
    return (await expireHeldBookingWith(prisma, payment.bookingId, now)) ? "expired" : "ignored";
  }

  // completed
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", amountMinor: event.amountMinor, failureReason: null } });
  const result = await confirmHeldBookingWith(prisma, payment.bookingId, now);
  if (result.outcome === "confirmed") {
    await hooks.onConfirmed?.(payment.bookingId);
    return "confirmed";
  }
  if (result.outcome === "already-confirmed") return "already-confirmed";
  if (result.outcome === "not-found") return "not-found";

  // Paid, but the seats went to someone else after the hold lapsed: give the money back.
  await provider.refund(payment.providerPaymentRef, event.amountMinor);
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED", refundedAmountMinor: event.amountMinor, failureReason: "Seats no longer available" } });
  await prisma.booking.update({ where: { id: payment.bookingId }, data: { status: "REFUNDED", cancelledAt: now } });
  return "refunded-unavailable";
}

/**
 * Sweeps holds whose time is up. The provider is told to close the checkout
 * first, so nobody can pay for seats that are going back on sale; a checkout
 * that turns out to be paid is left for its webhook to confirm.
 */
export async function expireStaleHoldsWith(prisma: Client, provider: PaymentProvider | null, now = new Date()) {
  const stale = await prisma.booking.findMany({
    where: { status: "PENDING", holdExpiresAt: { lt: now } },
    select: { id: true, payments: { where: { status: "REQUIRES_ACTION" }, select: { id: true, providerPaymentRef: true } } },
    take: 200,
  });
  let expired = 0;
  for (const b of stale) {
    let paid = false;
    for (const p of b.payments) {
      if (!provider) continue;
      if ((await provider.closeCheckout(p.providerPaymentRef)) === "paid") paid = true;
      else await prisma.payment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: "Hold expired" } });
    }
    if (!paid && (await expireHeldBookingWith(prisma, b.id, now))) expired++;
  }
  return { checked: stale.length, expired };
}

/** Refunds whatever was paid online for a booking. Returns true if anything was refunded. */
export async function refundBookingPaymentsWith(prisma: Client, provider: PaymentProvider | null, bookingId: string) {
  const paid = await prisma.payment.findMany({ where: { bookingId, status: "SUCCEEDED" } });
  if (!paid.length) return false;
  if (!provider) throw new Error("A card payment needs refunding but no payment provider is configured.");
  for (const p of paid) {
    const amount = p.amountMinor - p.refundedAmountMinor;
    if (amount > 0) await provider.refund(p.providerPaymentRef, amount);
    await prisma.payment.update({ where: { id: p.id }, data: { status: "REFUNDED", refundedAmountMinor: p.amountMinor } });
  }
  await prisma.booking.updateMany({ where: { id: bookingId, status: "CANCELLED" }, data: { status: "REFUNDED" } });
  return true;
}

/** Organizer cancels an event: every live booking is cancelled (and refunded if paid). */
export async function cancelEventBookingsWith(prisma: Client, provider: PaymentProvider | null, eventId: string, now = new Date()) {
  const live = await prisma.booking.findMany({ where: { eventId, status: { in: ["CONFIRMED", "PENDING"] } }, select: { id: true } });
  const done: { bookingId: string; refunded: boolean }[] = [];
  for (const { id } of live) {
    const cancelled = await cancelBookingWith(prisma, id, now);
    if (!cancelled) continue;
    for (const p of await prisma.payment.findMany({ where: { bookingId: id, status: "REQUIRES_ACTION" } })) {
      if (provider) await provider.closeCheckout(p.providerPaymentRef).catch(() => "closed");
      await prisma.payment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: "Event cancelled" } });
    }
    const refunded = await refundBookingPaymentsWith(prisma, provider, id);
    done.push({ bookingId: id, refunded });
  }
  return done;
}
