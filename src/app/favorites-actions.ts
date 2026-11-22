"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { mergeFavorites } from "@/server/accounts";
import { getCurrentUser } from "@/server/session";

const ids = z.array(z.string().min(1).max(64)).max(200);

/**
 * Called once after sign-in: events saved on this device join the account's
 * favorites, and the full list comes back (newest first) to replace the device copy.
 */
export async function syncFavorites(deviceIds: string[]): Promise<string[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const parsed = ids.safeParse(deviceIds);
  if (parsed.success) await mergeFavorites(user.id, parsed.data);
  const rows = await db.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { eventId: true } });
  return rows.map((r) => r.eventId);
}

export async function setFavorite(eventId: string, saved: boolean): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !z.string().min(1).max(64).safeParse(eventId).success) return { ok: false };
  if (saved) {
    const exists = await db.event.count({ where: { id: eventId, status: { not: "DRAFT" } } });
    if (!exists) return { ok: false };
    await db.favorite.upsert({ where: { userId_eventId: { userId: user.id, eventId } }, create: { userId: user.id, eventId }, update: {} });
  } else {
    await db.favorite.deleteMany({ where: { userId: user.id, eventId } });
  }
  return { ok: true };
}
