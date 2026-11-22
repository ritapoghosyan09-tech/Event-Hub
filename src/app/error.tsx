"use client";

import { Button, ButtonLink } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="shell flex min-h-[70vh] flex-col justify-center pb-16 pt-32">
      <p className="text-[15px] text-ink-muted">Something went wrong</p>
      <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.6rem)] font-normal leading-[1] text-ink-strong">
        This page didn&apos;t load.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-ink-muted">It&apos;s on our side, not yours. Try again; if it keeps happening, come back in a few minutes.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button size="lg" onClick={() => reset()}>Try again</Button>
        <ButtonLink href="/" variant="secondary" size="lg">Go to the homepage</ButtonLink>
      </div>
    </section>
  );
}
