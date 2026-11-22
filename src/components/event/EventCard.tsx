import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import type { EventCardData } from "@/server/discovery";
import { dayLabel, priceLabel, timeLabel } from "@/lib/format";
import { DateStub } from "./DateStub";
import { SaveButton } from "./SaveButton";

/** Low availability is a fact worth showing; anything else is noise. */
export function availabilityNote(e: Pick<EventCardData, "remaining" | "capacity">) {
  if (e.capacity === 0) return null;
  if (e.remaining === 0) return { tone: "off", text: "Sold out" } as const;
  if (e.remaining <= Math.max(10, e.capacity * 0.08)) return { tone: "warn", text: `${e.remaining} left` } as const;
  return null;
}

export function Badge({ tone, children }: { tone: "warn" | "ok" | "off" | "lav"; children: React.ReactNode }) {
  const tones = {
    warn: "text-warning bg-[#f6ecd9]",
    ok: "text-success bg-[#e4eee7]",
    off: "text-ink-subtle bg-line-subtle",
    lav: "text-ink-accent bg-accent-surface",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-tag px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

/** The event photo, named for the shared-element morph into the detail page. */
export function EventPhoto({
  id,
  image,
  sizes,
  priority,
  className = "",
  zoom = true,
  morph = true,
}: {
  id: string;
  image: EventCardData["image"];
  sizes: string;
  priority?: boolean;
  className?: string;
  zoom?: boolean;
  /** Only one copy of an event per page may carry the shared-element name. */
  morph?: boolean;
}) {
  const photo = (
      <div className={`relative overflow-hidden bg-night-soft ${className}`}>
        {image && (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={sizes}
            priority={priority}
            className={`object-cover ${zoom ? "transition-transform duration-[900ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.05]" : ""}`}
          />
        )}
      </div>
  );
  if (!morph) return photo;
  return (
    <ViewTransition name={`photo-${id}`} share="event-photo" default="none">
      {photo}
    </ViewTransition>
  );
}

/** Default card: the ticket stub — photo, perforation, date stub. */
export function EventCard({
  event,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  priority,
  tearBg,
}: {
  event: EventCardData;
  sizes?: string;
  priority?: boolean;
  tearBg?: string;
}) {
  const start = new Date(event.startsAt);
  const note = availabilityNote(event);
  return (
    <article className="group relative flex h-full flex-col rounded-card bg-surface shadow-rest transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-1 hover:shadow-hover">
      <div className="relative">
        <EventPhoto id={event.id} image={event.image} sizes={sizes} priority={priority} className="aspect-[4/3] rounded-t-card" />
        <span className="absolute left-3 top-3 rounded-full bg-night/70 px-3 py-1 text-xs font-medium text-cream backdrop-blur-[2px]">
          {event.category.name}
        </span>
        <SaveButton eventId={event.id} title={event.title} className="absolute right-3 top-3 z-10" />
      </div>
      <div className="tear" style={tearBg ? ({ "--tear-bg": tearBg } as React.CSSProperties) : undefined} aria-hidden />
      <div className="grid flex-1 grid-cols-[auto_minmax(0,1fr)] gap-4 p-5">
        <DateStub iso={event.startsAt} timezone={event.timezone} />
        <div className="flex min-w-0 flex-col">
          <h3 className="text-lg font-semibold leading-snug text-ink-strong">
            <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
              {event.title}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-ink-subtle">
            <span className="sr-only">{dayLabel(start, event.timezone)}, </span>
            {timeLabel(start, event.timezone)} at {event.venueName}, {event.city}
          </p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
            <span className="whitespace-nowrap font-semibold">{priceLabel(event)}</span>
            {note && <Badge tone={note.tone}>{note.text}</Badge>}
          </div>
        </div>
      </div>
    </article>
  );
}
