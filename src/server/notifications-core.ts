/**
 * Booking emails, sent at most once each.
 *
 * Every message is recorded in notification_logs, unique on
 * (booking, type, channel). The row is written first; if sending fails the
 * row is removed again so a later retry (or the next cron run) tries again.
 * A retry after success finds the row and sends nothing.
 *
 * Prisma client and mailer are passed in so tests can run this directly.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";
import {
  bookingCancelledMail,
  bookingConfirmedMail,
  eventCancelledMail,
  reminderMail,
  type BookingMailData,
} from "./emails";
import type { Mail } from "./mail";
import { cityTimeZoneNote, formatMoney, longDate, plural, timeRange } from "@/lib/format";

type Client = InstanceType<typeof PrismaClient>;
type Mailer = (mail: Mail) => Promise<unknown>;

async function mailData(prisma: Client, bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      event: { include: { venue: true } },
      items: { include: { ticketType: { select: { name: true } } } },
      payments: { where: { status: "SUCCEEDED" }, select: { id: true } },
    },
  });
  if (!b) return null;
  const tz = b.event.timezone;
  const count = b.items.reduce((n, i) => n + i.quantity, 0);
  const kinds = b.items.map((i) => `${i.quantity} × ${i.ticketType.name}`).join(", ");
  const paidOnline = b.payments.length > 0;
  const data: BookingMailData = {
    code: b.code,
    contactName: b.contactName,
    contactEmail: b.contactEmail,
    eventTitle: b.event.title,
    when: `${longDate(b.event.startsAt, tz)}, ${timeRange(b.event.startsAt, b.event.endsAt, tz)} (${cityTimeZoneNote(tz)})`,
    where: b.event.venue ? `${b.event.venue.name}, ${b.event.venue.addressLine1}, ${b.event.venue.city}` : "Online: the link is on your ticket page",
    ticketsLine: `${plural(count, "ticket")} (${kinds})`,
    amountLine:
      b.totalMinor === 0
        ? "These tickets are free."
        : paidOnline
          ? `Paid: ${formatMoney(b.totalMinor, b.currency)}.`
          : `${formatMoney(b.totalMinor, b.currency)} is due at the venue.`,
  };
  return { booking: b, data, paidOnline };
}

async function once(prisma: Client, mailer: Mailer, booking: { id: string; userId: string | null; contactEmail: string }, type: NotificationType, mail: Mail) {
  try {
    await prisma.notificationLog.create({
      data: { id: randomUUID(), bookingId: booking.id, userId: booking.userId, type, channel: "email", recipient: mail.to },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false; // already sent
    throw e;
  }
  try {
    await mailer(mail);
    return true;
  } catch (e) {
    await prisma.notificationLog.deleteMany({ where: { bookingId: booking.id, type, channel: "email" } });
    throw e;
  }
}

export async function sendBookingConfirmationWith(prisma: Client, mailer: Mailer, bookingId: string) {
  const m = await mailData(prisma, bookingId);
  if (!m || m.booking.status !== "CONFIRMED") return false;
  return once(prisma, mailer, m.booking, "BOOKING_CONFIRMATION", bookingConfirmedMail(m.data));
}

export async function sendBookingCancelledWith(prisma: Client, mailer: Mailer, bookingId: string, refunded: boolean) {
  const m = await mailData(prisma, bookingId);
  if (!m) return false;
  return once(prisma, mailer, m.booking, "BOOKING_CANCELLED", bookingCancelledMail(m.data, refunded));
}

export async function sendEventCancelledWith(prisma: Client, mailer: Mailer, bookingId: string, reason: string | null, refunded: boolean) {
  const m = await mailData(prisma, bookingId);
  if (!m) return false;
  return once(prisma, mailer, m.booking, "EVENT_CANCELLED", eventCancelledMail(m.data, reason, refunded));
}

/**
 * Reminders for confirmed bookings: one about a day before (sent when the
 * event is 2 to 26 hours away) and one about two hours before (sent when it is
 * under 2 hours away and not yet started). Safe to run as often as you like.
 */
export async function sendDueRemindersWith(prisma: Client, mailer: Mailer, now = new Date()) {
  const h = 3600_000;
  const windows: { type: NotificationType; from: number; to: number; kind: "24h" | "2h" }[] = [
    { type: "REMINDER_24H", from: 2 * h, to: 26 * h, kind: "24h" },
    { type: "REMINDER_2H", from: 0, to: 2 * h, kind: "2h" },
  ];
  let sent = 0;
  const failures: string[] = [];
  for (const w of windows) {
    const due = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        event: { status: "PUBLISHED", startsAt: { gt: new Date(now.getTime() + w.from), lte: new Date(now.getTime() + w.to) } },
        notifications: { none: { type: w.type, channel: "email" } },
        // A booking made inside the window gets the confirmation, not a reminder straight after it.
        createdAt: { lt: new Date(now.getTime() - 10 * 60_000) },
      },
      select: { id: true },
      take: 500,
    });
    for (const { id } of due) {
      try {
        const m = await mailData(prisma, id);
        if (m && (await once(prisma, mailer, m.booking, w.type, reminderMail(m.data, w.kind)))) sent++;
      } catch (e) {
        failures.push(`${id}: ${(e as Error).message}`);
      }
    }
  }
  return { sent, failures };
}
