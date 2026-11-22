import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOrgAccess } from "@/server/session";
import { getStudioDashboard } from "@/server/studio";
import { StudioShell, StudioSkeleton, STATUS_STYLE } from "@/components/studio/StudioShell";
import { ButtonLink } from "@/components/ui/Button";
import { EventPhoto } from "@/components/event/EventCard";
import { dayLabel, formatMoney, timeLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Studio", robots: { index: false } };

export default function StudioHome({ params }: PageProps<"/studio/[org]">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const access = await requireOrgAccess(slug, `/studio/${slug}`);
  const { stats, upcoming, other } = await getStudioDashboard(access.org.id);
  const canCreate = access.can("event:create");

  const tiles = [
    { label: "Upcoming events", value: String(stats.upcoming), note: stats.drafts ? `${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}` : "No drafts" },
    { label: "Tickets issued", value: stats.tickets.toLocaleString("en-GB"), note: `${stats.checkedIn.toLocaleString("en-GB")} checked in` },
    {
      label: "Ticket revenue",
      value: stats.revenue.length ? stats.revenue.map((r) => formatMoney(r.amountMinor, r.currency)).join(" + ") : "None yet",
      note: "Confirmed bookings, online and at the venue",
    },
  ];

  return (
    <StudioShell
      org={access.org}
      role={access.role}
      current="overview"
      title={access.org.name}
      actions={canCreate ? <ButtonLink href={`/studio/${slug}/events/new`} variant="inverse" size="lg">New event</ButtonLink> : undefined}
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-card bg-surface p-6 ring-1 ring-line/60">
            <dt className="text-sm text-ink-muted">{t.label}</dt>
            <dd className="mt-2 font-display text-[2.4rem] leading-none text-ink-strong tabular-nums">{t.value}</dd>
            <dd className="mt-3 text-sm text-ink-subtle">{t.note}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-14" aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="font-display text-display-sm font-normal text-ink-strong">Upcoming and drafts</h2>
        {upcoming.length ? (
          <EventTable slug={slug} rows={upcoming} />
        ) : (
          <div className="mt-6 rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
            <p className="font-display text-2xl text-ink-strong">Nothing scheduled yet</p>
            <p className="mx-auto mt-2 max-w-sm text-ink-muted">Create an event, add its tickets and photos, then publish it when you&apos;re ready.</p>
            {canCreate && <ButtonLink href={`/studio/${slug}/events/new`} className="mt-6">Create an event</ButtonLink>}
          </div>
        )}
      </section>

      {other.length > 0 && (
        <section className="mt-14" aria-labelledby="past-title">
          <h2 id="past-title" className="font-display text-display-sm font-normal text-ink-strong">Past and cancelled</h2>
          <EventTable slug={slug} rows={other} />
        </section>
      )}
    </StudioShell>
  );
}

type Row = Awaited<ReturnType<typeof getStudioDashboard>>["upcoming"][number];

function EventTable({ slug, rows }: { slug: string; rows: Row[] }) {
  return (
    <ul className="mt-6 divide-y divide-line-subtle overflow-hidden rounded-card bg-surface ring-1 ring-line/60">
      {rows.map((r) => {
        const s = STATUS_STYLE[r.past && r.status === "PUBLISHED" ? "COMPLETED" : r.status];
        const pct = r.capacity ? Math.round((r.sold / r.capacity) * 100) : 0;
        const start = new Date(r.startsAt);
        return (
          <li key={r.id}>
            <Link href={`/studio/${slug}/events/${r.id}`} className="grid items-center gap-4 p-4 transition-colors hover:bg-sunken/60 sm:grid-cols-[96px_minmax(0,1fr)_200px_120px] sm:p-5">
              <EventPhoto id={`studio-${r.id}`} morph={false} zoom={false} image={r.image} sizes="96px" className="hidden aspect-[4/3] rounded-[10px] sm:block" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-tag px-2 py-0.5 text-xs font-semibold ${s.tone}`}>{s.label}</span>
                  {r.visibility === "UNLISTED" && <span className="rounded-tag bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted">Unlisted</span>}
                </div>
                <p className="mt-1.5 truncate font-semibold text-ink-strong">{r.title}</p>
                <p className="truncate text-sm text-ink-subtle">
                  {dayLabel(start, r.timezone)}, {timeLabel(start, r.timezone)}, {r.place}
                </p>
              </div>
              <div>
                <p className="text-sm text-ink-muted">
                  <span className="font-semibold text-ink-strong tabular-nums">{r.sold}</span> of {r.capacity} sold
                </p>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <span className="block h-full rounded-full bg-navy" style={{ width: `${pct}%` }} />
                </span>
              </div>
              <p className="text-sm font-semibold text-ink-strong tabular-nums sm:text-right">{r.revenueMinor ? formatMoney(r.revenueMinor, r.currency) : "Free"}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
