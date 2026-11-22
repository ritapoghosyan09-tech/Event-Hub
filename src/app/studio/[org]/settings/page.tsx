import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOrgAccess } from "@/server/session";
import { getOrgSettings } from "@/server/studio";
import { NotInRole, StudioShell, StudioSkeleton } from "@/components/studio/StudioShell";
import { OrgForm } from "@/components/studio/OrgForm";
import { TeamManager } from "@/components/studio/TeamManager";
import { cardPaymentsEnabled } from "@/server/payments";

export const metadata: Metadata = { title: "Profile and team", robots: { index: false } };

export default function SettingsPage({ params }: PageProps<"/studio/[org]/settings">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const access = await requireOrgAccess(slug, `/studio/${slug}/settings`);
  const org = await getOrgSettings(access.org.id);
  return (
    <StudioShell org={access.org} role={access.role} current="settings" title="Profile and team">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="profile-title" className="rounded-card bg-surface p-6 ring-1 ring-line/60 md:p-8">
          <h2 id="profile-title" className="font-display text-2xl text-ink-strong">Public profile</h2>
          <div className="mt-6">
            {access.can("org:edit") ? <OrgForm org={org} /> : <NotInRole what="editing the profile" />}
          </div>
        </section>
        <div className="space-y-6">
          <section aria-labelledby="team-title" className="rounded-card bg-surface p-6 ring-1 ring-line/60 md:p-8">
            <h2 id="team-title" className="font-display text-2xl text-ink-strong">Team</h2>
            <p className="mt-2 text-[15px] text-ink-muted">Everyone here can open this studio. Door staff only see attendees and check tickets in.</p>
            <div className="mt-4">
              <TeamManager orgId={org.id} members={org.members} canManage={access.can("members:manage")} />
            </div>
          </section>
          <section aria-labelledby="payouts-title" className="rounded-card bg-surface p-6 ring-1 ring-line/60 md:p-8">
            <h2 id="payouts-title" className="font-display text-2xl text-ink-strong">Payments</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
              {cardPaymentsEnabled()
                ? "Buyers pay by card at checkout. EVENT HUB collects the payment and settles your share; automatic payouts to your own bank account are being set up."
                : "Paid tickets are reserved online and paid at the venue. Card payments switch on once EVENT HUB's payment account is connected."}
            </p>
          </section>
        </div>
      </div>
    </StudioShell>
  );
}
