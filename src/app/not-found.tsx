import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="shell flex min-h-[78vh] flex-col justify-center pb-16 pt-32">
      <p className="text-[15px] text-ink-muted">Page not found</p>
      <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.75rem,1.6rem+4vw,5.5rem)] font-normal leading-[0.98] text-ink-strong">
        This page has left the building.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-ink-muted">
        The event may have ended or its link changed. Everything that&apos;s on sale is one search away.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/events" size="lg">Explore events</ButtonLink>
        <ButtonLink href="/" variant="secondary" size="lg">Go to the homepage</ButtonLink>
      </div>
      <p className="mt-10 text-sm text-ink-subtle">
        Looking for your tickets? Open the link from your booking page, or <Link href="/saved" className="underline underline-offset-4">check your saved events</Link>.
      </p>
    </section>
  );
}
