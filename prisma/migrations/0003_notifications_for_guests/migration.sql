-- Guest bookings get emails too: a notification no longer needs an account,
-- and the log records the address each message went to.
ALTER TABLE "notification_logs" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "notification_logs" ADD COLUMN "recipient" TEXT NOT NULL DEFAULT '';
ALTER TABLE "notification_logs" ALTER COLUMN "recipient" DROP DEFAULT;
ALTER TABLE "notification_logs" DROP CONSTRAINT IF EXISTS "notification_logs_userId_fkey";
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Attendee-initiated cancellations get their own email type.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CANCELLED';
