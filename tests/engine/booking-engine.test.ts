/**
 * Booking engine tests against a real PostgreSQL database (DATABASE_URL).
 * Run: npm run test:engine   (uses the seeded demo data; restores what it changes)
 */
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createBookingWith, BookingError } from "../../src/server/bookings-core";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 20 }) });
after(() => prisma.$disconnect());

async function freshTicketType(remaining: number, maxPerOrder = 10) {
  const tt = await prisma.ticketType.findFirstOrThrow({ where: { name: "Front table" } });
  await prisma.ticketType.update({ where: { id: tt.id }, data: { quantitySold: tt.quantityTotal - remaining, quantityHeld: 0, maxPerOrder } });
  return tt;
}

test("never oversells under concurrency", async () => {
  const tt = await freshTicketType(8);
  const results = await Promise.allSettled(
    Array.from({ length: 40 }, (_, i) =>
      createBookingWith(prisma, { eventId: tt.eventId, items: [{ ticketTypeId: tt.id, quantity: 1 }], contactName: `Racer ${i}`, contactEmail: `race${i}@test.example` }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 8);
  const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: tt.id } });
  assert.equal(after.quantitySold, after.quantityTotal);
});

test("rejects quantities above the per-order limit", async () => {
  const tt = await freshTicketType(20, 4);
  await assert.rejects(
    createBookingWith(prisma, { eventId: tt.eventId, items: [{ ticketTypeId: tt.id, quantity: 5 }], contactName: "Too Many", contactEmail: "many@test.example" }),
    (e: unknown) => e instanceof BookingError && e.code === "INVALID",
  );
});

test("idempotency key returns the same booking", async () => {
  const tt = await freshTicketType(20);
  const key = `idem-${Date.now()}-abcdefgh`;
  const input = { eventId: tt.eventId, items: [{ ticketTypeId: tt.id, quantity: 1 }], contactName: "Twice", contactEmail: "twice@test.example", idempotencyKey: key };
  const a = await createBookingWith(prisma, input);
  const b = await createBookingWith(prisma, input);
  assert.equal(a.id, b.id);
});

test("issues one ticket per admission with unique QR tokens", async () => {
  const tt = await freshTicketType(20);
  const b = await createBookingWith(prisma, { eventId: tt.eventId, items: [{ ticketTypeId: tt.id, quantity: 3 }], contactName: "Group", contactEmail: "group@test.example" });
  const tickets = await prisma.ticket.findMany({ where: { bookingId: b.id } });
  assert.equal(tickets.length, 3);
  assert.equal(new Set(tickets.map((t) => t.qrToken)).size, 3);
});
