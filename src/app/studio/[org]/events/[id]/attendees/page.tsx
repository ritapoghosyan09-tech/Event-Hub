import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOrgAccess } from "@/server/session";
import { getAttendees } from "@/server/studio";
import { NotInRole, StudioShell, StudioSkeleton } from "@/components/studio/StudioShell";
import { AttendeeTable } from "@/components/studio/AttendeeTable";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Attendees", robots: { index: false } };

export default function AttendeesPage({ params }: PageProps<"/studio/[org]/events/[id]/attendees">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <Attendees params={params} />
    </Suspense>
  );
}

async function Attendees({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params;
  const access = await requireOrgAccess(slug, `/studio/${slug}/events/${id}/attendees`);
  const data = await getAttendees(access.org.id, id);
  if (!data) notFound();
  const crumbs = [
    { href: `/studio/${slug}`, label: access.org.name },
    { href: `/studio/${slug}/events/${id}`, label: data.event.title },
  ];
  if (!access.can("attendees:view")) {
    return <StudioShell org={access.org} role={access.role} title="Attendees" crumbs={crumbs}><NotInRole what="seeing attendees" /></StudioShell>;
  }
  const checked = data.rows.filter((r) => r.status === "CHECKED_IN").length;
  return (
    <StudioShell
      org={access.org}
      role={access.role}
      title="Attendees"
      crumbs={crumbs}
      actions={access.can("attendees:export") && data.rows.length > 0 ? <a href={`/studio/${slug}/events/${id}/attendees/export`} download className="inline-flex h-13 items-center rounded-full bg-cream px-7 text-base font-semibold text-navy hover:bg-white">Download CSV</a> : undefined}
    >
      <p className="text-ink-muted">
        {data.rows.length} {data.rows.length === 1 ? "ticket" : "tickets"}, {checked} checked in.
      </p>
      {data.rows.length ? (
        <AttendeeTable rows={data.rows} />
      ) : (
        <div className="mt-6 rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="font-display text-2xl text-ink-strong">No bookings yet</p>
          <p className="mx-auto mt-2 max-w-sm text-ink-muted">Bookings appear here as they come in.</p>
          <ButtonLink href={`/studio/${slug}/events/${id}`} variant="secondary" className="mt-6">Back to the event</ButtonLink>
        </div>
      )}
    </StudioShell>
  );
}
