/**
 * Organizer studio data logic: organizations, events, ticket types, venues,
 * publishing, check-in. Prisma client passed in (shared by app and tests).
 * Authorization happens in the callers (session.ts); these functions trust
 * the organization id they are given.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { zonedLocalToUtc } from "@/lib/timezone";

type Client = InstanceType<typeof PrismaClient>;

export class StudioError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export function slugify(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

async function uniqueSlug(exists: (slug: string) => Promise<boolean>, base: string) {
  let slug = slugify(base);
  for (let i = 2; await exists(slug); i++) slug = `${slugify(base).slice(0, 55)}-${i}`;
  return slug;
}

// ── Organizations ────────────────────────────────────────────────────────

export type OrgInput = {
  name: string;
  type: "INDIVIDUAL" | "BUSINESS" | "COMMUNITY" | "NONPROFIT";
  contactEmail: string;
  bio?: string | null;
  websiteUrl?: string | null;
};

export async function createOrganizationWith(prisma: Client, ownerId: string, input: OrgInput) {
  const slug = await uniqueSlug(async (s) => (await prisma.organization.count({ where: { slug: s } })) > 0, input.name);
  return prisma.organization.create({
    data: {
      id: randomUUID(),
      slug,
      name: input.name.trim(),
      type: input.type,
      contactEmail: input.contactEmail.trim().toLowerCase(),
      bio: input.bio?.trim() || null,
      websiteUrl: input.websiteUrl?.trim() || null,
      members: { create: { userId: ownerId, role: "OWNER" } },
    },
  });
}

export async function addMemberWith(prisma: Client, orgId: string, email: string, role: "ADMIN" | "STAFF" | "OWNER") {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!user) throw new StudioError("There's no EVENT HUB account with that email yet. Ask them to sign up first.", "email");
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    create: { organizationId: orgId, userId: user.id, role },
    update: { role },
  });
}

/** Removes a member or changes a role, but never leaves an organization without an owner. */
export async function setMemberRoleWith(prisma: Client, orgId: string, userId: string, role: "OWNER" | "ADMIN" | "STAFF" | null) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId } } });
    if (!current) throw new StudioError("That person isn't on the team.");
    if (current.role === "OWNER" && role !== "OWNER") {
      const owners = await tx.organizationMember.count({ where: { organizationId: orgId, role: "OWNER" } });
      if (owners <= 1) throw new StudioError("An organization needs at least one owner. Make someone else an owner first.");
    }
    if (role) await tx.organizationMember.update({ where: { organizationId_userId: { organizationId: orgId, userId } }, data: { role } });
    else await tx.organizationMember.delete({ where: { organizationId_userId: { organizationId: orgId, userId } } });
  });
}

// ── Events ───────────────────────────────────────────────────────────────

export type TicketTypeInput = {
  id?: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  quantityTotal: number;
  maxPerOrder: number;
};

export type EventInput = {
  title: string;
  categoryId: string;
  summary: string;
  description: string;
  format: "IN_PERSON" | "ONLINE" | "HYBRID";
  onlineUrl?: string | null;
  startsLocal: string; // "2026-12-14T20:00" in `timezone`
  endsLocal: string;
  timezone: string;
  currency: string;
  visibility: "PUBLIC" | "UNLISTED";
  ageRestriction?: number | null;
  refundPolicy?: string | null;
  venueId?: string | null;
  newVenue?: { name: string; addressLine1: string; city: string; region?: string | null; postalCode?: string | null; countryCode: string; latitude?: number | null; longitude?: number | null } | null;
  ticketTypes: TicketTypeInput[];
};

function times(input: EventInput) {
  const startsAt = zonedLocalToUtc(input.startsLocal, input.timezone);
  const endsAt = zonedLocalToUtc(input.endsLocal, input.timezone);
  if (!startsAt) throw new StudioError("Enter when the event starts.", "startsLocal");
  if (!endsAt) throw new StudioError("Enter when the event ends.", "endsLocal");
  if (endsAt <= startsAt) throw new StudioError("The end must be after the start.", "endsLocal");
  return { startsAt, endsAt };
}

function priceSummary(types: { priceMinor: number; status: string }[]) {
  const live = types.filter((t) => t.status !== "HIDDEN");
  const prices = live.map((t) => t.priceMinor);
  return {
    minPriceMinor: prices.length ? Math.min(...prices) : null,
    isFree: prices.length > 0 && prices.every((p) => p === 0),
  };
}

async function resolveVenue(tx: Parameters<Parameters<Client["$transaction"]>[0]>[0], orgId: string, input: EventInput) {
  if (input.format === "ONLINE") return null;
  if (input.venueId) {
    const v = await tx.venue.findFirst({ where: { id: input.venueId, OR: [{ organizationId: orgId }, { events: { some: { organizationId: orgId } } }] } });
    if (!v) throw new StudioError("Choose one of your venues.", "venueId");
    return v.id;
  }
  const nv = input.newVenue;
  if (!nv?.name || !nv.addressLine1 || !nv.city || !nv.countryCode) throw new StudioError("Add the venue's name, address, city and country.", "venue");
  const v = await tx.venue.create({
    data: {
      id: randomUUID(),
      organizationId: orgId,
      name: nv.name.trim(),
      addressLine1: nv.addressLine1.trim(),
      city: nv.city.trim(),
      region: nv.region?.trim() || null,
      postalCode: nv.postalCode?.trim() || null,
      countryCode: nv.countryCode.trim().toUpperCase().slice(0, 2),
      latitude: nv.latitude ?? null,
      longitude: nv.longitude ?? null,
      timezone: input.timezone,
    },
  });
  return v.id;
}

function validateTickets(list: TicketTypeInput[]) {
  if (!list.length) throw new StudioError("Add at least one ticket type.", "tickets");
  for (const t of list) {
    if (!t.name.trim()) throw new StudioError("Every ticket type needs a name.", "tickets");
    if (!Number.isInteger(t.priceMinor) || t.priceMinor < 0) throw new StudioError(`Check the price of ${t.name}.`, "tickets");
    if (!Number.isInteger(t.quantityTotal) || t.quantityTotal < 1) throw new StudioError(`${t.name} needs at least 1 ticket available.`, "tickets");
    if (!Number.isInteger(t.maxPerOrder) || t.maxPerOrder < 1 || t.maxPerOrder > 50) throw new StudioError(`Per-order limit for ${t.name} must be 1 to 50.`, "tickets");
  }
}

/** Creates a DRAFT event with its ticket types (and a new venue if given). */
export async function createEventWith(prisma: Client, orgId: string, input: EventInput) {
  validateTickets(input.ticketTypes);
  const { startsAt, endsAt } = times(input);
  const slug = await uniqueSlug(async (s) => (await prisma.event.count({ where: { slug: s } })) > 0, input.title);
  return prisma.$transaction(async (tx) => {
    const venueId = await resolveVenue(tx, orgId, input);
    const id = randomUUID();
    const types = input.ticketTypes.map((t, i) => ({
      id: randomUUID(),
      name: t.name.trim(),
      description: t.description?.trim() || null,
      priceMinor: t.priceMinor,
      currency: input.currency,
      quantityTotal: t.quantityTotal,
      maxPerOrder: t.maxPerOrder,
      sortOrder: i,
      status: "ACTIVE" as const,
    }));
    return tx.event.create({
      data: {
        id,
        slug,
        organizationId: orgId,
        categoryId: input.categoryId,
        venueId,
        title: input.title.trim(),
        summary: input.summary.trim(),
        description: input.description.trim(),
        format: input.format,
        onlineUrl: input.format === "IN_PERSON" ? null : input.onlineUrl?.trim() || null,
        startsAt,
        endsAt,
        timezone: input.timezone,
        status: "DRAFT",
        visibility: input.visibility,
        ageRestriction: input.ageRestriction ?? null,
        refundPolicy: input.refundPolicy?.trim() || null,
        currency: input.currency,
        ...priceSummary(types),
        ticketTypes: { create: types },
      },
    });
  });
}

/**
 * Saves edits. Ticket types are reconciled: edited in place, new ones added,
 * removed ones deleted if nobody booked them or hidden if somebody did.
 * Capacity can't drop below what is already sold or held.
 */
export async function updateEventWith(prisma: Client, orgId: string, eventId: string, input: EventInput) {
  validateTickets(input.ticketTypes);
  const { startsAt, endsAt } = times(input);
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id: eventId, organizationId: orgId }, include: { ticketTypes: { include: { _count: { select: { bookingItems: true } } } } } });
    if (!event) throw new StudioError("Event not found.");
    if (event.status === "CANCELLED" || event.status === "COMPLETED") throw new StudioError("A cancelled or finished event can't be edited.");
    const venueId = await resolveVenue(tx, orgId, input);

    const keep = new Set(input.ticketTypes.map((t) => t.id).filter(Boolean));
    for (const old of event.ticketTypes) {
      if (keep.has(old.id)) continue;
      if (old.quantitySold + old.quantityHeld === 0 && old._count.bookingItems === 0) await tx.ticketType.delete({ where: { id: old.id } });
      else await tx.ticketType.update({ where: { id: old.id }, data: { status: "HIDDEN" } });
    }
    for (const [i, t] of input.ticketTypes.entries()) {
      const old = t.id ? event.ticketTypes.find((o) => o.id === t.id) : undefined;
      if (t.id && !old) throw new StudioError("A ticket type changed while you were editing. Reload and try again.", "tickets");
      const data = {
        name: t.name.trim(),
        description: t.description?.trim() || null,
        priceMinor: t.priceMinor,
        currency: input.currency,
        quantityTotal: t.quantityTotal,
        maxPerOrder: t.maxPerOrder,
        sortOrder: i,
      };
      if (old) {
        const taken = old.quantitySold + old.quantityHeld;
        if (t.quantityTotal < taken) throw new StudioError(`${old.name} already has ${taken} booked. Capacity can't go below that.`, "tickets");
        if (old.currency !== input.currency && taken > 0) throw new StudioError("The currency can't change once tickets are sold.", "currency");
        await tx.ticketType.update({ where: { id: old.id }, data: { ...data, status: old.status === "HIDDEN" ? "ACTIVE" : old.status } });
      } else {
        await tx.ticketType.create({ data: { id: randomUUID(), eventId, status: "ACTIVE", ...data } });
      }
    }
    const types = await tx.ticketType.findMany({ where: { eventId }, select: { priceMinor: true, status: true } });
    return tx.event.update({
      where: { id: eventId },
      data: {
        categoryId: input.categoryId,
        venueId,
        title: input.title.trim(),
        summary: input.summary.trim(),
        description: input.description.trim(),
        format: input.format,
        onlineUrl: input.format === "IN_PERSON" ? null : input.onlineUrl?.trim() || null,
        startsAt,
        endsAt,
        timezone: input.timezone,
        visibility: input.visibility,
        ageRestriction: input.ageRestriction ?? null,
        refundPolicy: input.refundPolicy?.trim() || null,
        currency: input.currency,
        ...priceSummary(types),
      },
    });
  });
}

/** What still stands between a draft and publishing. Empty = ready. */
export async function publishChecklistWith(prisma: Client, eventId: string, now = new Date()) {
  const e = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { images: { select: { id: true } }, ticketTypes: { where: { status: "ACTIVE" }, select: { id: true } } },
  });
  const missing: string[] = [];
  if (e.startsAt <= now) missing.push("Set a start time in the future.");
  if (!e.images.length) missing.push("Add at least one photo.");
  if (!e.ticketTypes.length) missing.push("Add at least one ticket type.");
  if (e.format !== "ONLINE" && !e.venueId) missing.push("Add the venue.");
  if (e.format !== "IN_PERSON" && !e.onlineUrl) missing.push("Add the link attendees use to join online.");
  if (e.summary.trim().length < 20) missing.push("Write a short summary (at least 20 characters).");
  return missing;
}

export async function publishEventWith(prisma: Client, orgId: string, eventId: string, now = new Date()) {
  const e = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId } });
  if (!e) throw new StudioError("Event not found.");
  if (e.status === "PUBLISHED") return e;
  if (e.status !== "DRAFT") throw new StudioError("Only drafts can be published.");
  const missing = await publishChecklistWith(prisma, eventId, now);
  if (missing.length) throw new StudioError(missing.join(" "));
  return prisma.event.update({ where: { id: eventId }, data: { status: "PUBLISHED", publishedAt: e.publishedAt ?? now } });
}

/** Back to draft: only while nobody has booked, so no ticket holder loses their event page. */
export async function unpublishEventWith(prisma: Client, orgId: string, eventId: string) {
  const e = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId }, include: { _count: { select: { bookings: true } } } });
  if (!e) throw new StudioError("Event not found.");
  if (e.status !== "PUBLISHED") throw new StudioError("Only published events can be moved back to draft.");
  if (e._count.bookings > 0) throw new StudioError("People have booked this event. Cancel it instead, so they're told and refunded.");
  return prisma.event.update({ where: { id: eventId }, data: { status: "DRAFT" } });
}

/** Marks the event cancelled. The caller then cancels its bookings (payments.cancelEventBookings) and emails attendees. */
export async function markEventCancelledWith(prisma: Client, orgId: string, eventId: string, reason: string | null, now = new Date()) {
  const e = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId } });
  if (!e) throw new StudioError("Event not found.");
  if (e.status === "CANCELLED") return e;
  if (e.status === "DRAFT") throw new StudioError("A draft isn't public yet. Delete it instead.");
  if (e.endsAt <= now) throw new StudioError("This event has already happened.");
  return prisma.event.update({ where: { id: eventId }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason?.trim() || null, featuredFrom: null, featuredUntil: null } });
}

export async function deleteDraftWith(prisma: Client, orgId: string, eventId: string) {
  const e = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId }, include: { _count: { select: { bookings: true } } } });
  if (!e) throw new StudioError("Event not found.");
  if (e.status !== "DRAFT" || e._count.bookings > 0) throw new StudioError("Only drafts without bookings can be deleted.");
  await prisma.event.delete({ where: { id: eventId } });
}

// ── Check-in ─────────────────────────────────────────────────────────────

export type CheckInResult =
  | { ok: true; name: string | null; ticketType: string; code: string; at: Date }
  | { ok: false; reason: "not-found" | "wrong-event" | "already" | "void" | "not-confirmed"; name?: string | null; at?: Date | null };

/**
 * Accepts what the scanner reads ("EVENTHUB:EH-XXXXXX:<token>") or a bare
 * token. One conditional update, so a ticket can't be admitted twice even
 * if two doors scan it at the same moment.
 */
export async function checkInWith(prisma: Client, eventId: string, scanned: string, staffUserId: string, now = new Date()): Promise<CheckInResult> {
  const token = scanned.trim().split(":").pop() ?? "";
  if (token.length < 16) return { ok: false, reason: "not-found" };
  const ticket = await prisma.ticket.findUnique({
    where: { qrToken: token },
    include: { booking: { select: { eventId: true, status: true, code: true } }, ticketType: { select: { name: true } } },
  });
  if (!ticket) return { ok: false, reason: "not-found" };
  if (ticket.booking.eventId !== eventId) return { ok: false, reason: "wrong-event" };
  if (ticket.status === "VOID" || ticket.booking.status !== "CONFIRMED") return { ok: false, reason: ticket.status === "VOID" ? "void" : "not-confirmed", name: ticket.attendeeName };
  const updated = await prisma.ticket.updateMany({ where: { id: ticket.id, status: "VALID" }, data: { status: "CHECKED_IN", checkedInAt: now, checkedInById: staffUserId } });
  if (updated.count !== 1) {
    const again = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { checkedInAt: true } });
    return { ok: false, reason: "already", name: ticket.attendeeName, at: again?.checkedInAt ?? null };
  }
  return { ok: true, name: ticket.attendeeName, ticketType: ticket.ticketType.name, code: ticket.booking.code, at: now };
}

// ── Reporting ────────────────────────────────────────────────────────────

export async function orgStatsWith(prisma: Client, orgId: string, now = new Date()) {
  const [upcoming, drafts, tickets, revenue, checkedIn] = await Promise.all([
    prisma.event.count({ where: { organizationId: orgId, status: "PUBLISHED", endsAt: { gt: now } } }),
    prisma.event.count({ where: { organizationId: orgId, status: "DRAFT" } }),
    prisma.ticket.count({ where: { status: { not: "VOID" }, booking: { status: "CONFIRMED", event: { organizationId: orgId } } } }),
    prisma.booking.groupBy({ by: ["currency"], where: { status: "CONFIRMED", event: { organizationId: orgId } }, _sum: { totalMinor: true } }),
    prisma.ticket.count({ where: { status: "CHECKED_IN", booking: { event: { organizationId: orgId } } } }),
  ]);
  return {
    upcoming,
    drafts,
    tickets,
    checkedIn,
    revenue: revenue.filter((r) => (r._sum.totalMinor ?? 0) > 0).map((r) => ({ currency: r.currency, amountMinor: r._sum.totalMinor ?? 0 })),
  };
}
