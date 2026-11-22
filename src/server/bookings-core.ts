/**
 * Booking engine. Pure data logic with the Prisma client passed in, so the
 * app (src/server/bookings.ts) and the seed script share one code path.
 *
 * Inventory safety: each ticket type is decremented with ONE conditional
 * UPDATE inside a transaction ("only if enough remain"), backed by the
 * database CHECK sold + held <= total. Two buyers can never both get the
 * last seat.
 *
 * Two ways in:
 * - Free tickets, and paid tickets when card payments are off: the booking is
 *   CONFIRMED at once (paid ones are paid at the venue).
 * - Paid tickets with card payments on: the seats are HELD (quantityHeld)
 *   and the booking is PENDING until the payment provider confirms; see
 *   confirmHeldBookingWith and expireHeldBookingWith.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

type Client = InstanceType<typeof PrismaClient>;

export type BookingInput = {
  eventId: string;
  /** Signed-in buyer. Omitted for guests: the booking is later claimed by a verified account with the same email. */
  userId?: string | null;
  items: { ticketTypeId: string; quantity: number }[];
  contactName: string;
  contactEmail: string;
  idempotencyKey?: string;
  /** Hold the seats until this time instead of confirming (card payment pending). */
  holdUntil?: Date;
};

export class BookingError extends Error {
  constructor(
    public code: "NOT_FOUND" | "NOT_ON_SALE" | "SOLD_OUT" | "INVALID",
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
function bookingCode() {
  const bytes = randomBytes(6);
  return "EH-" + Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export async function createBookingWith(prisma: Client, input: BookingInput, now = new Date()) {
  const email = input.contactEmail.trim().toLowerCase();
  const name = input.contactName.trim();
  const items = input.items.filter((i) => i.quantity > 0);
  if (!items.length) throw new BookingError("INVALID", "Choose at least one ticket.", "items");

  if (input.idempotencyKey) {
    const existing = await prisma.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      include: { ticketTypes: true },
    });
    if (!event || event.status !== "PUBLISHED") throw new BookingError("NOT_FOUND", "This event is not available.");
    if (event.startsAt <= now) throw new BookingError("NOT_ON_SALE", "This event has already started.");

    let subtotal = 0;
    const lines: { ticketTypeId: string; quantity: number; unitPriceMinor: number }[] = [];
    for (const item of items) {
      const tt = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
      if (!tt || tt.status !== "ACTIVE") throw new BookingError("INVALID", "That ticket type is not available.", "items");
      if (tt.salesStartAt && tt.salesStartAt > now) throw new BookingError("NOT_ON_SALE", `${tt.name} tickets are not on sale yet.`);
      if (tt.salesEndAt && tt.salesEndAt < now) throw new BookingError("NOT_ON_SALE", `${tt.name} sales have ended.`);
      if (item.quantity < tt.minPerOrder || item.quantity > tt.maxPerOrder) {
        throw new BookingError("INVALID", `You can book ${tt.minPerOrder} to ${tt.maxPerOrder} ${tt.name} tickets.`, "items");
      }
      const updated = await takeSeats(tx, tt.id, item.quantity, input.holdUntil ? "held" : "sold");
      if (updated !== 1) {
        throw new BookingError("SOLD_OUT", `Not enough ${tt.name} tickets left. Try a smaller quantity.`, "items");
      }
      subtotal += tt.priceMinor * item.quantity;
      lines.push({ ticketTypeId: tt.id, quantity: item.quantity, unitPriceMinor: tt.priceMinor });
    }

    const held = Boolean(input.holdUntil);
    const booking = await tx.booking.create({
      data: {
        id: randomUUID(),
        code: bookingCode(),
        userId: input.userId ?? null,
        eventId: event.id,
        status: held ? "PENDING" : "CONFIRMED",
        subtotalMinor: subtotal,
        feeMinor: 0,
        totalMinor: subtotal,
        currency: event.currency ?? event.ticketTypes[0]?.currency ?? "USD",
        contactName: name,
        contactEmail: email,
        confirmedAt: held ? null : now,
        holdExpiresAt: input.holdUntil ?? null,
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
        updatedAt: now,
        items: { create: lines.map((l) => ({ id: randomUUID(), ...l })) },
      },
    });

    if (!held) await issueTickets(tx, booking, lines, now);
    return booking;
  });
}

type Tx = Parameters<Parameters<Client["$transaction"]>[0]>[0];

/** One conditional UPDATE: succeeds only if enough seats remain. Returns rows changed (1 or 0). */
function takeSeats(tx: Tx, ticketTypeId: string, quantity: number, as: "sold" | "held") {
  return as === "sold"
    ? tx.$executeRaw`
        UPDATE "ticket_types" SET "quantitySold" = "quantitySold" + ${quantity}, "updatedAt" = now()
         WHERE "id" = ${ticketTypeId} AND "quantitySold" + "quantityHeld" + ${quantity} <= "quantityTotal"`
    : tx.$executeRaw`
        UPDATE "ticket_types" SET "quantityHeld" = "quantityHeld" + ${quantity}, "updatedAt" = now()
         WHERE "id" = ${ticketTypeId} AND "quantitySold" + "quantityHeld" + ${quantity} <= "quantityTotal"`;
}

async function issueTickets(
  tx: Tx,
  booking: { id: string; contactName: string; contactEmail: string },
  lines: { ticketTypeId: string; quantity: number }[],
  now: Date,
) {
  await tx.ticket.createMany({
    data: lines.flatMap((l) =>
      Array.from({ length: l.quantity }, () => ({
        id: randomUUID(),
        bookingId: booking.id,
        ticketTypeId: l.ticketTypeId,
        attendeeName: booking.contactName,
        attendeeEmail: booking.contactEmail,
        qrToken: randomBytes(24).toString("base64url"),
        createdAt: now,
      })),
    ),
  });
}

export type ConfirmResult =
  | { outcome: "confirmed"; bookingId: string }
  | { outcome: "already-confirmed"; bookingId: string }
  | { outcome: "unavailable"; bookingId: string } // paid after the hold lapsed and the seats were resold
  | { outcome: "not-found" };

/**
 * Payment succeeded: held seats become sold seats and tickets are issued.
 * Idempotent. If the hold had already lapsed (EXPIRED), the seats are taken
 * again if still free; otherwise the result is "unavailable" and the caller
 * refunds the payment.
 */
export async function confirmHeldBookingWith(prisma: Client, bookingId: string, now = new Date()): Promise<ConfirmResult> {
  return prisma.$transaction(async (tx): Promise<ConfirmResult> => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) return { outcome: "not-found" };
    if (booking.status === "CONFIRMED") return { outcome: "already-confirmed", bookingId };

    if (booking.status === "PENDING") {
      const flipped = await tx.booking.updateMany({
        where: { id: booking.id, status: "PENDING" },
        data: { status: "CONFIRMED", confirmedAt: now, holdExpiresAt: null },
      });
      if (flipped.count !== 1) return { outcome: "already-confirmed", bookingId };
      for (const item of booking.items) {
        await tx.$executeRaw`
          UPDATE "ticket_types"
             SET "quantityHeld" = "quantityHeld" - ${item.quantity}, "quantitySold" = "quantitySold" + ${item.quantity}, "updatedAt" = now()
           WHERE "id" = ${item.ticketTypeId}`;
      }
      await issueTickets(tx, booking, booking.items, now);
      return { outcome: "confirmed", bookingId };
    }

    if (booking.status === "EXPIRED") {
      for (const item of booking.items) {
        if ((await takeSeats(tx, item.ticketTypeId, item.quantity, "sold")) !== 1) {
          throw new SeatsGone(bookingId); // rolls back any seats taken above
        }
      }
      await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", confirmedAt: now, holdExpiresAt: null } });
      await issueTickets(tx, booking, booking.items, now);
      return { outcome: "confirmed", bookingId };
    }

    return { outcome: "unavailable", bookingId }; // CANCELLED or REFUNDED
  }).catch((e) => {
    if (e instanceof SeatsGone) return { outcome: "unavailable", bookingId } as const;
    throw e;
  });
}

class SeatsGone extends Error {
  constructor(public bookingId: string) {
    super("seats gone");
  }
}

/** The hold lapsed or the buyer abandoned checkout: release the seats. Idempotent. */
export async function expireHeldBookingWith(prisma: Client, bookingId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking || booking.status !== "PENDING") return false;
    const flipped = await tx.booking.updateMany({
      where: { id: booking.id, status: "PENDING" },
      data: { status: "EXPIRED", holdExpiresAt: null, updatedAt: now },
    });
    if (flipped.count !== 1) return false;
    for (const item of booking.items) {
      await tx.$executeRaw`UPDATE "ticket_types" SET "quantityHeld" = GREATEST("quantityHeld" - ${item.quantity}, 0), "updatedAt" = now() WHERE "id" = ${item.ticketTypeId}`;
    }
    return true;
  });
}

/**
 * Cancels a booking: tickets stop working and the seats go back on sale, in
 * one transaction. Only CONFIRMED or PENDING bookings can be cancelled; the
 * call is a no-op (returns null) for anything else, so retries are safe.
 * Refunds are the caller's job (payments.ts), after this commits.
 */
export async function cancelBookingWith(prisma: Client, bookingId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking || (booking.status !== "CONFIRMED" && booking.status !== "PENDING")) return null;

    // Guard on the status we read, so two concurrent cancels release the seats once.
    const flipped = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status: "CANCELLED", cancelledAt: now, holdExpiresAt: null },
    });
    if (flipped.count !== 1) return null;

    const column = booking.status === "CONFIRMED" ? "quantitySold" : "quantityHeld";
    for (const item of booking.items) {
      if (column === "quantitySold") {
        await tx.$executeRaw`UPDATE "ticket_types" SET "quantitySold" = GREATEST("quantitySold" - ${item.quantity}, 0), "updatedAt" = now() WHERE "id" = ${item.ticketTypeId}`;
      } else {
        await tx.$executeRaw`UPDATE "ticket_types" SET "quantityHeld" = GREATEST("quantityHeld" - ${item.quantity}, 0), "updatedAt" = now() WHERE "id" = ${item.ticketTypeId}`;
      }
    }
    await tx.ticket.updateMany({ where: { bookingId: booking.id, status: "VALID" }, data: { status: "VOID" } });
    return { ...booking, status: "CANCELLED" as const, cancelledAt: now };
  });
}

/** How long before the start an attendee may still cancel online. */
export const CANCEL_CUTOFF_HOURS = 24;

export function canAttendeeCancel(b: { status: string; event: { startsAt: Date; status: string } }, now = new Date()) {
  if (b.status !== "CONFIRMED") return false;
  if (b.event.status !== "PUBLISHED") return false;
  return b.event.startsAt.getTime() - now.getTime() > CANCEL_CUTOFF_HOURS * 3600_000;
}
