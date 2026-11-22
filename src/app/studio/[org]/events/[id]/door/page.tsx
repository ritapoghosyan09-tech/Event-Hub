import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOrgAccess } from "@/server/session";
import { db } from "@/server/db";
import { NotInRole, StudioShell, StudioSkeleton } from "@/components/studio/StudioShell";
import { DoorScanner } from "@/components/studio/DoorScanner";

export const metadata: Metadata = { title: "Check-in", robots: { index: false } };

export default function DoorPage({ params }: PageProps<"/studio/[org]/events/[id]/door">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <Door params={params} />
    </Suspense>
  );
}

async function Door({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params;
  const access = await requireOrgAccess(slug, `/studio/${slug}/events/${id}/door`);
  const event = await db.event.findFirst({ where: { id, organizationId: access.org.id }, select: { id: true, title: true } });
  if (!event) notFound();
  const crumbs = [
    { href: `/studio/${slug}`, label: access.org.name },
    { href: `/studio/${slug}/events/${id}`, label: event.title },
  ];
  if (!access.can("tickets:checkin")) {
    return <StudioShell org={access.org} role={access.role} title="Check-in" crumbs={crumbs}><NotInRole what="checking tickets in" /></StudioShell>;
  }
  const [total, checkedIn] = await Promise.all([
    db.ticket.count({ where: { status: { not: "VOID" }, booking: { eventId: id, status: "CONFIRMED" } } }),
    db.ticket.count({ where: { status: "CHECKED_IN", booking: { eventId: id } } }),
  ]);
  return (
    <StudioShell org={access.org} role={access.role} title="Check-in" crumbs={crumbs}>
      <DoorScanner orgId={access.org.id} eventId={id} total={total} checkedIn={checkedIn} />
    </StudioShell>
  );
}
