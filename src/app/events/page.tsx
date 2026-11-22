import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getCategories, getCities, searchEvents, type EventFilters } from "@/server/discovery";
import { SearchBar } from "@/components/search/SearchBar";
import { FilterBar } from "@/components/search/FilterBar";
import { EventCard } from "@/components/event/EventCard";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { GridSkeleton } from "@/components/ui/Skeletons";
import { ButtonLink } from "@/components/ui/Button";
import { plural } from "@/lib/format";

export const metadata: Metadata = {
  title: "Explore events",
  description: "Search concerts, conferences, exhibitions, workshops and more by date, city, category and price.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

function parse(sp: Record<string, string | string[] | undefined>): EventFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const when = one("when");
  const price = one("price");
  return {
    q: one("q"),
    category: one("category"),
    city: one("city"),
    when: when && ["today", "weekend", "week", "month"].includes(when) ? (when as EventFilters["when"]) : undefined,
    price: price === "free" || price === "paid" ? price : undefined,
    sort: one("sort") === "price" ? "price" : "soonest",
  };
}

export default function EventsPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="pb-24 pt-28 md:pt-36">
      <section className="shell">
        <h1 className="font-display text-[clamp(2.75rem,1.6rem+4vw,5rem)] font-normal leading-none text-ink-strong">Explore events</h1>
        <p className="mt-4 max-w-xl text-lg text-ink-muted">Search everything on sale, then narrow it down by date, city, category and price.</p>
        <div className="mt-8">
          <Suspense fallback={<div className="skeleton h-[84px] rounded-sheet" />}>
            <Controls searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
      <section className="shell mt-10" aria-label="Results">
        <Suspense fallback={<><div className="skeleton mb-8 h-5 w-40 rounded-md" /><GridSkeleton /></>}>
          <Results searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function Controls({ searchParams }: { searchParams: SP }) {
  const [sp, categories, cities] = await Promise.all([searchParams, getCategories(), getCities()]);
  const f = parse(sp);
  return (
    <div className="space-y-6">
      <SearchBar size="compact" cities={cities.map((c) => c.city)} defaults={{ q: f.q, city: f.city, when: f.when, category: f.category }} />
      <FilterBar categories={categories} cities={cities.map((c) => c.city)} />
    </div>
  );
}

async function Results({ searchParams }: { searchParams: SP }) {
  const f = parse(await searchParams);
  const [events, categories] = await Promise.all([searchEvents(f), getCategories()]);
  const cat = categories.find((c) => c.slug === f.category);
  const key = JSON.stringify(f);
  const summary = [cat?.name, f.city && `in ${f.city}`, f.q && `matching “${f.q}”`].filter(Boolean).join(" ");

  if (!events.length) {
    return (
      <div className="rounded-sheet border border-dashed border-line bg-surface px-6 py-20 text-center">
        <h2 className="font-display text-display-sm text-ink-strong">Nothing matches these filters yet</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">Try a wider date range or another city. New events are published every week.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/events">Clear all filters</ButtonLink>
          <ButtonLink href="/events?when=month" variant="secondary">Next 30 days</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-8 text-[15px] text-ink-muted" aria-live="polite">
        <span className="font-semibold text-ink-strong">{plural(events.length, "event")}</span>
        {summary ? ` ${summary}` : " on sale"}
        {f.sort === "price" ? ", lowest price first" : ", soonest first"}
      </p>
      <Stagger key={key} className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" gap={0.05}>
        {events.map((e, i) => (
          <StaggerItem key={e.id}>
            <EventCard event={e} priority={i < 3} />
          </StaggerItem>
        ))}
      </Stagger>
      {events.length >= 60 && (
        <p className="mt-12 text-center text-ink-muted">
          Showing the first 60. <Link href="/events?when=week" className="underline underline-offset-4">Narrow by date</Link> to see more.
        </p>
      )}
    </>
  );
}
