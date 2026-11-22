import type { Metadata } from "next";
import { SavedList } from "./SavedList";

export const metadata: Metadata = { title: "Saved events" };

export default function SavedPage() {
  return (
    <div className="pb-24 pt-28 md:pt-36">
      <section className="shell">
        <h1 className="font-display text-[clamp(2.75rem,1.6rem+4vw,5rem)] font-normal leading-none text-ink-strong">Saved events</h1>
        <p className="mt-4 max-w-xl text-lg text-ink-muted">Events you&apos;re keeping an eye on. Sign in and they follow you to every device.</p>
      </section>
      <section className="shell mt-12" aria-label="Saved events">
        <SavedList />
      </section>
    </div>
  );
}
