import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/server/session";
import { OrgForm } from "@/components/studio/OrgForm";

export const metadata: Metadata = { title: "Start hosting", robots: { index: false } };

export default function NewOrganizationPage() {
  return (
    <div className="shell grid gap-12 pb-24 pt-28 md:pt-36 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <h1 className="font-display text-[clamp(2.6rem,1.8rem+2.6vw,4.2rem)] font-normal leading-[1.02] text-ink-strong">Start hosting on EVENT HUB</h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
          Create the profile people see on your events. Then add an event, its tickets and photos, and publish it when it&apos;s ready.
        </p>
        <ul className="mt-8 max-w-md space-y-3 text-[15px] text-ink">
          <li className="border-t border-line pt-3">Free events cost nothing to run.</li>
          <li className="border-t border-line pt-3">Invite your team, and give door staff check-in only.</li>
          <li className="border-t border-line pt-3">See bookings, export attendee lists and scan tickets at the door.</li>
        </ul>
      </div>
      <div className="rounded-sheet bg-surface p-6 ring-1 ring-line/60 md:p-10">
        <Suspense fallback={<div className="skeleton h-96 rounded-card" />}>
          <NewOrg />
        </Suspense>
      </div>
    </div>
  );
}

async function NewOrg() {
  const user = await requireUser("/studio/new");
  return <OrgForm defaultEmail={user.email} />;
}
