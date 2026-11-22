/**
 * Studio reads. Callers pass an organization id they got from
 * requireOrgAccess, so every query is scoped to an organization the user
 * belongs to. Nothing here is cached: organizers expect live numbers.
 */
import "server-only";
import { db } from "./db";
import { orgStatsWith, publishChecklistWith } from "./studio-core";
import { utcToZonedLocal } from "@/lib/timezone";

export async function getStudioDashboard(orgId: string) {
  const now = new Date();
  const [stats, events] = await Promise.all([
    orgStatsWith(db, orgId, now),
    db.event.findMany({
      where: { organizationId: orgId },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        visibility: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        currency: true,
        venue: { select: { name: true, city: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { storageKey: true, alt: true } },
        ticketTypes: { where: { status: { not: "HIDDEN" } }, select: { quantityTotal: true, quantitySold: true } },
        bookings: { where: { status: "CONFIRMED" }, select: { totalMinor: true } },
      },
    }),
  ]);
  const rows = events.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    status: e.status,
    visibility: e.visibility,
    startsAt: e.startsAt.toISOString(),
    timezone: e.timezone,
    past: e.endsAt <= now,
    place: e.venue ? `${e.venue.name}, ${e.venue.city}` : "Online",
    image: e.images[0] ? { src: e.images[0].storageKey, alt: e.images[0].alt } : null,
    sold: e.ticketTypes.reduce((n, t) => n + t.quantitySold, 0),
    capacity: e.ticketTypes.reduce((n, t) => n + t.quantityTotal, 0),
    revenueMinor: e.bookings.reduce((n, b) => n + b.totalMinor, 0),
    currency: e.currency ?? "USD",
  }));
  return { stats, upcoming: rows.filter((r) => !r.past && r.status !== "CANCELLED"), other: rows.filter((r) => r.past || r.status === "CANCELLED").reverse() };
}

export async function getStudioEvent(orgId: string, eventId: string) {
  const e = await db.event.findFirst({
    where: { id: eventId, organizationId: orgId },
    include: {
      venue: true,
      images: { orderBy: { sortOrder: "asc" } },
      ticketTypes: { where: { status: { not: "HIDDEN" } }, orderBy: { sortOrder: "asc" } },
      _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
    },
  });
  if (!e) return null;
  const checklist = e.status === "DRAFT" ? await publishChecklistWith(db, e.id) : [];
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    status: e.status,
    visibility: e.visibility,
    categoryId: e.categoryId,
    summary: e.summary,
    description: e.description,
    format: e.format,
    onlineUrl: e.onlineUrl ?? "",
    timezone: e.timezone,
    startsLocal: utcToZonedLocal(e.startsAt, e.timezone),
    endsLocal: utcToZonedLocal(e.endsAt, e.timezone),
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    currency: e.currency ?? "EUR",
    ageRestriction: e.ageRestriction,
    refundPolicy: e.refundPolicy ?? "",
    cancelReason: e.cancelReason,
    venueId: e.venueId,
    venue: e.venue ? { name: e.venue.name, city: e.venue.city } : null,
    bookings: e._count.bookings,
    past: e.endsAt <= new Date(),
    images: e.images.map((i) => ({ id: i.id, src: i.storageKey, alt: i.alt })),
    ticketTypes: e.ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      priceMinor: t.priceMinor,
      quantityTotal: t.quantityTotal,
      quantitySold: t.quantitySold,
      quantityHeld: t.quantityHeld,
      maxPerOrder: t.maxPerOrder,
    })),
    checklist,
  };
}
export type StudioEvent = NonNullable<Awaited<ReturnType<typeof getStudioEvent>>>;

export async function getOrgVenues(orgId: string) {
  return db.venue.findMany({
    where: { OR: [{ organizationId: orgId }, { events: { some: { organizationId: orgId } } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, timezone: true },
  });
}

export async function getAttendees(orgId: string, eventId: string) {
  const event = await db.event.findFirst({ where: { id: eventId, organizationId: orgId }, select: { id: true, title: true, slug: true, startsAt: true, timezone: true } });
  if (!event) return null;
  const tickets = await db.ticket.findMany({
    where: { booking: { eventId, status: "CONFIRMED" } },
    orderBy: [{ booking: { createdAt: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      attendeeName: true,
      attendeeEmail: true,
      ticketType: { select: { name: true } },
      booking: { select: { code: true, createdAt: true, contactName: true, contactEmail: true, totalMinor: true, currency: true, payments: { where: { status: "SUCCEEDED" }, select: { id: true } } } },
    },
  });
  return {
    event: { ...event, startsAt: event.startsAt.toISOString() },
    rows: tickets.map((t) => ({
      id: t.id,
      code: t.booking.code,
      name: t.attendeeName ?? t.booking.contactName,
      email: t.attendeeEmail ?? t.booking.contactEmail,
      ticketType: t.ticketType.name,
      status: t.status,
      checkedInAt: t.checkedInAt?.toISOString() ?? null,
      bookedAt: t.booking.createdAt.toISOString(),
      payment: t.booking.totalMinor === 0 ? "Free" : t.booking.payments.length ? "Paid online" : "Pay at venue",
    })),
  };
}

export async function getOrgSettings(orgId: string) {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } } },
  });
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    type: org.type,
    bio: org.bio ?? "",
    websiteUrl: org.websiteUrl ?? "",
    contactEmail: org.contactEmail,
    payoutsEnabled: org.payoutsEnabled,
    members: org.members.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
  };
}

export function getCategoryOptions() {
  return db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
}
