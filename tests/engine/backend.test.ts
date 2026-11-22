/**
 * Backend tests for Phase 4: permissions, accounts, the organizer studio,
 * card payments (holds, webhooks, refunds), check-in and notifications.
 * Runs against the real database (DATABASE_URL) with its own organization,
 * event and users, created fresh on each run.
 */
import "dotenv/config";
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { can, ACTIONS } from "../../src/server/permissions";
import { claimGuestBookingsWith, mergeFavoritesWith } from "../../src/server/accounts-core";
import { cancelBookingWith, createBookingWith, canAttendeeCancel } from "../../src/server/bookings-core";
import {
  addMemberWith,
  checkInWith,
  createEventWith,
  createOrganizationWith,
  markEventCancelledWith,
  publishChecklistWith,
  publishEventWith,
  setMemberRoleWith,
  StudioError,
  updateEventWith,
  type EventInput,
} from "../../src/server/studio-core";
import { cancelEventBookingsWith, expireStaleHoldsWith, handlePaymentEventWith, startCheckoutWith } from "../../src/server/payments-core";
import { TestProvider } from "../../src/server/providers/test";
import { sendBookingConfirmationWith, sendDueRemindersWith } from "../../src/server/notifications-core";
import type { Mail } from "../../src/server/mail";
import { zonedLocalToUtc } from "../../src/lib/timezone";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 10 }) });
after(() => prisma.$disconnect());

const run = randomUUID().slice(0, 8);
let ownerId = "";
let orgId = "";
let categoryId = "";

async function user(label: string, verified = true) {
  return prisma.user.create({ data: { id: randomUUID(), name: `Test ${label}`, email: `${label}.${run}@test.example`, emailVerified: verified } });
}

function local(daysAhead: number, hour = 19) {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
}

function eventInput(over: Partial<EventInput> = {}): EventInput {
  return {
    title: `Backend test night ${run}`,
    categoryId,
    summary: "A test event created by the backend test suite.",
    description: "Long enough description for the publish checklist and the form rules, written by the tests.",
    format: "IN_PERSON",
    startsLocal: local(10),
    endsLocal: local(10, 23),
    timezone: "Europe/Amsterdam",
    currency: "EUR",
    visibility: "PUBLIC",
    newVenue: { name: "Test Hall", addressLine1: "1 Test Street", city: "Amsterdam", countryCode: "NL" },
    ticketTypes: [
      { name: "Standing", priceMinor: 2500, quantityTotal: 5, maxPerOrder: 4 },
      { name: "Guest list", priceMinor: 0, quantityTotal: 3, maxPerOrder: 2 },
    ],
    ...over,
  };
}

async function publishedEvent(over: Partial<EventInput> = {}) {
  const e = await createEventWith(prisma, orgId, eventInput(over));
  await prisma.eventImage.create({ data: { id: randomUUID(), eventId: e.id, storageKey: "/media/test.webp", alt: "Test photo", width: 1600, height: 1000, sortOrder: 0 } });
  await publishEventWith(prisma, orgId, e.id);
  return prisma.event.findUniqueOrThrow({ where: { id: e.id }, include: { ticketTypes: { orderBy: { sortOrder: "asc" } } } });
}

before(async () => {
  categoryId = (await prisma.category.findFirstOrThrow()).id;
  const owner = await user("owner");
  ownerId = owner.id;
  orgId = (await createOrganizationWith(prisma, owner.id, { name: `Test Promoters ${run}`, type: "BUSINESS", contactEmail: owner.email })).id;
});

// ── Permissions ──────────────────────────────────────────────────────────

test("roles: staff work the door, admins run events, only owners manage the team", () => {
  assert.ok(can("STAFF", "tickets:checkin"));
  assert.ok(can("STAFF", "attendees:view"));
  assert.ok(!can("STAFF", "event:edit"));
  assert.ok(!can("STAFF", "attendees:export"));
  assert.ok(can("ADMIN", "event:publish"));
  assert.ok(!can("ADMIN", "members:manage"));
  assert.ok(!can("ADMIN", "payouts:manage"));
  for (const a of ACTIONS) assert.ok(can("OWNER", a), a);
  assert.ok(!can(null, "stats:view"));
  assert.ok(can(null, "members:manage", "ADMIN"), "platform admins can act for support");
});

test("team: members are added by account email and the last owner can't leave", async () => {
  const helper = await user("helper");
  await addMemberWith(prisma, orgId, helper.email.toUpperCase(), "STAFF");
  const m = await prisma.organizationMember.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: orgId, userId: helper.id } } });
  assert.equal(m.role, "STAFF");
  await assert.rejects(addMemberWith(prisma, orgId, `nobody.${run}@test.example`, "ADMIN"), StudioError);
  await assert.rejects(setMemberRoleWith(prisma, orgId, ownerId, "ADMIN"), /at least one owner/);
  await setMemberRoleWith(prisma, orgId, helper.id, null);
  assert.equal(await prisma.organizationMember.count({ where: { organizationId: orgId, userId: helper.id } }), 0);
});

// ── Accounts ─────────────────────────────────────────────────────────────

test("guest bookings move into the account that verifies the same email", async () => {
  const e = await publishedEvent();
  const email = `claim.${run}@test.example`;
  const guest = await createBookingWith(prisma, { eventId: e.id, items: [{ ticketTypeId: e.ticketTypes[1].id, quantity: 1 }], contactName: "Guest", contactEmail: email.toUpperCase() });
  assert.equal(guest.userId, null);
  const u = await prisma.user.create({ data: { id: randomUUID(), name: "Claimer", email, emailVerified: true } });
  assert.equal(await claimGuestBookingsWith(prisma, u.id, email), 1);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: guest.id } })).userId, u.id);
  assert.equal(await claimGuestBookingsWith(prisma, u.id, email), 0, "claiming twice moves nothing");
});

test("device saves merge into favorites without duplicates or unknown ids", async () => {
  const e = await publishedEvent();
  const u = await user("saver");
  await prisma.favorite.create({ data: { userId: u.id, eventId: e.id } });
  const added = await mergeFavoritesWith(prisma, u.id, [e.id, e.id, "not-an-event"]);
  assert.equal(added, 0);
  assert.equal(await prisma.favorite.count({ where: { userId: u.id } }), 1);
});

// ── Studio ───────────────────────────────────────────────────────────────

test("event times are stored in UTC from the venue's local time", async () => {
  const e = await createEventWith(prisma, orgId, eventInput({ startsLocal: "2027-07-01T20:00", endsLocal: "2027-07-01T23:00" }));
  assert.equal(e.startsAt.toISOString(), "2027-07-01T18:00:00.000Z");
  assert.equal(e.status, "DRAFT");
  assert.equal(e.minPriceMinor, 0);
  assert.equal(e.isFree, false);
  await assert.rejects(createEventWith(prisma, orgId, eventInput({ startsLocal: local(5, 20), endsLocal: local(5, 18) })), /end must be after/);
  assert.equal(zonedLocalToUtc("2027-01-10T09:00", "Asia/Yerevan")!.toISOString(), "2027-01-10T05:00:00.000Z");
});

test("a draft can't be published until it has a photo", async () => {
  const e = await createEventWith(prisma, orgId, eventInput());
  assert.deepEqual(await publishChecklistWith(prisma, e.id), ["Add at least one photo."]);
  await assert.rejects(publishEventWith(prisma, orgId, e.id), /photo/);
});

test("ticket edits respect what's already booked", async () => {
  const e = await publishedEvent();
  const [standing, guest] = e.ticketTypes;
  await createBookingWith(prisma, { eventId: e.id, items: [{ ticketTypeId: standing.id, quantity: 3 }], contactName: "Booked", contactEmail: `b.${run}@test.example` });
  const base = eventInput();
  // Capacity below the 3 already sold is refused.
  await assert.rejects(
    updateEventWith(prisma, orgId, e.id, { ...base, venueId: e.venueId, newVenue: null, ticketTypes: [{ id: standing.id, name: "Standing", priceMinor: 2500, quantityTotal: 2, maxPerOrder: 4 }] }),
    /already has 3 booked/,
  );
  // Dropping a sold type hides it; dropping an unsold one deletes it; new ones are added.
  await updateEventWith(prisma, orgId, e.id, {
    ...base,
    venueId: e.venueId,
    newVenue: null,
    ticketTypes: [{ name: "VIP", priceMinor: 6000, quantityTotal: 10, maxPerOrder: 2 }],
  });
  const types = await prisma.ticketType.findMany({ where: { eventId: e.id } });
  assert.equal(types.find((t) => t.id === standing.id)?.status, "HIDDEN");
  assert.equal(types.find((t) => t.id === guest.id), undefined);
  assert.ok(types.find((t) => t.name === "VIP" && t.status === "ACTIVE"));
  assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: e.id } })).minPriceMinor, 6000);
});

test("check-in admits a ticket once, even when two doors scan it together", async () => {
  const e = await publishedEvent();
  const b = await createBookingWith(prisma, { eventId: e.id, items: [{ ticketTypeId: e.ticketTypes[1].id, quantity: 1 }], contactName: "Door Test", contactEmail: `door.${run}@test.example` });
  const t = await prisma.ticket.findFirstOrThrow({ where: { bookingId: b.id } });
  const scans = await Promise.all([1, 2, 3].map(() => checkInWith(prisma, e.id, `EVENTHUB:${b.code}:${t.qrToken}`, ownerId)));
  assert.equal(scans.filter((s) => s.ok).length, 1);
  assert.ok(scans.filter((s) => !s.ok).every((s) => !s.ok && s.reason === "already"));
  const other = await publishedEvent();
  const wrong = await checkInWith(prisma, other.id, t.qrToken, ownerId);
  assert.deepEqual(wrong, { ok: false, reason: "wrong-event" });
  assert.deepEqual(await checkInWith(prisma, e.id, "EVENTHUB:EH-XXXXXX:short", ownerId), { ok: false, reason: "not-found" });
});

test("attendees can cancel until 24 hours before; seats go back and tickets stop working", async () => {
  const e = await publishedEvent();
  const tt = e.ticketTypes[0];
  const b = await createBookingWith(prisma, { eventId: e.id, items: [{ ticketTypeId: tt.id, quantity: 2 }], contactName: "Canceller", contactEmail: `c.${run}@test.example` });
  const full = await prisma.booking.findUniqueOrThrow({ where: { id: b.id }, include: { event: true } });
  assert.ok(canAttendeeCancel(full));
  assert.ok(!canAttendeeCancel(full, new Date(full.event.startsAt.getTime() - 3600_000)));
  const [x, y] = await Promise.all([cancelBookingWith(prisma, b.id), cancelBookingWith(prisma, b.id)]);
  assert.ok(Boolean(x) !== Boolean(y), "exactly one cancel wins");
  assert.equal((await prisma.ticketType.findUniqueOrThrow({ where: { id: tt.id } })).quantitySold, 0);
  assert.equal(await prisma.ticket.count({ where: { bookingId: b.id, status: "VOID" } }), 2);
});

// ── Payments ─────────────────────────────────────────────────────────────

async function heldBooking(e: Awaited<ReturnType<typeof publishedEvent>>, provider: TestProvider, quantity = 2, holdMs = 30 * 60_000) {
  const tt = e.ticketTypes[0];
  const b = await createBookingWith(prisma, {
    eventId: e.id,
    items: [{ ticketTypeId: tt.id, quantity }],
    contactName: "Card Buyer",
    contactEmail: `card.${run}@test.example`,
    holdUntil: new Date(Date.now() + holdMs),
  });
  const session = await startCheckoutWith(prisma, provider, {
    bookingId: b.id,
    bookingCode: b.code,
    currency: "EUR",
    customerEmail: b.contactEmail,
    description: "test",
    lines: [{ name: tt.name, unitAmountMinor: tt.priceMinor, quantity }],
    expiresAt: b.holdExpiresAt!,
    successUrl: "/ok",
    cancelUrl: "/no",
  });
  return { b, tt, ref: session.ref };
}

test("card payment: seats are held, then sold and ticketed when the webhook confirms, exactly once", async () => {
  const provider = new TestProvider();
  const e = await publishedEvent();
  const { b, tt, ref } = await heldBooking(e, provider);
  let t = await prisma.ticketType.findUniqueOrThrow({ where: { id: tt.id } });
  assert.deepEqual([t.quantityHeld, t.quantitySold], [2, 0]);
  assert.equal(await prisma.ticket.count({ where: { bookingId: b.id } }), 0);

  const confirmed: string[] = [];
  const event = { id: `evt_${randomUUID()}`, kind: "completed" as const, checkoutRef: ref, bookingId: b.id, amountMinor: 5000 };
  assert.equal(await handlePaymentEventWith(prisma, provider, event, { onConfirmed: (id) => void confirmed.push(id) }), "confirmed");
  assert.equal(await handlePaymentEventWith(prisma, provider, event, { onConfirmed: (id) => void confirmed.push(id) }), "duplicate");
  assert.deepEqual(confirmed, [b.id]);

  t = await prisma.ticketType.findUniqueOrThrow({ where: { id: tt.id } });
  assert.deepEqual([t.quantityHeld, t.quantitySold], [0, 2]);
  assert.equal(await prisma.ticket.count({ where: { bookingId: b.id } }), 2);
  const p = await prisma.payment.findUniqueOrThrow({ where: { providerPaymentRef: ref } });
  assert.equal(p.status, "SUCCEEDED");
  assert.equal(p.platformFeeMinor, Math.round((5000 * Number(process.env.PLATFORM_FEE_BPS ?? 0)) / 10_000));
});

test("card payment: an abandoned checkout's seats go back on sale", async () => {
  const provider = new TestProvider();
  const e = await publishedEvent();
  const { b, tt, ref } = await heldBooking(e, provider, 2, -60_000); // hold already lapsed
  const swept = await expireStaleHoldsWith(prisma, provider);
  assert.ok(swept.expired >= 1);
  assert.ok(provider.closed.has(ref), "the checkout is closed before seats are released");
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status, "EXPIRED");
  assert.equal((await prisma.ticketType.findUniqueOrThrow({ where: { id: tt.id } })).quantityHeld, 0);
});

test("card payment: paid after the seats were resold → refunded automatically", async () => {
  const provider = new TestProvider();
  const e = await publishedEvent();
  const { b, tt, ref } = await heldBooking(e, provider, 4, -60_000);
  // Hold lapses (the sweep didn't reach the provider in time) and someone else buys the seats.
  await prisma.payment.updateMany({ where: { providerPaymentRef: ref }, data: { status: "REQUIRES_ACTION" } });
  await expireStaleHoldsWith(prisma, null);
  await createBookingWith(prisma, { eventId: e.id, items: [{ ticketTypeId: tt.id, quantity: 4 }], contactName: "Faster", contactEmail: `fast.${run}@test.example` });
  const res = await handlePaymentEventWith(prisma, provider, { id: `evt_${randomUUID()}`, kind: "completed", checkoutRef: ref, bookingId: b.id, amountMinor: 10_000 });
  assert.equal(res, "refunded-unavailable");
  assert.deepEqual(provider.refunds, [{ ref, amountMinor: 10_000 }]);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status, "REFUNDED");
  const t = await prisma.ticketType.findUniqueOrThrow({ where: { id: tt.id } });
  assert.ok(t.quantitySold <= t.quantityTotal);
});

test("cancelling an event cancels every booking and refunds card payments", async () => {
  const provider = new TestProvider();
  const e = await publishedEvent();
  const free = await createBookingWith(prisma, { eventId: e.id, items: [{ ticketTypeId: e.ticketTypes[1].id, quantity: 1 }], contactName: "Free", contactEmail: `free.${run}@test.example` });
  const { b: paid, ref } = await heldBooking(e, provider, 1);
  await handlePaymentEventWith(prisma, provider, { id: `evt_${randomUUID()}`, kind: "completed", checkoutRef: ref, bookingId: paid.id, amountMinor: 2500 });
  await markEventCancelledWith(prisma, orgId, e.id, "Venue flooded");
  const done = await cancelEventBookingsWith(prisma, provider, e.id);
  assert.deepEqual(new Set(done.map((d) => `${d.bookingId}:${d.refunded}`)), new Set([`${free.id}:false`, `${paid.id}:true`]));
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: paid.id } })).status, "REFUNDED");
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: free.id } })).status, "CANCELLED");
  assert.equal(provider.refunds.length, 1);
  assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: e.id } })).status, "CANCELLED");
});

// ── Notifications ────────────────────────────────────────────────────────

test("each email is sent once, and a failed send is retried later", async () => {
  const e = await publishedEvent({ startsLocal: local(1, 12), endsLocal: local(1, 14) });
  const b = await createBookingWith(prisma, { eventId: e.id, items: [{ ticketTypeId: e.ticketTypes[1].id, quantity: 1 }], contactName: "Mail Test", contactEmail: `mail.${run}@test.example` }, new Date(Date.now() - 3600_000));
  const sent: Mail[] = [];
  const ok = async (m: Mail) => void sent.push(m);
  const broken = async () => {
    throw new Error("smtp down");
  };

  await assert.rejects(sendBookingConfirmationWith(prisma, broken, b.id), /smtp down/);
  assert.equal(await sendBookingConfirmationWith(prisma, ok, b.id), true, "retry after failure sends");
  assert.equal(await sendBookingConfirmationWith(prisma, ok, b.id), false, "second call is a no-op");
  assert.equal(sent.filter((m) => m.tag === "booking-confirmed").length, 1);
  assert.match(sent[0].text, /View your tickets: http.+\/bookings\/EH-/);

  // Starts in roughly a day: the day-before reminder is due, once, whatever the run frequency.
  const startsAt = (await prisma.event.findUniqueOrThrow({ where: { id: e.id } })).startsAt;
  const now = new Date(startsAt.getTime() - 20 * 3600_000);
  await sendDueRemindersWith(prisma, ok, now);
  await sendDueRemindersWith(prisma, ok, now);
  assert.equal(sent.filter((m) => m.tag === "reminder-24h" && m.to === b.contactEmail).length, 1);
  const log = await prisma.notificationLog.findMany({ where: { bookingId: b.id } });
  assert.deepEqual(log.map((l) => l.type).sort(), ["BOOKING_CONFIRMATION", "REMINDER_24H"]);
  assert.ok(log.every((l) => l.recipient === b.contactEmail && l.userId === null));
});
