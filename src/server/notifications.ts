import "server-only";
import { db } from "./db";
import { sendMail } from "./mail";
import {
  sendBookingCancelledWith,
  sendBookingConfirmationWith,
  sendDueRemindersWith,
  sendEventCancelledWith,
} from "./notifications-core";

/** Email failures never undo a booking: they are logged and the cron retries reminders. */
function safe<T>(label: string, p: Promise<T>) {
  return p.catch((e) => {
    console.error(`[notifications] ${label} failed`, e);
    return false as const;
  });
}

export const sendBookingConfirmation = (bookingId: string) => safe("confirmation", sendBookingConfirmationWith(db, sendMail, bookingId));
export const sendBookingCancelled = (bookingId: string, refunded: boolean) => safe("booking cancelled", sendBookingCancelledWith(db, sendMail, bookingId, refunded));
export const sendEventCancelled = (bookingId: string, reason: string | null, refunded: boolean) =>
  safe("event cancelled", sendEventCancelledWith(db, sendMail, bookingId, reason, refunded));
export const sendDueReminders = (now?: Date) => sendDueRemindersWith(db, sendMail, now);
