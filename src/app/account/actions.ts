"use server";

import { headers } from "next/headers";
import { revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { cancelBookingWith, canAttendeeCancel } from "@/server/bookings-core";
import { refundBookingPayments } from "@/server/payments";
import { sendBookingCancelled } from "@/server/notifications";

export type ProfileState = { ok?: boolean; error?: string; fieldErrors?: { name?: string; city?: string } };

const profile = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  city: z.string().trim().max(80).optional().transform((v) => v || null),
});

export async function updateProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const parsed = profile.safeParse({ name: form.get("name"), city: form.get("city") ?? undefined });
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { name: f.name?.[0], city: f.city?.[0] } };
  }
  // Through Better Auth so the session's cached copy of the user updates too.
  await auth.api.updateUser({ headers: await headers(), body: { name: parsed.data.name, city: parsed.data.city } });
  return { ok: true };
}

export type CancelState = { ok?: boolean; error?: string };

export async function cancelMyBooking(_prev: CancelState, form: FormData): Promise<CancelState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const id = String(form.get("bookingId") ?? "");
  const booking = await db.booking.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, event: { select: { slug: true, startsAt: true, status: true } } },
  });
  // Someone else's booking looks exactly like a missing one.
  if (!booking || booking.userId !== user.id) return { error: "We couldn't find that booking." };
  if (!canAttendeeCancel(booking)) return { error: "This booking can no longer be cancelled online. Contact the organizer." };

  const cancelled = await cancelBookingWith(db, booking.id);
  if (!cancelled) return { error: "This booking is already cancelled." };
  const refunded = await refundBookingPayments(booking.id);

  updateTag(`user:${user.id}:bookings`);
  updateTag(`event:${booking.event.slug}`);
  revalidateTag("events", "max");
  after(() => sendBookingCancelled(booking.id, refunded));
  return { ok: true };
}
