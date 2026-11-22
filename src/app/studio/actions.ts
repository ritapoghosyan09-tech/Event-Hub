"use server";

import { redirect } from "next/navigation";
import { revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { AccessError, assertOrgAction, requireUser } from "@/server/session";
import {
  addMemberWith,
  checkInWith,
  createEventWith,
  createOrganizationWith,
  deleteDraftWith,
  markEventCancelledWith,
  publishEventWith,
  setMemberRoleWith,
  StudioError,
  unpublishEventWith,
  updateEventWith,
  type CheckInResult,
  type EventInput,
} from "@/server/studio-core";
import { storeEventPhoto, UploadError } from "@/server/storage";
import { cancelEventBookings } from "@/server/payments";
import { sendEventCancelled } from "@/server/notifications";
import { geocode } from "@/server/geocode";
import { isValidTimeZone } from "@/lib/timezone";

export type FormState = { ok?: boolean; error?: string; field?: string; message?: string };

function fail(e: unknown): FormState {
  if (e instanceof StudioError) return { error: e.message, field: e.field };
  if (e instanceof AccessError) return { error: e.message };
  if (e instanceof UploadError) return { error: e.message, field: "photo" };
  console.error("[studio]", e);
  return { error: "Something went wrong and nothing was saved. Try again." };
}

function refreshPublic(slug: string) {
  updateTag(`event:${slug}`);
  revalidateTag("events", "max");
}

// ── Organizations ────────────────────────────────────────────────────────

const orgSchema = z.object({
  name: z.string().trim().min(2, "Enter the organizer name.").max(80),
  type: z.enum(["INDIVIDUAL", "BUSINESS", "COMMUNITY", "NONPROFIT"]),
  contactEmail: z.string().trim().email("Enter an email attendees can write to."),
  bio: z.string().trim().max(1000).optional(),
  websiteUrl: z.union([z.literal(""), z.string().trim().url("Enter a full web address, starting with https://")]).optional(),
});

export async function createOrganization(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/studio/new");
  const parsed = orgSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }
  let slug: string;
  try {
    slug = (await createOrganizationWith(db, user.id, parsed.data)).slug;
  } catch (e) {
    return fail(e);
  }
  revalidateTag("events", "max");
  redirect(`/studio/${slug}`);
}

export async function updateOrganization(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  try {
    await assertOrgAction(orgId, "org:edit");
    const parsed = orgSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { error: issue.message, field: String(issue.path[0]) };
    }
    await db.organization.update({
      where: { id: orgId },
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        contactEmail: parsed.data.contactEmail.toLowerCase(),
        bio: parsed.data.bio || null,
        websiteUrl: parsed.data.websiteUrl || null,
      },
    });
  } catch (e) {
    return fail(e);
  }
  revalidateTag("events", "max");
  return { ok: true, message: "Profile saved." };
}

export async function addMember(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  try {
    await assertOrgAction(orgId, "members:manage");
    const email = z.string().trim().email().safeParse(form.get("email"));
    if (!email.success) return { error: "Enter their email address.", field: "email" };
    const role = z.enum(["OWNER", "ADMIN", "STAFF"]).parse(form.get("role"));
    await addMemberWith(db, orgId, email.data, role);
  } catch (e) {
    return fail(e);
  }
  return { ok: true, message: "Added to the team." };
}

export async function changeMember(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  try {
    const { user } = await assertOrgAction(orgId, "members:manage");
    const target = String(form.get("userId"));
    const raw = String(form.get("role"));
    const role = raw === "REMOVE" ? null : z.enum(["OWNER", "ADMIN", "STAFF"]).parse(raw);
    await setMemberRoleWith(db, orgId, target, role);
    if (target === user.id && role !== "OWNER") redirect("/account");
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return fail(e);
  }
  return { ok: true };
}

// ── Events ───────────────────────────────────────────────────────────────

const money = (v: string) => {
  const n = Number(String(v).replace(",", ".").trim() || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

const ticketRow = z.object({
  id: z.string().optional(),
  name: z.string().max(60),
  description: z.string().max(200).optional(),
  price: z.string().max(12),
  quantity: z.coerce.number().int(),
  maxPerOrder: z.coerce.number().int(),
});

const eventSchema = z.object({
  title: z.string().trim().min(3, "Give the event a title.").max(120),
  categoryId: z.string().min(1, "Choose a category."),
  summary: z.string().trim().min(20, "Write a summary of at least 20 characters.").max(280, "Keep the summary under 280 characters."),
  description: z.string().trim().min(40, "Describe the event in at least a few sentences.").max(10_000),
  format: z.enum(["IN_PERSON", "ONLINE", "HYBRID"]),
  onlineUrl: z.union([z.literal(""), z.string().trim().url("Enter the full link, starting with https://")]).optional(),
  startsLocal: z.string().min(1, "Enter when the event starts."),
  endsLocal: z.string().min(1, "Enter when the event ends."),
  timezone: z.string().refine(isValidTimeZone, "Choose the venue's time zone."),
  currency: z.enum(["EUR", "USD", "GBP", "AMD"]),
  visibility: z.enum(["PUBLIC", "UNLISTED"]),
  ageRestriction: z.union([z.literal(""), z.coerce.number().int().min(0).max(99)]).optional(),
  refundPolicy: z.string().trim().max(300).optional(),
  venueId: z.string().optional(),
  venueName: z.string().trim().max(120).optional(),
  venueAddress: z.string().trim().max(200).optional(),
  venueCity: z.string().trim().max(80).optional(),
  venueCountry: z.string().trim().max(2).optional(),
  tickets: z.string(),
});

async function parseEvent(form: FormData): Promise<{ input: EventInput } | { invalid: FormState }> {
  const parsed = eventSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { invalid: { error: issue.message, field: String(issue.path[0]) } };
  }
  const d = parsed.data;
  let rows: z.infer<typeof ticketRow>[];
  try {
    rows = z.array(ticketRow).max(20).parse(JSON.parse(d.tickets));
  } catch {
    return { invalid: { error: "Check the ticket types: each needs a name, price and quantity.", field: "tickets" } };
  }
  const ticketTypes = rows.map((r) => ({ id: r.id || undefined, name: r.name, description: r.description, priceMinor: money(r.price), quantityTotal: r.quantity, maxPerOrder: r.maxPerOrder }));
  if (ticketTypes.some((t) => Number.isNaN(t.priceMinor))) return { invalid: { error: "Prices must be numbers, like 25 or 12.50.", field: "tickets" } };

  const newVenue =
    d.format !== "ONLINE" && !d.venueId
      ? { name: d.venueName ?? "", addressLine1: d.venueAddress ?? "", city: d.venueCity ?? "", countryCode: d.venueCountry ?? "", latitude: null as number | null, longitude: null as number | null }
      : null;
  if (newVenue?.name && newVenue.addressLine1 && newVenue.city) {
    const pin = await geocode(`${newVenue.addressLine1}, ${newVenue.city}, ${newVenue.countryCode}`);
    if (pin) Object.assign(newVenue, { latitude: pin.lat, longitude: pin.lng });
  }
  const input: EventInput = {
    title: d.title,
    categoryId: d.categoryId,
    summary: d.summary,
    description: d.description,
    format: d.format,
    onlineUrl: d.onlineUrl || null,
    startsLocal: d.startsLocal,
    endsLocal: d.endsLocal,
    timezone: d.timezone,
    currency: d.currency,
    visibility: d.visibility,
    ageRestriction: d.ageRestriction === "" || d.ageRestriction == null ? null : d.ageRestriction,
    refundPolicy: d.refundPolicy || null,
    venueId: d.format === "ONLINE" ? null : d.venueId || null,
    newVenue,
    ticketTypes,
  };
  return { input };
}

export async function saveEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  const orgSlug = String(form.get("orgSlug"));
  const eventId = String(form.get("eventId") ?? "");
  let created: { id: string } | null = null;
  try {
    await assertOrgAction(orgId, eventId ? "event:edit" : "event:create");
    const parsed = await parseEvent(form);
    if ("invalid" in parsed) return parsed.invalid;
    const { input } = parsed;
    if (eventId) {
      const e = await updateEventWith(db, orgId, eventId, input);
      if (e.status !== "DRAFT") refreshPublic(e.slug);
    } else {
      created = await createEventWith(db, orgId, input);
    }
  } catch (e) {
    return fail(e);
  }
  if (created) redirect(`/studio/${orgSlug}/events/${created.id}?created=1`);
  return { ok: true, message: "Changes saved." };
}

async function eventFor(orgId: string, eventId: string) {
  return db.event.findFirst({ where: { id: eventId, organizationId: orgId }, select: { id: true, slug: true, title: true } });
}

export async function publishEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  const eventId = String(form.get("eventId"));
  try {
    await assertOrgAction(orgId, "event:publish");
    const e = await publishEventWith(db, orgId, eventId);
    refreshPublic(e.slug);
  } catch (e) {
    return fail(e);
  }
  return { ok: true, message: "Published. The event is live." };
}

export async function unpublishEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  const eventId = String(form.get("eventId"));
  try {
    await assertOrgAction(orgId, "event:publish");
    const e = await unpublishEventWith(db, orgId, eventId);
    refreshPublic(e.slug);
  } catch (e) {
    return fail(e);
  }
  return { ok: true, message: "Moved back to draft." };
}

export async function cancelEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  const eventId = String(form.get("eventId"));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500) || null;
  try {
    await assertOrgAction(orgId, "event:cancel");
    if (String(form.get("confirm")) !== "CANCEL") return { error: "Type CANCEL to confirm.", field: "confirm" };
    const e = await markEventCancelledWith(db, orgId, eventId, reason);
    const done = await cancelEventBookings(e.id);
    refreshPublic(e.slug);
    after(async () => {
      for (const d of done) await sendEventCancelled(d.bookingId, reason, d.refunded);
    });
    return { ok: true, message: done.length ? `Cancelled. ${done.length} booking${done.length === 1 ? "" : "s"} cancelled and attendees emailed.` : "Cancelled." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDraft(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  const orgSlug = String(form.get("orgSlug"));
  try {
    await assertOrgAction(orgId, "event:edit");
    await deleteDraftWith(db, orgId, String(form.get("eventId")));
  } catch (e) {
    return fail(e);
  }
  redirect(`/studio/${orgSlug}`);
}

// ── Photos ───────────────────────────────────────────────────────────────

export async function uploadPhoto(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  const eventId = String(form.get("eventId"));
  try {
    await assertOrgAction(orgId, "event:edit");
    const e = await eventFor(orgId, eventId);
    if (!e) return { error: "Event not found." };
    const alt = String(form.get("alt") ?? "").trim();
    if (alt.length < 5) return { error: "Describe the photo in a few words, for people using screen readers.", field: "alt" };
    const file = form.get("photo");
    if (!(file instanceof File)) return { error: "Choose a photo to upload.", field: "photo" };
    const count = await db.eventImage.count({ where: { eventId } });
    if (count >= 8) return { error: "An event can have up to 8 photos.", field: "photo" };
    const stored = await storeEventPhoto(file, eventId);
    const last = await db.eventImage.findFirst({ where: { eventId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await db.eventImage.create({
      data: { id: crypto.randomUUID(), eventId, storageKey: stored.url, alt: alt.slice(0, 200), width: stored.width, height: stored.height, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    refreshPublic(e.slug);
  } catch (e) {
    return fail(e);
  }
  return { ok: true, message: "Photo added." };
}

export async function arrangePhoto(_prev: FormState, form: FormData): Promise<FormState> {
  const orgId = String(form.get("orgId"));
  const eventId = String(form.get("eventId"));
  const imageId = String(form.get("imageId"));
  const op = String(form.get("op"));
  try {
    await assertOrgAction(orgId, "event:edit");
    const e = await eventFor(orgId, eventId);
    if (!e) return { error: "Event not found." };
    await db.$transaction(async (tx) => {
      const images = await tx.eventImage.findMany({ where: { eventId }, orderBy: { sortOrder: "asc" } });
      const i = images.findIndex((x) => x.id === imageId);
      if (i < 0) return;
      let order = images.map((x) => x.id);
      if (op === "remove") order = order.filter((id) => id !== imageId);
      if (op === "first") order = [imageId, ...order.filter((id) => id !== imageId)];
      if (op === "remove") await tx.eventImage.delete({ where: { id: imageId } });
      // Two passes so the unique (eventId, sortOrder) index never sees a clash.
      for (const [n, id] of order.entries()) await tx.eventImage.update({ where: { id }, data: { sortOrder: 1000 + n } });
      for (const [n, id] of order.entries()) await tx.eventImage.update({ where: { id }, data: { sortOrder: n } });
    });
    refreshPublic(e.slug);
  } catch (e) {
    return fail(e);
  }
  return { ok: true };
}

// ── Door ─────────────────────────────────────────────────────────────────

export type CheckInState = { result?: CheckInResult; error?: string; at?: number };

export async function checkIn(_prev: CheckInState, form: FormData): Promise<CheckInState> {
  const orgId = String(form.get("orgId"));
  const eventId = String(form.get("eventId"));
  try {
    const { user } = await assertOrgAction(orgId, "tickets:checkin");
    const e = await eventFor(orgId, eventId);
    if (!e) return { error: "Event not found." };
    const result = await checkInWith(db, eventId, String(form.get("code") ?? ""), user.id);
    return { result, at: Date.now() };
  } catch (e) {
    return { error: fail(e).error };
  }
}
