import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEvent, getEventSlugs } from "@/server/discovery";
import { EventCard, EventPhoto } from "@/components/event/EventCard";
import { SaveButton } from "@/components/event/SaveButton";
import { TicketPanel } from "@/components/event/TicketPanel";
import { CheckoutNotice } from "@/components/event/CheckoutNotice";
import { cardPaymentsEnabled } from "@/server/payments";
import { Gallery } from "@/components/event/Gallery";
import { MobileBookBar } from "@/components/event/MobileBookBar";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { EventDetailSkeleton } from "@/components/ui/Skeletons";
import { Monogram } from "@/components/ui/Monogram";
import { cityTimeZoneNote, longDate, priceLabel, timeRange } from "@/lib/format";

export async function generateStaticParams() {
  return (await getEventSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEvent(slug);
  if (!e) return { title: "Event not found" };
  return {
    title: e.title,
    description: e.summary,
    openGraph: { title: e.title, description: e.summary, images: e.images[0] ? [{ url: e.images[0].src }] : [] },
    robots: e.visibility === "UNLISTED" || e.status === "CANCELLED" ? { index: false } : undefined,
  };
}

export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<EventDetailSkeleton />}>
      <EventContent params={params} />
    </Suspense>
  );
}

function Fact({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-ink" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold text-ink-strong">{title}</p>
        <div className="mt-0.5 text-[15px] text-ink-subtle">{children}</div>
      </div>
    </div>
  );
}

const icons = {
  date: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" /></svg>,
  place: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>,
  ticket: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z" /><path d="M14 6v12" strokeDasharray="2 2" /></svg>,
};

async function EventContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await getEvent(slug);
  if (!e) notFound();

  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  const cover = e.images[0] ?? null;
  const paragraphs = e.description.split(/\n{2,}/);
  const mapsQuery = e.venue ? encodeURIComponent(`${e.venue.name}, ${e.venue.address}, ${e.venue.city}`) : "";
  const d = 0.008;
  const pin = e.venue && e.venue.lat != null && e.venue.lng != null ? { lat: e.venue.lat, lng: e.venue.lng } : null;
  const bbox = pin ? `${pin.lng - d * 1.6},${pin.lat - d},${pin.lng + d * 1.6},${pin.lat + d}` : "";

  return (
    <article className="pb-24 pt-24 md:pt-28">
      <div className="shell">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-subtle">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/events" className="underline-offset-4 hover:text-ink hover:underline">Events</Link></li>
            <li aria-hidden>/</li>
            <li><Link href={`/categories/${e.category.slug}`} className="underline-offset-4 hover:text-ink hover:underline">{e.category.name}</Link></li>
          </ol>
        </nav>

        <div className="relative mt-5">
          <EventPhoto id={e.id} image={cover} sizes="(min-width:1280px) 1240px, 100vw" priority zoom={false} className="aspect-[4/3] rounded-sheet sm:aspect-[16/9] lg:aspect-[21/9]" />
          <SaveButton eventId={e.id} title={e.title} className="absolute right-4 top-4 z-10" />
        </div>
      </div>

      <div className="shell mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-x-14 lg:gap-y-0">
        <div className="lg:col-span-7 lg:row-start-1">
          <Reveal>
            <p className="text-[15px] text-ink-muted">
              {e.category.name}, presented by{" "}
              <Link href={`/organizers/${e.organizer.slug}`} className="font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
                {e.organizer.name}
              </Link>
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.5rem,1.4rem+3.6vw,4.4rem)] font-normal leading-[1.02] text-ink-strong">{e.title}</h1>
            <p className="mt-6 max-w-[60ch] text-xl leading-relaxed text-ink-muted">{e.summary}</p>
          </Reveal>

          <Reveal className="mt-10 grid gap-6 rounded-card bg-surface p-6 sm:grid-cols-2 md:p-8" delay={0.08}>
            <Fact icon={icons.date} title={longDate(start, e.timezone)}>
              {timeRange(start, end, e.timezone)}, {cityTimeZoneNote(e.timezone)}
            </Fact>
            {e.venue && (
              <Fact icon={icons.place} title={e.venue.name}>
                {e.venue.address}, {e.venue.city}
              </Fact>
            )}
            <Fact icon={icons.ticket} title={priceLabel(e)}>
              {e.refundPolicy ?? "Refunds at the organizer's discretion."}
            </Fact>
            <Fact
              icon={<svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" strokeLinecap="round" /></svg>}
              title={e.ageRestriction ? `Ages ${e.ageRestriction} and over` : "All ages welcome"}
            >
              {e.saves > 0 ? `${e.saves} ${e.saves === 1 ? "person has" : "people have"} saved this event` : "Hosted by " + e.organizer.name}
            </Fact>
          </Reveal>
        </div>

        <aside className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1" aria-label="Tickets">
          <div className="lg:sticky lg:top-28">
            <Suspense fallback={null}>
              <CheckoutNotice />
            </Suspense>
            <TicketPanel event={e} cardPayments={cardPaymentsEnabled()} />
          </div>
        </aside>

        <div className="lg:col-span-7 lg:row-start-2">
          <Reveal className="lg:mt-14">
            <h2 className="font-display text-display-sm font-normal text-ink-strong">About this event</h2>
            <div className="mt-5 max-w-[66ch] space-y-5 text-[17px] leading-[1.75] text-ink">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </Reveal>

          {e.images.length > 1 && (
            <Reveal className="mt-14">
              <h2 className="font-display text-display-sm font-normal text-ink-strong">Photos</h2>
              <div className="mt-5"><Gallery images={e.images} /></div>
            </Reveal>
          )}

          {e.venue && (
            <Reveal className="mt-14">
              <h2 className="font-display text-display-sm font-normal text-ink-strong">Getting there</h2>
              <div className="mt-5 overflow-hidden rounded-card bg-surface ring-1 ring-line/60">
                {pin && (
                  <iframe
                    title={`Map showing ${e.venue.name}`}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${pin.lat},${pin.lng}`}
                    className="block h-[320px] w-full border-0 [filter:grayscale(.55)_sepia(.18)_contrast(.95)_brightness(1.02)]"
                    loading="lazy"
                  />
                )}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-semibold text-ink-strong">{e.venue.name}</p>
                    <p className="text-[15px] text-ink-subtle">{e.venue.address}, {e.venue.city}</p>
                  </div>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full border border-navy px-5 text-sm font-semibold text-ink transition-colors hover:bg-navy hover:text-cream">
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal className="mt-14">
            <h2 className="font-display text-display-sm font-normal text-ink-strong">Your host</h2>
            <Link href={`/organizers/${e.organizer.slug}`} className="group mt-5 flex items-start gap-5 rounded-card bg-surface p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-hover">
              <Monogram name={e.organizer.name} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-ink-strong">{e.organizer.name}</span>
                  {e.organizer.verified && <span className="rounded-tag bg-accent-surface px-2 py-0.5 text-xs font-semibold text-ink-accent">Verified organizer</span>}
                </span>
                {e.organizer.bio && <span className="mt-1.5 block text-[15px] leading-relaxed text-ink-muted">{e.organizer.bio}</span>}
                <span className="mt-3 block text-sm font-semibold text-ink underline decoration-ink/25 underline-offset-4 group-hover:decoration-ink">
                  {e.organizer.upcoming} upcoming {e.organizer.upcoming === 1 ? "event" : "events"}
                </span>
              </span>
            </Link>
          </Reveal>
        </div>
      </div>

      {e.related.length > 0 && (
        <section className="mt-24 border-t border-line pt-20" aria-label={`More ${e.category.name}`}>
          <div className="shell">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-display-sm font-normal text-ink-strong md:text-[2.75rem]">More in {e.category.name}</h2>
              <Link href={`/categories/${e.category.slug}`} className="text-sm font-semibold underline decoration-ink/25 underline-offset-[6px] hover:decoration-ink">
                See all {e.category.name.toLowerCase()}
              </Link>
            </div>
            <Stagger className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {e.related.map((r) => (
                <StaggerItem key={r.id}><EventCard event={r} /></StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {e.upcoming && <MobileBookBar price={priceLabel(e)} label={e.isFree ? "Get free tickets" : "Get tickets"} target={`tickets-${e.slug}`} />}
    </article>
  );
}
