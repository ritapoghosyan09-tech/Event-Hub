"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { EventCardData } from "@/server/discovery";
import { useSaved } from "@/lib/saved";
import { EventCard } from "@/components/event/EventCard";
import { GridSkeleton } from "@/components/ui/Skeletons";
import { ButtonLink } from "@/components/ui/Button";
import { EASE } from "@/components/motion/Reveal";

const noop = () => () => {};
function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function SavedList() {
  const ids = useSaved();
  const hydrated = useHydrated();
  const [data, setData] = useState<{ key: string; events: EventCardData[] } | null>(null);
  const [error, setError] = useState(false);
  const key = [...ids].sort().join(",");

  useEffect(() => {
    if (!key || (data && key.split(",").every((id) => data.key.split(",").includes(id)))) return;
    const ctrl = new AbortController();
    fetch(`/api/events?ids=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { events: EventCardData[] }) => {
        setData({ key, events: d.events });
        setError(false);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when new ids appear
  }, [key]);

  // Removing a save never needs a refetch: every remaining id is already loaded.
  const loaded = data ? new Set(data.key.split(",")) : null;
  const events = !key ? [] : loaded && ids.every((id) => loaded.has(id)) ? data!.events : null;

  if (error) {
    return <p className="rounded-card bg-surface p-8 text-ink-muted">Saved events couldn&apos;t be loaded. Check your connection and refresh the page.</p>;
  }
  if (!hydrated || events === null) return <GridSkeleton count={3} />;

  // Keep the order the visitor saved them in; drop ids whose events have ended or been removed.
  const visible = ids.map((id) => events.find((e) => e.id === id)).filter(Boolean) as EventCardData[];

  if (!visible.length) {
    return (
      <div className="rounded-sheet border border-dashed border-line bg-surface px-6 py-20 text-center">
        <svg viewBox="0 0 24 24" className="mx-auto size-10 text-ink-muted" aria-hidden>
          <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <h2 className="mt-5 font-display text-display-sm text-ink-strong">Nothing saved yet</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">Tap the heart on any event to keep it here while you decide.</p>
        <ButtonLink href="/events" className="mt-8">Explore events</ButtonLink>
      </div>
    );
  }

  return (
    <motion.ul layout className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {visible.map((e, i) => (
          <motion.li
            key={e.id}
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: i * 0.05 } }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
          >
            <EventCard event={e} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
