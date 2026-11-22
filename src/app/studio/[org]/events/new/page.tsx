import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOrgAccess } from "@/server/session";
import { getCategoryOptions, getOrgVenues } from "@/server/studio";
import { NotInRole, StudioShell, StudioSkeleton } from "@/components/studio/StudioShell";
import { EventForm } from "@/components/studio/EventForm";
import { timeZones } from "@/lib/timezone";

export const metadata: Metadata = { title: "New event", robots: { index: false } };

export default function NewEventPage({ params }: PageProps<"/studio/[org]/events/new">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <NewEvent params={params} />
    </Suspense>
  );
}

async function NewEvent({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const access = await requireOrgAccess(slug, `/studio/${slug}/events/new`);
  const shell = { org: access.org, role: access.role, title: "New event", crumbs: [{ href: `/studio/${slug}`, label: access.org.name }] };
  if (!access.can("event:create")) return <StudioShell {...shell}><NotInRole what="creating events" /></StudioShell>;
  const [categories, venues] = await Promise.all([getCategoryOptions(), getOrgVenues(access.org.id)]);
  return (
    <StudioShell {...shell}>
      <EventForm orgId={access.org.id} orgSlug={slug} categories={categories} venues={venues} timeZones={timeZones()} />
    </StudioShell>
  );
}
