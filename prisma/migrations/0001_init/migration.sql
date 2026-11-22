-- EVENT HUB — initial schema (mirrors prisma/schema.prisma; hand-written so it can include
-- CHECK constraints and the full-text search column that Prisma cannot express).

-- Enums
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "OrganizationType" AS ENUM ('INDIVIDUAL', 'BUSINESS', 'COMMUNITY', 'NONPROFIT');
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'UNLISTED');
CREATE TYPE "EventFormat" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');
CREATE TYPE "TicketTypeStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'SOLD_OUT');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'EXPIRED');
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'CHECKED_IN', 'VOID');
CREATE TYPE "PaymentStatus" AS ENUM ('REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CONFIRMATION', 'REMINDER_24H', 'REMINDER_2H', 'EVENT_UPDATED', 'EVENT_CANCELLED');

-- Identity
CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "role" "PlatformRole" NOT NULL DEFAULT 'USER',
  "city" TEXT,
  "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

CREATE TABLE "accounts" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ(6),
  "refreshTokenExpiresAt" TIMESTAMPTZ(6),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

CREATE TABLE "verifications" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- Organizers
CREATE TABLE "organizations" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "type" "OrganizationType" NOT NULL,
  "bio" TEXT,
  "logoUrl" TEXT,
  "coverUrl" TEXT,
  "websiteUrl" TEXT,
  "contactEmail" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "payoutProvider" TEXT,
  "payoutAccountRef" TEXT UNIQUE,
  "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE "organization_members" (
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role" "MemberRole" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  PRIMARY KEY ("organizationId", "userId")
);
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- Catalog
CREATE TABLE "categories" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "iconKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "venues" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "region" TEXT,
  "postalCode" TEXT,
  "countryCode" CHAR(2) NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "timezone" TEXT NOT NULL,
  "organizationId" TEXT REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "venues_city_idx" ON "venues"("city");
CREATE INDEX "venues_latitude_longitude_idx" ON "venues"("latitude", "longitude");

CREATE TABLE "events" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "categoryId" TEXT NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "venueId" TEXT REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "summary" VARCHAR(280) NOT NULL,
  "description" TEXT NOT NULL,
  "format" "EventFormat" NOT NULL DEFAULT 'IN_PERSON',
  "onlineUrl" TEXT,
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "timezone" TEXT NOT NULL,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
  "capacity" INTEGER,
  "ageRestriction" INTEGER,
  "refundPolicy" TEXT,
  "minPriceMinor" INTEGER,
  "currency" CHAR(3),
  "isFree" BOOLEAN NOT NULL DEFAULT false,
  "featuredFrom" TIMESTAMPTZ(6),
  "featuredUntil" TIMESTAMPTZ(6),
  "publishedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("summary", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'C')
  ) STORED,
  CONSTRAINT "events_dates_check" CHECK ("endsAt" >= "startsAt")
);
CREATE INDEX "events_status_visibility_startsAt_idx" ON "events"("status", "visibility", "startsAt");
CREATE INDEX "events_categoryId_startsAt_idx" ON "events"("categoryId", "startsAt");
CREATE INDEX "events_organizationId_startsAt_idx" ON "events"("organizationId", "startsAt");
CREATE INDEX "events_featuredUntil_idx" ON "events"("featuredUntil");
CREATE INDEX "events_searchVector_idx" ON "events" USING GIN ("searchVector");

CREATE TABLE "event_images" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "storageKey" TEXT NOT NULL,
  "alt" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "blurDataUrl" TEXT,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "event_images_eventId_sortOrder_idx" ON "event_images"("eventId", "sortOrder");

-- Ticketing
CREATE TABLE "ticket_types" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "quantityTotal" INTEGER NOT NULL,
  "quantitySold" INTEGER NOT NULL DEFAULT 0,
  "quantityHeld" INTEGER NOT NULL DEFAULT 0,
  "minPerOrder" INTEGER NOT NULL DEFAULT 1,
  "maxPerOrder" INTEGER NOT NULL DEFAULT 10,
  "salesStartAt" TIMESTAMPTZ(6),
  "salesEndAt" TIMESTAMPTZ(6),
  "status" "TicketTypeStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ticket_types_inventory_check"
    CHECK ("quantitySold" >= 0 AND "quantityHeld" >= 0 AND "quantitySold" + "quantityHeld" <= "quantityTotal"),
  CONSTRAINT "ticket_types_price_check" CHECK ("priceMinor" >= 0)
);
CREATE INDEX "ticket_types_eventId_sortOrder_idx" ON "ticket_types"("eventId", "sortOrder");

CREATE TABLE "bookings" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "eventId" TEXT NOT NULL REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "subtotalMinor" INTEGER NOT NULL,
  "feeMinor" INTEGER NOT NULL DEFAULT 0,
  "totalMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "holdExpiresAt" TIMESTAMPTZ(6),
  "confirmedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  "idempotencyKey" TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "bookings_userId_createdAt_idx" ON "bookings"("userId", "createdAt");
CREATE INDEX "bookings_eventId_status_idx" ON "bookings"("eventId", "status");
CREATE INDEX "bookings_status_holdExpiresAt_idx" ON "bookings"("status", "holdExpiresAt");

CREATE TABLE "booking_items" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ticketTypeId" TEXT NOT NULL REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "unitPriceMinor" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "booking_items_bookingId_ticketTypeId_key" ON "booking_items"("bookingId", "ticketTypeId");

CREATE TABLE "tickets" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ticketTypeId" TEXT NOT NULL REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "attendeeName" TEXT,
  "attendeeEmail" TEXT,
  "qrToken" TEXT NOT NULL UNIQUE,
  "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
  "checkedInAt" TIMESTAMPTZ(6),
  "checkedInById" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "tickets_bookingId_idx" ON "tickets"("bookingId");
CREATE INDEX "tickets_ticketTypeId_status_idx" ON "tickets"("ticketTypeId", "status");

-- Payments
CREATE TABLE "payments" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "provider" TEXT NOT NULL,
  "providerPaymentRef" TEXT NOT NULL UNIQUE,
  "status" "PaymentStatus" NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "platformFeeMinor" INTEGER NOT NULL DEFAULT 0,
  "refundedAmountMinor" INTEGER NOT NULL DEFAULT 0,
  "failureReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

CREATE TABLE "webhook_events" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "processedAt" TIMESTAMPTZ(6),
  "error" TEXT
);
CREATE UNIQUE INDEX "webhook_events_provider_providerEventId_key" ON "webhook_events"("provider", "providerEventId");

-- Engagement
CREATE TABLE "favorites" (
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "eventId" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "eventId")
);
CREATE INDEX "favorites_eventId_idx" ON "favorites"("eventId");

CREATE TABLE "reviews" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "body" TEXT,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX "reviews_eventId_userId_key" ON "reviews"("eventId", "userId");

CREATE TABLE "notification_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "bookingId" TEXT REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" "NotificationType" NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'email',
  "sentAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "notification_logs_bookingId_type_channel_key" ON "notification_logs"("bookingId", "type", "channel");
CREATE INDEX "notification_logs_userId_idx" ON "notification_logs"("userId");
