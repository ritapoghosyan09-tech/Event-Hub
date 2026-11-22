/**
 * Account data logic with the Prisma client passed in (shared by the app and
 * the tests, like bookings-core).
 */
import type { PrismaClient } from "@/generated/prisma/client";

type Client = InstanceType<typeof PrismaClient>;

/** Moves bookings made as a guest with this (verified) email into the account. Returns how many moved. */
export async function claimGuestBookingsWith(prisma: Client, userId: string, email: string) {
  const res = await prisma.booking.updateMany({
    where: { userId: null, contactEmail: email.trim().toLowerCase() },
    data: { userId },
  });
  return res.count;
}

/** Merges ids saved on a device into the account's favorites. Unknown or unpublished ids are ignored. */
export async function mergeFavoritesWith(prisma: Client, userId: string, eventIds: string[]) {
  const ids = [...new Set(eventIds)].slice(0, 200);
  if (!ids.length) return 0;
  const existing = await prisma.event.findMany({ where: { id: { in: ids }, status: { not: "DRAFT" } }, select: { id: true } });
  const res = await prisma.favorite.createMany({
    data: existing.map((e) => ({ userId, eventId: e.id })),
    skipDuplicates: true,
  });
  return res.count;
}
