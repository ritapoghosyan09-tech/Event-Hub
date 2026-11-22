import type { Metadata } from "next";
import { atLeastOne } from "@/lib/static-params";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getOrganizer, getOrganizerSlugs } from "@/server/discovery";
import { EventCard } from "@/components/event/EventCard";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { GridSkeleton } from "@/components/ui/Skeletons";
import { plural } from "@/lib/format";
import { Monogram } from "@/components/ui/Monogram";

export async function generateStaticParams() {
  return atLeastOne(await getOrganizerSlugs());
}

export async function generateMetadata({ params }: PageProps<"/organizers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const o = await getOrganizer(slug);
  return o ? { title: o.name, description: o.bio ?? undefined } : { title: "Organizer not found" };
}

export default function OrganizerPage({ params }: PageProps<"/organizers/[slug]">) {
  return (
    <Suspense fallback={<div className="shell pt-36"><div className="skeleton h-24 w-24 rounded-full" /><div className="skeleton mt-6 h-14 w-2/3 rounded-md" /><div className="mt-12"><GridSkeleton count={3} /></div></div>}>
      <Organizer params={params} />
    </Suspense>
  );
}

async function Organizer({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const o = await getOrganizer(slug);
  if (!o) notFound();
  const stats = [
    [String(o.events.length), o.events.length === 1 ? "upcoming event" : "upcoming events"],
    [String(o.ticketsSold), "tickets booked on EVENT HUB"],
    [String(o.cities.length), o.cities.length === 1 ? "city" : "cities"],
  ];

  return (
    <div className="pb-24 pt-28 md:pt-36">
      <section className="shell">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-subtle">
          <Link href="/organizers" className="underline-offset-4 hover:text-ink hover:underline">Organizers</Link>
        </nav>
        <Reveal className="mt-8 grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Monogram name={o.name} size="lg" />
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[clamp(2.75rem,1.6rem+4vw,5rem)] font-normal leading-none text-ink-strong">{o.name}</h1>
              {o.verified && <span className="rounded-tag bg-accent-surface px-2.5 py-1 text-sm font-semibold text-ink-accent">Verified organizer</span>}
            </div>
            {o.bio && <p className="mt-5 max-w-2xl text-xl leading-relaxed text-ink-muted">{o.bio}</p>}
            {o.cities.length > 0 && <p className="mt-4 text-[15px] text-ink-subtle">Events in {o.cities.join(", ")}</p>}
          </div>
          <dl className="grid grid-cols-3 gap-4 lg:col-span-5">
            {stats.map(([n, l]) => (
              <div key={l} className="rounded-card bg-surface p-5">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-[2.6rem] leading-none text-ink-strong">{n}</dd>
                <dd className="mt-2 text-sm leading-snug text-ink-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <section className="shell mt-20" aria-label="Upcoming events">
        <h2 className="mb-10 font-display text-display-sm font-normal text-ink-strong">Upcoming events</h2>
        {o.events.length ? (
          <Stagger className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {o.events.map((e) => (
              <StaggerItem key={e.id}><EventCard event={e} /></StaggerItem>
            ))}
          </Stagger>
        ) : (
          <p className="rounded-card bg-surface p-8 text-ink-muted">
            {o.name} has nothing on sale right now. {o.pastEvents > 0 && `They have run ${plural(o.pastEvents, "event")} on EVENT HUB.`}
          </p>
        )}
      </section>
    </div>
  );
}
