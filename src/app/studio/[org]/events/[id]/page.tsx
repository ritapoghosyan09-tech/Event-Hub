import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOrgAccess } from "@/server/session";
import { getCategoryOptions, getOrgVenues, getStudioEvent } from "@/server/studio";
import { StudioShell, StudioSkeleton, STATUS_STYLE } from "@/components/studio/StudioShell";
import { EventForm } from "@/components/studio/EventForm";
import { PhotoManager } from "@/components/studio/PhotoManager";
import { DangerZone, PublishButton } from "@/components/studio/EventActions";
import { ButtonLink } from "@/components/ui/Button";
import { timeZones } from "@/lib/timezone";
import { longDate, timeRange } from "@/lib/format";

export const metadata: Metadata = { title: "Manage event", robots: { index: false } };

export default function ManageEventPage({ params, searchParams }: PageProps<"/studio/[org]/events/[id]">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <Manage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Manage({ params, searchParams }: { params: Promise<{ org: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { org: slug, id } = await params;
  const created = (await searchParams).created === "1";
  const access = await requireOrgAccess(slug, `/studio/${slug}/events/${id}`);
  const event = await getStudioEvent(access.org.id, id);
  if (!event) notFound();
  const canEdit = access.can("event:edit") && (event.status === "DRAFT" || event.status === "PUBLISHED") && !event.past;
  const [categories, venues] = canEdit ? await Promise.all([getCategoryOptions(), getOrgVenues(access.org.id)]) : [[], []];
  const status = STATUS_STYLE[event.past && event.status === "PUBLISHED" ? "COMPLETED" : event.status];
  const ids = { orgId: access.org.id, orgSlug: slug, eventId: event.id };
  const start = new Date(event.startsAt);

  return (
    <StudioShell
      org={access.org}
      role={access.role}
      title={event.title}
      crumbs={[{ href: `/studio/${slug}`, label: access.org.name }]}
      actions={
        <>
          {event.status !== "DRAFT" && <ButtonLink href={`/events/${event.slug}`} variant="ghost-inverse" size="lg">View public page</ButtonLink>}
          {event.status === "DRAFT" && access.can("event:publish") && <PublishButton {...ids} ready={event.checklist.length === 0} />}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line pb-6">
        <span className={`rounded-tag px-2.5 py-1 text-sm font-semibold ${status.tone}`}>{status.label}</span>
        <p className="text-[15px] text-ink-muted">{longDate(start, event.timezone)}, {timeRange(start, new Date(event.endsAt), event.timezone)}</p>
        <nav aria-label="Event sections" className="ml-auto flex flex-wrap gap-2">
          {access.can("attendees:view") && <Link href={`/studio/${slug}/events/${event.id}/attendees`} className="rounded-full bg-sunken px-4 py-2 text-sm font-semibold text-ink hover:bg-[var(--eh-beige-deep)]">Attendees ({event.bookings} bookings)</Link>}
          {access.can("tickets:checkin") && event.status === "PUBLISHED" && <Link href={`/studio/${slug}/events/${event.id}/door`} className="rounded-full bg-sunken px-4 py-2 text-sm font-semibold text-ink hover:bg-[var(--eh-beige-deep)]">Check-in</Link>}
        </nav>
      </div>

      {created && <p role="status" className="mt-6 rounded-card bg-[#e6efe6] px-5 py-4 text-[15px] text-success">Draft created. Add photos, check the details, then publish.</p>}
      {event.status === "CANCELLED" && <p className="mt-6 rounded-card bg-[#f7e7e7] px-5 py-4 text-[15px] text-danger">Cancelled{event.cancelReason ? `: ${event.cancelReason}` : "."} Ticket holders were emailed.</p>}

      {event.status === "DRAFT" && (
        <section aria-labelledby="ready-title" className="mt-8 rounded-card bg-surface p-6 ring-1 ring-line/60">
          <h2 id="ready-title" className="font-display text-2xl text-ink-strong">{event.checklist.length ? "Before you publish" : "Ready to publish"}</h2>
          {event.checklist.length ? (
            <ul className="mt-3 space-y-1.5 text-[15px] text-ink">
              {event.checklist.map((c) => (
                <li key={c} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />{c}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[15px] text-ink-muted">Everything&apos;s in place. Publishing puts it on sale straight away.</p>
          )}
        </section>
      )}

      {canEdit && (
        <section aria-labelledby="photos-title" className="mt-12">
          <h2 id="photos-title" className="font-display text-display-sm font-normal text-ink-strong">Photos</h2>
          <p className="mt-2 max-w-xl text-ink-muted">Real photos of the venue, the performers or a past edition sell best. The first one is the cover.</p>
          <div className="mt-6"><PhotoManager orgId={access.org.id} eventId={event.id} images={event.images} /></div>
        </section>
      )}

      {canEdit ? (
        <section aria-labelledby="details-title" className="mt-14">
          <h2 id="details-title" className="font-display text-display-sm font-normal text-ink-strong">Details</h2>
          <div className="mt-8">
            <EventForm orgId={access.org.id} orgSlug={slug} categories={categories} venues={venues} timeZones={timeZones()} event={event} />
          </div>
        </section>
      ) : (
        <p className="mt-10 text-ink-muted">{event.past ? "This event has finished, so its details are final." : access.can("event:edit") ? "" : "Your role can see this event but not edit it."}</p>
      )}

      {access.can("event:cancel") && (
        <section aria-labelledby="danger-title" className="mt-16 rounded-card border border-line p-6">
          <h2 id="danger-title" className="font-display text-2xl text-ink-strong">{event.status === "DRAFT" ? "Delete" : "Take it off sale"}</h2>
          <div className="mt-4"><DangerZone {...ids} status={event.past ? "COMPLETED" : event.status} bookings={event.bookings} /></div>
        </section>
      )}
    </StudioShell>
  );
}
