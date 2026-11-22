import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCategories, getCategory, searchEvents } from "@/server/discovery";
import { artFor } from "@/lib/categories";
import { plural } from "@/lib/format";
import { EventCard } from "@/components/event/EventCard";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { GridSkeleton } from "@/components/ui/Skeletons";
import { ButtonLink } from "@/components/ui/Button";
import { CategoryHeroText } from "./CategoryHeroText";

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategory(slug);
  return c ? { title: c.name, description: artFor(slug).line } : { title: "Category not found" };
}

export default function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  return (
    <Suspense fallback={<div className="skeleton h-[62vh] min-h-[460px]" />}>
      <Category params={params} />
    </Suspense>
  );
}

async function Category({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [cat, all] = await Promise.all([getCategory(slug), getCategories()]);
  if (!cat) notFound();
  const art = artFor(slug);
  const others = all.filter((c) => c.slug !== slug);

  return (
    <>
      <section className="relative isolate flex min-h-[max(520px,64vh)] items-end overflow-hidden bg-night text-cream" style={{ backgroundColor: art.tone }}>
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="drift absolute inset-0">
            <Image src={art.image} alt="" fill priority sizes="100vw" className="object-cover" />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,31,45,.55)_0%,rgba(20,31,45,.25)_40%,rgba(20,31,45,.9)_100%)]" />
        </div>
        <div className="shell pb-14 pt-36">
          <CategoryHeroText name={cat.name} line={art.line} count={plural(cat.upcoming, "upcoming event")} />
        </div>
      </section>

      <section className="shell py-16 md:py-20" aria-label={`${cat.name} events`}>
        <Suspense fallback={<GridSkeleton />}>
          <CategoryEvents slug={slug} name={cat.name} />
        </Suspense>
      </section>

      <section className="border-t border-line py-16 md:py-20" aria-label="Other categories">
        <div className="shell">
          <h2 className="font-display text-display-sm font-normal text-ink-strong">Other categories</h2>
          <ul className="mt-8 flex flex-wrap gap-3">
            {others.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="group flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
                >
                  <span className="relative size-10 overflow-hidden rounded-full" style={{ backgroundColor: artFor(c.slug).tone }}>
                    <Image src={artFor(c.slug).image} alt="" fill sizes="40px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
                  </span>
                  <span className="font-medium text-ink-strong">{c.name}</span>
                  <span className="text-sm text-ink-subtle">{c.upcoming}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

async function CategoryEvents({ slug, name }: { slug: string; name: string }) {
  const events = await searchEvents({ category: slug });
  if (!events.length) {
    return (
      <div className="rounded-sheet border border-dashed border-line bg-surface px-6 py-16 text-center">
        <h2 className="font-display text-display-sm text-ink-strong">No {name.toLowerCase()} events on sale right now</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">Organizers publish new events every week. Browse everything else in the meantime.</p>
        <ButtonLink href="/events" className="mt-8">Explore all events</ButtonLink>
      </div>
    );
  }
  return (
    <>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-display-sm font-normal text-ink-strong">Everything on sale</h2>
        <Link href={`/events?category=${slug}`} className="text-sm font-semibold underline decoration-ink/25 underline-offset-[6px] hover:decoration-ink">
          Filter by date, city and price
        </Link>
      </div>
      <Stagger className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e, i) => (
          <StaggerItem key={e.id}><EventCard event={e} priority={i < 3} /></StaggerItem>
        ))}
      </Stagger>
    </>
  );
}
