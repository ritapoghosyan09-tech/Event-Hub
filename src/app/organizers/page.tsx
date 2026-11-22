import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getOrganizers } from "@/server/discovery";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { plural } from "@/lib/format";
import { Monogram } from "@/components/ui/Monogram";

export const metadata: Metadata = {
  title: "Organizers",
  description: "The promoters, studios, collectives and conference teams selling tickets on EVENT HUB.",
};

const TYPE: Record<string, string> = { INDIVIDUAL: "Independent organizer", BUSINESS: "Company", COMMUNITY: "Community", NONPROFIT: "Nonprofit" };

export default async function OrganizersPage() {
  const orgs = await getOrganizers();
  return (
    <div className="pb-24 pt-28 md:pt-36">
      <section className="shell">
        <h1 className="font-display text-[clamp(2.75rem,1.6rem+4vw,5rem)] font-normal leading-none text-ink-strong">Organizers</h1>
        <p className="mt-4 max-w-xl text-lg text-ink-muted">
          {plural(orgs.length, "organizer")} selling tickets on EVENT HUB, from ceramics studios to conference teams.
        </p>
      </section>
      <Stagger as="ul" className="shell mt-12 grid gap-6 md:grid-cols-2">
        {orgs.map((o, i) => {
          return (
            <StaggerItem as="li" key={o.slug}>
              <Link href={`/organizers/${o.slug}`} className="group grid h-full overflow-hidden rounded-card bg-surface shadow-rest transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-hover sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <span className="relative block aspect-[16/9] overflow-hidden bg-night-soft sm:aspect-auto sm:min-h-[240px]">
                  {o.image && <Image src={o.image.src} alt={o.image.alt} priority={i < 2} fill sizes="(min-width:768px) 25vw, 100vw" className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.05]" />}
                  <Monogram name={o.name} size="sm" tone="cream" className="absolute bottom-4 left-4" />
                </span>
                <span className="flex flex-col p-6">
                  <span className="text-xs font-semibold text-ink-muted">{TYPE[o.type]}{o.verified ? ", verified" : ""}</span>
                  <span className="mt-2 font-display text-[1.7rem] leading-tight text-ink-strong">{o.name}</span>
                  {o.bio && <span className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-ink-muted">{o.bio}</span>}
                  <span className="mt-auto pt-5 text-sm text-ink-subtle">
                    <span className="font-semibold text-ink-strong">{plural(o.upcoming, "upcoming event")}</span>
                    {o.cities.length > 0 && ` in ${o.cities.join(", ")}`}
                  </span>
                </span>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
