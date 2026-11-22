import { Hero } from "@/components/home/Hero";
import {
  CategoryRail,
  CityIndex,
  FeaturedEditorial,
  OrganizerBand,
  TrendingList,
  UpcomingGrid,
  WeekendStrip,
} from "@/components/home/Sections";
import { ButtonLink } from "@/components/ui/Button";
import {
  getCategories,
  getCities,
  getFeatured,
  getStats,
  getThisWeekend,
  getTrending,
  getUpcoming,
} from "@/server/discovery";

export default async function HomePage() {
  const [featured, categories, cities, stats, weekend, trending] = await Promise.all([
    getFeatured(5),
    getCategories(),
    getCities(),
    getStats(),
    getThisWeekend(10),
    getTrending(6),
  ]);
  const featuredIds = new Set(featured.map((e) => e.id));
  const weekendOnly = weekend.filter((e) => !featuredIds.has(e.id));
  const shown = [...featured, ...weekendOnly].map((e) => e.id);
  const upcoming = await getUpcoming(6, shown);

  if (stats.events === 0) {
    return (
      <section className="shell flex min-h-[70vh] flex-col items-start justify-center pt-28">
        <h1 className="font-display text-display-md text-ink-strong">No events are on sale yet</h1>
        <p className="mt-4 max-w-xl text-lg text-ink-muted">
          When organizers publish their first events they appear here. Run the demo seed to preview the experience with sample events.
        </p>
        <ButtonLink href="/organizers" className="mt-8">See organizers</ButtonLink>
      </section>
    );
  }

  return (
    <>
      <Hero featured={featured.length ? featured : upcoming.slice(0, 3)} cities={cities.map((c) => c.city)} stats={stats} />
      <CategoryRail categories={categories} />
      <FeaturedEditorial events={featured} />
      <WeekendStrip events={weekendOnly} />
      <TrendingList events={trending} />
      <UpcomingGrid events={upcoming} />
      <CityIndex cities={cities} />
      <OrganizerBand organizers={stats.organizers} />
    </>
  );
}
