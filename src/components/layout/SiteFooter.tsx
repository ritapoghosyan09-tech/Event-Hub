import Link from "next/link";
import { getCategories, getCities } from "@/server/discovery";

export async function SiteFooter() {
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  const demo = process.env.NEXT_PUBLIC_DEMO_CONTENT !== "false";

  return (
    <footer className="relative mt-auto overflow-hidden bg-night text-cream">
      <div className="shell grid gap-12 pb-10 pt-20 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.95]">EVENT HUB</p>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-[#c3cbd6]">
            Concerts, conferences, exhibitions and workshops in cities around the world, with tickets in a minute.
          </p>
        </div>

        <nav aria-label="Categories" className="md:col-span-3">
          <h2 className="text-sm font-semibold text-[#c3cbd6]">Explore</h2>
          <ul className="mt-4 space-y-2.5">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="text-[15px] text-cream/90 underline-offset-4 transition-colors hover:text-white hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Cities" className="md:col-span-2">
          <h2 className="text-sm font-semibold text-[#c3cbd6]">Cities</h2>
          <ul className="mt-4 space-y-2.5">
            {cities.slice(0, 8).map((c) => (
              <li key={c.city}>
                <Link href={`/events?city=${encodeURIComponent(c.city)}`} className="text-[15px] text-cream/90 underline-offset-4 hover:text-white hover:underline">
                  {c.city}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="EVENT HUB" className="md:col-span-2">
          <h2 className="text-sm font-semibold text-[#c3cbd6]">EVENT HUB</h2>
          <ul className="mt-4 space-y-2.5">
            <li><Link href="/events" className="text-[15px] text-cream/90 underline-offset-4 hover:text-white hover:underline">All events</Link></li>
            <li><Link href="/organizers" className="text-[15px] text-cream/90 underline-offset-4 hover:text-white hover:underline">Organizers</Link></li>
            <li><Link href="/saved" className="text-[15px] text-cream/90 underline-offset-4 hover:text-white hover:underline">Saved events</Link></li>
          </ul>
        </nav>
      </div>

      <div className="shell">
      <div className="flex flex-col gap-3 border-t border-cream/12 py-6 text-[13px] text-[#9aa6b5] md:flex-row md:items-center md:justify-between">
        <p>© 2026 EVENT HUB. Event photography by Pexels and Unsplash contributors.</p>
        {demo && <p>Events, venues and organizers shown are sample content for review.</p>}
      </div>
      </div>
    </footer>
  );
}
