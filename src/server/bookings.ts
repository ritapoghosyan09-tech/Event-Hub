import "server-only";
import { db } from "./db";
import { createBookingWith, expireHeldBookingWith, BookingError, type BookingInput } from "./bookings-core";

export { BookingError };

export function createBooking(input: BookingInput) {
  return createBookingWith(db, input);
}

export function expireHeldBooking(bookingId: string) {
  return expireHeldBookingWith(db, bookingId);
}

/** Confirmation page data. Not cached: it is private to whoever holds the code. */
export async function getBookingByCode(code: string) {
  const b = await db.booking.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      event: {
        include: {
          venue: true,
          organization: { select: { name: true, slug: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
      items: { include: { ticketType: { select: { name: true } } } },
      tickets: { select: { id: true, qrToken: true, status: true, ticketTypeId: true } },
      payments: { select: { status: true } },
    },
  });
  if (!b) return null;
  return {
    code: b.code,
    status: b.status,
    contactName: b.contactName,
    contactEmail: b.contactEmail,
    totalMinor: b.totalMinor,
    currency: b.currency,
    paidOnline: b.payments.some((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED"),
    createdAt: b.createdAt.toISOString(),
    event: {
      slug: b.event.slug,
      title: b.event.title,
      startsAt: b.event.startsAt.toISOString(),
      endsAt: b.event.endsAt.toISOString(),
      timezone: b.event.timezone,
      status: b.event.status,
      cancelReason: b.event.cancelReason,
      // The stream link is only for ticket holders, and only once the booking is confirmed.
      onlineUrl: b.status === "CONFIRMED" && b.event.format !== "IN_PERSON" ? b.event.onlineUrl : null,
      organizer: b.event.organization,
      image: b.event.images[0] ? { src: b.event.images[0].storageKey, alt: b.event.images[0].alt } : null,
      venue: b.event.venue
        ? { name: b.event.venue.name, address: b.event.venue.addressLine1, city: b.event.venue.city }
        : null,
    },
    items: b.items.map((i) => ({ name: i.ticketType.name, quantity: i.quantity, unitPriceMinor: i.unitPriceMinor })),
    tickets: b.tickets.map((t) => ({
      id: t.id,
      token: t.qrToken,
      status: t.status,
      typeName: b.items.find((i) => i.ticketTypeId === t.ticketTypeId)?.ticketType.name ?? "Ticket",
    })),
  };
}
