import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

/* ─────────────────────────────────────────────────────────────────────────
   Read side of EVENT HUB. Every public list is cached for a few minutes and
   tagged "events", so publishing, editing or booking refreshes it at once
   (revalidateTag("events") in the write paths).
   Values returned from cached functions are plain JSON (dates as ISO strings).
───────────────────────────────────────────────────────────────────────── */

const cardInclude = {
  venue: { select: { name: true, city: true, countryCode: true } },
  category: { select: { slug: true, name: true } },
  organization: { select: { slug: true, name: true, verified: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { storageKey: true, alt: true } },
  ticketTypes: { where: { status: "ACTIVE" }, select: { quantityTotal: true, quantitySold: true, quantityHeld: true } },
} satisfies Prisma.EventInclude;

type CardRow = Prisma.EventGetPayload<{ include: typeof cardInclude }>;

export type EventCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  city: string | null;
  venueName: string | null;
  category: { slug: string; name: string };
  organizer: { slug: string; name: string; verified: boolean };
  image: { src: string; alt: string } | null;
  isFree: boolean;
  minPriceMinor: number | null;
  currency: string | null;
  remaining: number;
  capacity: number;
};

function toCard(e: CardRow): EventCardData {
  const capacity = e.ticketTypes.reduce((s, t) => s + t.quantityTotal, 0);
  const taken = e.ticketTypes.reduce((s, t) => s + t.quantitySold + t.quantityHeld, 0);
  const img = e.images[0];
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    timezone: e.timezone,
    city: e.venue?.city ?? null,
    venueName: e.venue?.name ?? null,
    category: e.category,
    organizer: e.organization,
    image: img ? { src: img.storageKey, alt: img.alt } : null,
    isFree: e.isFree,
    minPriceMinor: e.minPriceMinor,
    currency: e.currency,
    remaining: Math.max(0, capacity - taken),
    capacity,
  };
}

const live = (now: Date): Prisma.EventWhereInput => ({
  status: "PUBLISHED",
  visibility: "PUBLIC",
  startsAt: { gt: now },
});

/* ── Categories & cities ─────────────────────────────────────────────── */

export async function getCategories() {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const now = new Date();
  const cats = await db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, _count: { select: { events: { where: live(now) } } } },
  });
  return cats.map((c) => ({ slug: c.slug, name: c.name, upcoming: c._count.events }));
}

export async function getCategory(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const cats = await getCategories();
  return cats.find((c) => c.slug === slug) ?? null;
}

export async function getCities() {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const rows = await db.$queryRaw<{ city: string; country: string; n: bigint }[]>`
    SELECT v."city", v."countryCode" AS country, COUNT(*) AS n
      FROM "events" e JOIN "venues" v ON v."id" = e."venueId"
     WHERE e."status" = 'PUBLISHED' AND e."visibility" = 'PUBLIC' AND e."startsAt" > now()
  GROUP BY 1, 2 ORDER BY n DESC, 1 ASC`;
  return rows.map((r) => ({ city: r.city, country: r.country.trim(), upcoming: Number(r.n) }));
}

export async function getStats() {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const now = new Date();
  const [events, organizers, cities] = await Promise.all([
    db.event.count({ where: live(now) }),
    db.organization.count({ where: { status: "ACTIVE", events: { some: live(now) } } }),
    getCities(),
  ]);
  return { events, organizers, cities: cities.length };
}

/* ── Home page lists ─────────────────────────────────────────────────── */

export async function getFeatured(limit = 5) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const now = new Date();
  const rows = await db.event.findMany({
    where: { ...live(now), featuredFrom: { lte: now }, featuredUntil: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: limit,
    include: cardInclude,
  });
  return rows.map(toCard);
}

export async function getUpcoming(limit = 8, excludeIds: string[] = []) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const rows = await db.event.findMany({
    where: { ...live(new Date()), id: { notIn: excludeIds } },
    orderBy: { startsAt: "asc" },
    take: limit,
    include: cardInclude,
  });
  return rows.map(toCard);
}

/** Local weekday/hour of an instant in the venue's own time zone. */
function localClock(d: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { wd: p.weekday as string, hour: Number(p.hour) };
}

/** Friday from 17:00 to Sunday night, in each venue's local time, for the coming weekend. */
export async function getThisWeekend(limit = 10) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 864e5);
  const rows = await db.event.findMany({
    where: { ...live(now), startsAt: { gt: now, lt: horizon } },
    orderBy: { startsAt: "asc" },
    include: cardInclude,
  });
  const isWeekend = (e: CardRow) => {
    const { wd, hour } = localClock(e.startsAt, e.timezone);
    return wd === "Sat" || wd === "Sun" || (wd === "Fri" && hour >= 17);
  };
  // Only the first weekend we reach: stop at the next Monday after the first weekend event.
  const weekend = rows.filter(isWeekend);
  if (!weekend.length) return [];
  const first = weekend[0].startsAt.getTime();
  return weekend.filter((e) => e.startsAt.getTime() - first < 3 * 864e5).slice(0, limit).map(toCard);
}

/** Ranked by tickets confirmed plus half-weight saves, both in the last 7 days. */
export async function getTrending(limit = 6) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const ranked = await db.$queryRaw<{ id: string; tickets: bigint; saves: bigint }[]>`
    SELECT e."id",
           COALESCE(b.tickets, 0) AS tickets,
           COALESCE(f.saves, 0)   AS saves
      FROM "events" e
 LEFT JOIN (SELECT bk."eventId", SUM(bi."quantity") AS tickets
              FROM "bookings" bk JOIN "booking_items" bi ON bi."bookingId" = bk."id"
             WHERE bk."status" = 'CONFIRMED' AND bk."createdAt" > now() - interval '7 days'
          GROUP BY 1) b ON b."eventId" = e."id"
 LEFT JOIN (SELECT "eventId", COUNT(*) AS saves FROM "favorites"
             WHERE "createdAt" > now() - interval '7 days' GROUP BY 1) f ON f."eventId" = e."id"
     WHERE e."status" = 'PUBLISHED' AND e."visibility" = 'PUBLIC' AND e."startsAt" > now()
       AND (COALESCE(b.tickets, 0) + COALESCE(f.saves, 0)) > 0
  ORDER BY (COALESCE(b.tickets, 0) + 0.5 * COALESCE(f.saves, 0)) DESC, e."startsAt" ASC
     LIMIT ${limit}`;
  if (ranked.length < 4) return []; // never show a ranking of near-zeros
  const rows = await db.event.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, include: cardInclude });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ranked
    .filter((r) => byId.has(r.id))
    .map((r) => ({ ...toCard(byId.get(r.id)!), ticketsThisWeek: Number(r.tickets), savesThisWeek: Number(r.saves) }));
}

/* ── Search & filters (/events) ──────────────────────────────────────── */

export type EventFilters = {
  q?: string;
  category?: string;
  city?: string;
  when?: "today" | "weekend" | "week" | "month";
  price?: "free" | "paid";
  sort?: "soonest" | "price";
};

export async function searchEvents(f: EventFilters) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const now = new Date();
  const where: Prisma.EventWhereInput = { ...live(now) };

  if (f.q && f.q.trim()) {
    const q = f.q.trim().slice(0, 80);
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const ids = await db.$queryRaw<{ id: string }[]>`
      SELECT e."id" FROM "events" e
        JOIN "organizations" o ON o."id" = e."organizationId"
   LEFT JOIN "venues" v ON v."id" = e."venueId"
       WHERE e."searchVector" @@ websearch_to_tsquery('simple', ${q})
          OR e."title" ILIKE ${like} OR o."name" ILIKE ${like}
          OR v."name" ILIKE ${like} OR v."city" ILIKE ${like}`;
    where.id = { in: ids.map((r) => r.id) };
  }
  if (f.category) where.category = { slug: f.category };
  if (f.city) where.venue = { city: { equals: f.city, mode: "insensitive" } };
  if (f.price === "free") where.minPriceMinor = 0;
  if (f.price === "paid") where.isFree = false;
  if (f.when === "today") where.startsAt = { gt: now, lt: new Date(now.getTime() + 864e5) };
  if (f.when === "week") where.startsAt = { gt: now, lt: new Date(now.getTime() + 7 * 864e5) };
  if (f.when === "month") where.startsAt = { gt: now, lt: new Date(now.getTime() + 31 * 864e5) };

  const rows = await db.event.findMany({
    where,
    orderBy: f.sort === "price" ? [{ minPriceMinor: "asc" }, { startsAt: "asc" }] : { startsAt: "asc" },
    take: 60,
    include: cardInclude,
  });

  let list = rows;
  if (f.when === "weekend") {
    const weekend = await getThisWeekend(60);
    const ids = new Set(weekend.map((e) => e.id));
    list = rows.filter((r) => ids.has(r.id));
  }
  return list.map(toCard);
}

/* ── Event detail ────────────────────────────────────────────────────── */

export async function getEventSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("events");
  const rows = await db.event.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
  return rows.map((r) => r.slug);
}

export async function getEvent(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events", `event:${slug}`);
  const e = await db.event.findUnique({
    where: { slug },
    include: {
      venue: true,
      category: { select: { slug: true, name: true } },
      organization: { select: { slug: true, name: true, verified: true, bio: true, type: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { storageKey: true, alt: true } },
      ticketTypes: { where: { status: { not: "HIDDEN" } }, orderBy: { sortOrder: "asc" } },
    },
  });
  // Unlisted events open by direct link; drafts never leave the studio.
  if (!e || e.status === "DRAFT") return null;

  const now = new Date();
  const [related, fromOrganizer, saves] = await Promise.all([
    db.event.findMany({
      where: { ...live(now), categoryId: e.categoryId, id: { not: e.id } },
      orderBy: { startsAt: "asc" },
      take: 3,
      include: cardInclude,
    }),
    db.event.count({ where: { ...live(now), organizationId: e.organizationId } }),
    db.favorite.count({ where: { eventId: e.id } }),
  ]);

  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    description: e.description,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    timezone: e.timezone,
    status: e.status,
    visibility: e.visibility,
    cancelReason: e.cancelReason,
    upcoming: e.startsAt > now && e.status === "PUBLISHED",
    format: e.format,
    refundPolicy: e.refundPolicy,
    ageRestriction: e.ageRestriction,
    isFree: e.isFree,
    minPriceMinor: e.minPriceMinor,
    currency: e.currency,
    category: e.category,
    organizer: { ...e.organization, upcoming: fromOrganizer },
    venue: e.venue
      ? {
          name: e.venue.name,
          address: e.venue.addressLine1,
          city: e.venue.city,
          countryCode: e.venue.countryCode.trim(),
          lat: e.venue.latitude == null ? null : Number(e.venue.latitude),
          lng: e.venue.longitude == null ? null : Number(e.venue.longitude),
        }
      : null,
    images: e.images.map((i) => ({ src: i.storageKey, alt: i.alt })),
    tickets: e.ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      priceMinor: t.priceMinor,
      currency: t.currency,
      remaining: Math.max(0, t.quantityTotal - t.quantitySold - t.quantityHeld),
      maxPerOrder: t.maxPerOrder,
      minPerOrder: t.minPerOrder,
      onSale:
        t.status === "ACTIVE" &&
        (!t.salesStartAt || t.salesStartAt <= now) &&
        (!t.salesEndAt || t.salesEndAt > now),
    })),
    saves,
    related: related.map(toCard),
  };
}
export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEvent>>>;

/* ── Organizers ──────────────────────────────────────────────────────── */

export async function getOrganizerSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("events");
  return (await db.organization.findMany({ where: { status: "ACTIVE" }, select: { slug: true } })).map((o) => o.slug);
}

export async function getOrganizer(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const now = new Date();
  const o = await db.organization.findUnique({ where: { slug } });
  if (!o || o.status !== "ACTIVE") return null;
  const [events, past, ticketsSold] = await Promise.all([
    db.event.findMany({ where: { ...live(now), organizationId: o.id }, orderBy: { startsAt: "asc" }, include: cardInclude }),
    db.event.count({ where: { organizationId: o.id, status: { in: ["PUBLISHED", "COMPLETED"] }, startsAt: { lte: now } } }),
    db.ticket.count({ where: { status: { not: "VOID" }, booking: { status: "CONFIRMED", event: { organizationId: o.id } } } }),
  ]);
  const cities = Array.from(new Set(events.map((e) => e.venue?.city).filter(Boolean))) as string[];
  return {
    slug: o.slug,
    name: o.name,
    bio: o.bio,
    type: o.type,
    verified: o.verified,
    since: o.createdAt.getFullYear(),
    events: events.map(toCard),
    pastEvents: past,
    ticketsSold,
    cities,
  };
}

/* ── Saved events (ids kept on the device until accounts ship) ───────── */

export async function getEventsByIds(ids: string[]) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  if (!ids.length) return [];
  const rows = await db.event.findMany({
    where: { id: { in: ids.slice(0, 100) }, status: "PUBLISHED", visibility: "PUBLIC" },
    orderBy: { startsAt: "asc" },
    include: cardInclude,
  });
  return rows.map(toCard);
}

export async function getOrganizers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  const now = new Date();
  const orgs = await db.organization.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: {
      events: {
        where: live(now),
        orderBy: { startsAt: "asc" },
        select: { id: true, venue: { select: { city: true } }, category: { select: { name: true } }, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { storageKey: true, alt: true } } },
      },
    },
  });
  return orgs
    .map((o) => ({
      slug: o.slug,
      name: o.name,
      bio: o.bio,
      type: o.type,
      verified: o.verified,
      upcoming: o.events.length,
      cities: Array.from(new Set(o.events.map((e) => e.venue?.city).filter(Boolean))) as string[],
      categories: Array.from(new Set(o.events.map((e) => e.category.name))),
      image: o.events[0]?.images[0] ? { src: o.events[0].images[0].storageKey, alt: o.events[0].images[0].alt } : null,
    }))
    .sort((a, b) => b.upcoming - a.upcoming);
}
