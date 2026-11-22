-- Phase 3 schema revision.
-- 1. Guest bookings no longer create user rows: bookings.userId becomes optional.
--    A booking made while signed out is claimed by the account that later verifies the same email.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_userId_fkey";
ALTER TABLE "bookings" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "bookings_contactEmail_idx" ON "bookings" (lower("contactEmail"));

-- Detach guest users the old engine created (no account, no saves, no memberships) and remove them.
UPDATE "bookings" b SET "userId" = NULL
  FROM "users" u
 WHERE b."userId" = u."id"
   AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."userId" = u."id");
DELETE FROM "users" u
 WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."userId" = u."id")
   AND NOT EXISTS (SELECT 1 FROM "favorites" f WHERE f."userId" = u."id")
   AND NOT EXISTS (SELECT 1 FROM "organization_members" m WHERE m."userId" = u."id")
   AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."userId" = u."id");

-- 2. Remove what no feature uses or plans to use.
DROP TABLE IF EXISTS "reviews";
DROP TYPE IF EXISTS "ReviewStatus";
ALTER TABLE "users" DROP COLUMN IF EXISTS "marketingOptIn";
ALTER TABLE "categories" DROP COLUMN IF EXISTS "iconKey";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "coverUrl";
ALTER TABLE "venues" DROP COLUMN IF EXISTS "addressLine2";
ALTER TABLE "events" DROP COLUMN IF EXISTS "capacity";
ALTER TABLE "event_images" DROP COLUMN IF EXISTS "blurDataUrl";
ALTER TABLE "event_images" DROP COLUMN IF EXISTS "isCover";

-- 3. One cover per event is the image with the lowest sortOrder; keep that ordering unique.
CREATE UNIQUE INDEX IF NOT EXISTS "event_images_eventId_sortOrder_key" ON "event_images" ("eventId", "sortOrder");
DROP INDEX IF EXISTS "event_images_eventId_sortOrder_idx";
