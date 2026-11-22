import Image from "next/image";
import Link from "next/link";
import type { EventCardData } from "@/server/discovery";
import { artFor } from "@/lib/categories";
import { dayLabel, plural, priceLabel, timeLabel } from "@/lib/format";
import { EventCard, EventPhoto, availabilityNote } from "@/components/event/EventCard";
import { SaveButton } from "@/components/event/SaveButton";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Scroller } from "./Scroller";

export function SectionHead({
  id,
  title,
  lead,
  action,
  tone = "light",
}: {
  id?: string;
  title: string;
  lead?: string;
  action?: { href: string; label: string };
  tone?: "light" | "dark";
}) {
  return (
    <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <div className="max-w-2xl">
        <h2 id={id} className={`font-display text-display-sm font-normal md:text-[3.25rem] ${tone === "dark" ? "text-cream" : "text-ink-strong"}`}>{title}</h2>
        {lead && <p className={`mt-3 text-lg ${tone === "dark" ? "text-[#c3cbd6]" : "text-ink-muted"}`}>{lead}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className={`group/a inline-flex items-center gap-2 text-sm font-semibold underline decoration-1 underline-offset-[6px] transition-[text-decoration-color] ${
            tone === "dark" ? "text-cream decoration-cream/30 hover:decoration-cream" : "text-ink decoration-ink/25 hover:decoration-ink"
          }`}
        >
          {action.label}
        </Link>
      )}
    </Reveal>
  );
}

/* ── Categories: tall photographic tiles ───────────────────────────── */
export function CategoryRail({ categories }: { categories: { slug: string; name: string; upcoming: number }[] }) {
  return (
    <section className="py-20 md:py-28" aria-labelledby="cat-title">
      <div className="shell">
        <SectionHead id="cat-title" title="Explore by category" lead="Seven ways into a city's calendar, each with its own pace and crowd." />
      </div>
      <Scroller label="Categories">
        {categories.map((c, i) => {
          const art = artFor(c.slug);
          return (
            <Reveal key={c.slug} delay={i * 0.05} className="w-[72vw] shrink-0 snap-start sm:w-[300px] lg:w-[calc((100%-4*20px)/5)]">
              <Link
                href={`/categories/${c.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-card"
                style={{ backgroundColor: art.tone }}
              >
                <Image src={art.image} alt="" fill sizes="(min-width:1024px) 20vw, 72vw" className="object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.07]" />
                <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,31,45,0)_30%,rgba(20,31,45,.88)_100%)] transition-opacity duration-500 group-hover:opacity-95" />
                <span className="absolute inset-x-0 bottom-0 p-5 text-cream">
                  <span className="block font-display text-[1.75rem] leading-[1.05]">{c.name}</span>
                  <span className="mt-2 block text-sm text-[#d5dbe3]">{plural(c.upcoming, "upcoming event")}</span>
                  <span className="mt-2 block max-h-0 overflow-hidden text-sm leading-snug text-[#c3cbd6] opacity-0 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:max-h-12 group-hover:opacity-100 group-focus-visible:max-h-12 group-focus-visible:opacity-100">
                    {art.line}
                  </span>
                </span>
              </Link>
            </Reveal>
          );
        })}
      </Scroller>
    </section>
  );
}

/* ── Featured: one large editorial feature + a stacked column ──────── */
export function FeaturedEditorial({ events }: { events: EventCardData[] }) {
  if (!events.length) return null;
  const [lead, ...rest] = events;
  const start = new Date(lead.startsAt);
  return (
    <section className="bg-surface py-20 md:py-28" aria-labelledby="featured-title">
      <div className="shell">
        <SectionHead id="featured-title" title="Featured this month" lead="Chosen by the EVENT HUB team for what they bring to their city." action={{ href: "/events", label: "Browse all events" }} />
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-7">
            <article className="group relative h-full overflow-hidden rounded-card bg-night text-cream">
              <EventPhoto id={lead.id} image={lead.image} sizes="(min-width:1024px) 58vw, 100vw" className="aspect-[4/5] sm:aspect-[16/11] lg:aspect-auto lg:h-full lg:min-h-[620px]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,31,45,0)_35%,rgba(20,31,45,.92)_100%)]" />
              <SaveButton eventId={lead.id} title={lead.title} className="absolute right-4 top-4 z-10" />
              <div className="absolute inset-x-0 bottom-0 p-6 md:p-9">
                <p className="text-sm text-[#d5dbe3]">{lead.category.name}, presented by {lead.organizer.name}</p>
                <h3 className="mt-3 max-w-xl font-display text-[clamp(2rem,1.2rem+2.4vw,3.4rem)] font-normal leading-[1.02]">
                  <Link href={`/events/${lead.slug}`} className="after:absolute after:inset-0">{lead.title}</Link>
                </h3>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#d5dbe3]">{lead.summary}</p>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="font-semibold">{dayLabel(start, lead.timezone)}, {timeLabel(start, lead.timezone)}</span>
                  <span className="text-[#d5dbe3]">{lead.venueName}, {lead.city}</span>
                  <span className="font-semibold">{priceLabel(lead)}</span>
                </div>
              </div>
            </article>
          </Reveal>
          <Stagger className="flex flex-col gap-6 lg:col-span-5">
            {rest.slice(0, 3).map((e) => {
              const s = new Date(e.startsAt);
              return (
                <StaggerItem key={e.id}>
                  <article className="group relative grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] overflow-hidden rounded-card bg-canvas transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-hover">
                    <EventPhoto id={e.id} image={e.image} sizes="(min-width:1024px) 18vw, 45vw" className="h-full min-h-[180px]" />
                    <div className="flex flex-col p-5">
                      <p className="text-xs font-semibold text-ink-muted">{e.category.name}</p>
                      <h3 className="mt-2 font-display text-[1.45rem] leading-[1.1] text-ink-strong">
                        <Link href={`/events/${e.slug}`} className="after:absolute after:inset-0">{e.title}</Link>
                      </h3>
                      <p className="mt-auto pt-4 text-sm text-ink-subtle">
                        {dayLabel(s, e.timezone)} in {e.city}
                      </p>
                      <p className="mt-1 text-sm font-semibold">{priceLabel(e)}</p>
                    </div>
                  </article>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </div>
    </section>
  );
}

/* ── This weekend: a horizontal row of ticket stubs ───────────────── */
export function WeekendStrip({ events }: { events: EventCardData[] }) {
  if (!events.length) return null;
  return (
    <section className="py-20 md:py-28" aria-label="This weekend">
      <div className="shell">
        <SectionHead
          title="This weekend"
          lead={`${plural(events.length, "event")} from Friday evening to Sunday night, in each venue's local time.`}
          action={{ href: "/events?when=weekend", label: "See the whole weekend" }}
        />
      </div>
      <Scroller label="This weekend">
        {events.map((e, i) => (
          <Reveal key={e.id} delay={Math.min(i, 5) * 0.06} className="w-[82vw] shrink-0 snap-start sm:w-[340px]">
            <EventCard event={e} sizes="340px" />
          </Reveal>
        ))}
      </Scroller>
    </section>
  );
}

/* ── Trending: a ranking, so it reads as a numbered list ───────────── */
export function TrendingList({ events }: { events: (EventCardData & { ticketsThisWeek: number; savesThisWeek: number })[] }) {
  if (!events.length) return null;
  return (
    <section className="bg-night py-20 text-cream md:py-28" aria-labelledby="trending-title">
      <div className="shell grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <SectionHead id="trending-title" tone="dark" title="Trending now" lead="Ranked by tickets booked and saves in the last seven days." />
            <ButtonLink href="/events" variant="ghost-inverse" className="-mt-2">Explore everything on sale</ButtonLink>
          </div>
        </div>
        <Stagger as="ol" className="divide-y divide-cream/12 border-y border-cream/12 lg:col-span-8">
          {events.map((e, i) => {
            const s = new Date(e.startsAt);
            const note = availabilityNote(e);
            return (
              <StaggerItem as="li" key={e.id}>
                <article className="group relative grid grid-cols-[2.5rem_88px_minmax(0,1fr)] items-center gap-4 py-5 transition-colors duration-300 sm:grid-cols-[3.5rem_132px_minmax(0,1fr)_auto] sm:gap-6 hover:bg-cream/[0.04]">
                  <span className="font-display text-[2.4rem] leading-none text-cream/45 transition-colors group-hover:text-lavender sm:text-[3rem]">{i + 1}</span>
                  <EventPhoto id={e.id} image={e.image} sizes="132px" morph={false} className="aspect-[4/3] rounded-[10px]" />
                  <div className="min-w-0">
                    <h3 className="font-display text-[1.3rem] leading-tight sm:text-[1.55rem]">
                      <Link href={`/events/${e.slug}`} className="after:absolute after:inset-0">{e.title}</Link>
                    </h3>
                    <p className="mt-1 text-sm text-[#b9c3cf]">
                      {dayLabel(s, e.timezone)} in {e.city}
                    </p>
                    <p className="mt-1 text-sm text-[#d5dbe3] sm:hidden">{plural(e.ticketsThisWeek, "ticket")} booked this week</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold">{plural(e.ticketsThisWeek, "ticket")} this week</p>
                    <p className="mt-1 text-sm text-[#b9c3cf]">{note ? note.text : priceLabel(e)}</p>
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

/* ── Coming up: the standard card grid ─────────────────────────────── */
export function UpcomingGrid({ events }: { events: EventCardData[] }) {
  if (!events.length) return null;
  return (
    <section className="py-20 md:py-28" aria-label="Coming up">
      <div className="shell">
        <SectionHead title="Coming up" lead="The next events on sale, soonest first." action={{ href: "/events", label: "See all events" }} />
        <Stagger className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <StaggerItem key={e.id}>
              <EventCard event={e} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ── Cities: a typographic index ───────────────────────────────────── */
export function CityIndex({ cities }: { cities: { city: string; upcoming: number }[] }) {
  if (!cities.length) return null;
  return (
    <section className="border-t border-line py-20 md:py-28" aria-label="Cities">
      <div className="shell">
        <SectionHead title="Where it's happening" lead="Every city with events on sale right now." />
        <Stagger as="ul" className="flex flex-wrap items-baseline gap-x-8 gap-y-3 md:gap-x-12" gap={0.04}>
          {cities.map((c) => (
            <StaggerItem as="li" key={c.city}>
              <Link
                href={`/events?city=${encodeURIComponent(c.city)}`}
                className="group inline-flex items-start gap-1.5 font-display text-[clamp(2.2rem,1.4rem+2.6vw,4.2rem)] leading-[1.1] text-ink-strong transition-colors hover:text-ink-muted"
              >
                <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:bg-[length:100%_1px]">
                  {c.city}
                </span>
                <sup className="mt-3 font-sans text-sm font-semibold text-ink-muted">{c.upcoming}</sup>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ── For organizers ────────────────────────────────────────────────── */
export function OrganizerBand({ organizers }: { organizers: number }) {
  const facts = [
    ["Ticket types with limits", "General admission, tables, student passes: each with its own price, quantity and per-order limit."],
    ["Live availability", "Every booking updates what's left in the same instant, so a room never sells twice."],
    ["One page per organizer", "Your upcoming events, past events and tickets sold, in one place to share."],
  ];
  return (
    <section className="relative overflow-hidden bg-sunken py-20 md:py-28">
      <div className="shell grid gap-12 lg:grid-cols-12 lg:items-center">
        <Reveal className="lg:col-span-5">
          <h2 className="font-display text-display-sm font-normal text-ink-strong md:text-[3.25rem]">Run events people come back for</h2>
          <p className="mt-4 text-lg text-ink-muted">
            {organizers} organizers already sell on EVENT HUB, from small studios to conference teams. Organizer sign-up opens with the organizer studio.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/organizers" size="lg">Meet the organizers</ButtonLink>
          </div>
        </Reveal>
        <Stagger as="ul" className="grid gap-4 lg:col-span-6 lg:col-start-7">
          {facts.map(([t, d]) => (
            <StaggerItem as="li" key={t}>
              <div className="rounded-card bg-surface p-6 transition-transform duration-300 hover:-translate-y-0.5">
                <div>
                  <span className="mb-4 block h-[3px] w-8 rounded-full bg-lavender" aria-hidden />
                  <h3 className="text-lg font-semibold text-ink-strong">{t}</h3>
                  <p className="mt-1.5 text-[15px] text-ink-muted">{d}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

