/**
 * Data for the signed-in person's own pages. Every function takes the user
 * from the session (never from the client), so nobody can read another
 * account's bookings by changing an id.
 */
import "server-only";
import { db } from "./db";
import { canAttendeeCancel } from "./bookings-core";
import type { CurrentUser } from "./session";

export async function getMyBookings(user: CurrentUser) {
  const rows = await db.booking.findMany({
    where: { userId: user.id, status: { in: ["CONFIRMED", "CANCELLED", "REFUNDED", "PENDING"] } },
    orderBy: { event: { startsAt: "asc" } },
    include: {
      event: {
        select: {
          slug: true,
          title: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          status: true,
          venue: { select: { name: true, city: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { storageKey: true, alt: true } },
        },
      },
      items: { select: { quantity: true } },
      payments: { where: { status: "SUCCEEDED" }, select: { id: true } },
    },
    take: 200,
  });
  const now = new Date();
  return rows.map((b) => ({
    id: b.id,
    code: b.code,
    status: b.status,
    tickets: b.items.reduce((n, i) => n + i.quantity, 0),
    totalMinor: b.totalMinor,
    currency: b.currency,
    paidOnline: b.payments.length > 0,
    upcoming: b.event.endsAt > now,
    canCancel: canAttendeeCancel(b, now),
    event: {
      slug: b.event.slug,
      title: b.event.title,
      startsAt: b.event.startsAt.toISOString(),
      endsAt: b.event.endsAt.toISOString(),
      timezone: b.event.timezone,
      status: b.event.status,
      place: b.event.venue ? `${b.event.venue.name}, ${b.event.venue.city}` : "Online",
      image: b.event.images[0] ? { src: b.event.images[0].storageKey, alt: b.event.images[0].alt } : null,
    },
  }));
}
export type MyBooking = Awaited<ReturnType<typeof getMyBookings>>[number];

export async function getMyOrganizations(user: CurrentUser) {
  const rows = await db.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({ slug: m.organization.slug, name: m.organization.name, role: m.role }));
}
