"use server";

import { redirect } from "next/navigation";
import { revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { BookingError, createBooking, expireHeldBooking } from "@/server/bookings";
import { getCurrentUser } from "@/server/session";
import { sendBookingConfirmation } from "@/server/notifications";
import { cardPaymentsEnabled, holdMinutes, startCheckout } from "@/server/payments";
import { appUrl } from "@/server/emails";
import { checkoutCancelToken } from "@/server/checkout-token";

export type BookingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "items", string>>;
};

const schema = z.object({
  eventId: z.string().min(1),
  eventSlug: z.string().min(1),
  name: z.string().trim().min(2, "Enter the name for the tickets.").max(120),
  email: z.string().trim().email("Enter an email address we can send tickets to."),
  idempotencyKey: z.string().min(16).max(128),
});

export async function bookTickets(_prev: BookingFormState, form: FormData): Promise<BookingFormState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  const items = Array.from(form.entries())
    .filter(([k]) => k.startsWith("qty:"))
    .map(([k, v]) => ({ ticketTypeId: k.slice(4), quantity: Number(v) || 0 }))
    .filter((i) => i.quantity > 0);

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { name: f.name?.[0], email: f.email?.[0] } };
  }
  if (!items.length) return { fieldErrors: { items: "Choose at least one ticket." } };

  const user = await getCurrentUser();

  // Paid tickets go through card checkout when a payment provider is set up;
  // otherwise they are reserved and paid at the venue.
  const priced = await db.ticketType.count({ where: { id: { in: items.map((i) => i.ticketTypeId) }, eventId: parsed.data.eventId, priceMinor: { gt: 0 } } });
  const payByCard = priced > 0 && cardPaymentsEnabled();

  let booking: Awaited<ReturnType<typeof createBooking>>;
  try {
    booking = await createBooking({
      eventId: parsed.data.eventId,
      userId: user?.id ?? null,
      items,
      contactName: parsed.data.name,
      contactEmail: parsed.data.email,
      idempotencyKey: parsed.data.idempotencyKey,
      holdUntil: payByCard ? new Date(Date.now() + holdMinutes() * 60_000) : undefined,
    });
  } catch (e) {
    if (e instanceof BookingError) {
      return e.field === "items" ? { fieldErrors: { items: e.message } } : { error: e.message };
    }
    console.error("booking failed", e);
    return { error: "We couldn't complete the booking. Nothing was charged; please try again." };
  }

  updateTag(`event:${parsed.data.eventSlug}`);
  if (user) updateTag(`user:${user.id}:bookings`);
  revalidateTag("events", "max");

  if (booking.status === "PENDING") {
    // A resubmitted form (same idempotency key) reuses the checkout it already opened.
    const open = await db.payment.count({ where: { bookingId: booking.id, status: "REQUIRES_ACTION" } });
    if (open) redirect(`/bookings/${booking.code}`);
    let url: string;
    try {
      const full = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { event: { select: { title: true } }, items: { include: { ticketType: { select: { name: true } } } } },
      });
      const session = await startCheckout({
        bookingId: full.id,
        bookingCode: full.code,
        currency: full.currency,
        customerEmail: full.contactEmail,
        description: `${full.event.title} (${full.code})`,
        lines: full.items.map((i) => ({ name: `${full.event.title}: ${i.ticketType.name}`, unitAmountMinor: i.unitPriceMinor, quantity: i.quantity })),
        expiresAt: full.holdExpiresAt ?? new Date(Date.now() + holdMinutes() * 60_000),
        successUrl: appUrl(`/bookings/${full.code}?paid=1`),
        cancelUrl: appUrl(`/events/${parsed.data.eventSlug}?checkout=cancelled&booking=${full.id}&token=${checkoutCancelToken(full.id)}`),
      });
      url = session.url;
    } catch (e) {
      console.error("checkout failed", e);
      await expireHeldBooking(booking.id);
      updateTag(`event:${parsed.data.eventSlug}`);
      return { error: "Card payment is unavailable right now, so nothing was charged. Please try again in a few minutes." };
    }
    redirect(url);
  }

  after(() => sendBookingConfirmation(booking.id));
  redirect(`/bookings/${booking.code}`);
}
