import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import QRCode from "qrcode";
import { getBookingByCode } from "@/server/bookings";
import { EventPhoto } from "@/components/event/EventCard";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { SuccessMark } from "@/components/event/SuccessMark";
import { formatMoney, longDate, timeRange, cityTimeZoneNote } from "@/lib/format";
import { DateStub } from "@/components/event/DateStub";
import { PendingRefresh } from "./PendingRefresh";

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

export default function BookingPage({ params }: PageProps<"/bookings/[code]">) {
  return (
    <Suspense fallback={<div className="shell min-h-[70vh] pt-36"><div className="skeleton h-14 w-2/3 rounded-md" /><div className="skeleton mt-8 h-72 rounded-sheet" /></div>}>
      <Booking params={params} />
    </Suspense>
  );
}

async function Booking({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const b = await getBookingByCode(code);
  if (!b) notFound();
  if (b.status !== "CONFIRMED") return <BookingStatus b={b} />;

  const start = new Date(b.event.startsAt);
  const end = new Date(b.event.endsAt);
  const tz = b.event.timezone;
  const paidAtVenue = b.totalMinor > 0 && !b.paidOnline;
  const qrs = await Promise.all(
    b.tickets.map((t) =>
      QRCode.toString(`EVENTHUB:${b.code}:${t.token}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1e2d40", light: "#00000000" } }),
    ),
  );

  return (
    <div className="pb-24 pt-28 md:pt-36">
      <div className="shell max-w-[1000px]">
        <Reveal className="flex flex-col items-start">
          <SuccessMark />
          <p className="mt-6 text-[15px] text-ink-muted">Booking {b.code} is confirmed</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,1.4rem+3.4vw,4.2rem)] font-normal leading-[1.03] text-ink-strong">
            You&apos;re going to {b.event.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">
            {b.tickets.length === 1 ? "Your ticket is" : `Your ${b.tickets.length} tickets are`} below. Show the code at the door, from this page or a screenshot. Keep this page&apos;s link: it is how you get back to your tickets.
          </p>
        </Reveal>

        <Reveal className="mt-12 overflow-hidden rounded-sheet bg-surface shadow-[0_30px_70px_-40px_rgba(20,31,45,.45)] ring-1 ring-line/60" delay={0.1}>
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <EventPhoto id={`booking-${b.code}`} morph={false} zoom={false} image={b.event.image} sizes="(min-width:768px) 450px, 100vw" className="aspect-[16/10] md:aspect-auto md:h-full" />
            <div className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <DateStub iso={b.event.startsAt} timezone={tz} />
                <div>
                  <p className="font-semibold text-ink-strong">{longDate(start, tz)}</p>
                  <p className="text-[15px] text-ink-subtle">{timeRange(start, end, tz)}, {cityTimeZoneNote(tz)}</p>
                  {b.event.venue && <p className="mt-2 text-[15px] text-ink-subtle">{b.event.venue.name}, {b.event.venue.address}, {b.event.venue.city}</p>}
                </div>
              </div>
              <dl className="mt-6 space-y-2 border-t border-line-subtle pt-5 text-[15px]">
                {b.items.map((i) => (
                  <div key={i.name} className="flex justify-between gap-4">
                    <dt className="text-ink-muted">{i.quantity} × {i.name}</dt>
                    <dd className="font-semibold tabular-nums">{i.unitPriceMinor === 0 ? "Free" : formatMoney(i.unitPriceMinor * i.quantity, b.currency)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-line-subtle pt-3">
                  <dt className="font-semibold text-ink-strong">{paidAtVenue ? "Due at the venue" : b.paidOnline ? "Paid" : "Total"}</dt>
                  <dd className="font-display text-2xl leading-none tabular-nums">{b.totalMinor === 0 ? "Free" : formatMoney(b.totalMinor, b.currency)}</dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`/bookings/${b.code}/calendar`} className="inline-flex h-11 items-center gap-2 rounded-full bg-action px-5 text-sm font-semibold text-cream transition-colors hover:bg-action-hover">
                  Add to calendar
                </a>
                <Link href={`/events/${b.event.slug}`} className="inline-flex h-11 items-center rounded-full border border-navy px-5 text-sm font-semibold text-ink transition-colors hover:bg-navy hover:text-cream">
                  Event details
                </Link>
              </div>
              {b.event.onlineUrl && (
                <p className="mt-5 text-[15px] text-ink-muted">
                  Online access:{" "}
                  <a href={b.event.onlineUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-strong underline underline-offset-4">
                    join the stream
                  </a>
                </p>
              )}
            </div>
          </div>
        </Reveal>

        <h2 className="mt-16 font-display text-display-sm font-normal text-ink-strong">{b.tickets.length === 1 ? "Your ticket" : "Your tickets"}</h2>
        <Stagger onMount className="mt-6 grid gap-5 sm:grid-cols-2">
          {b.tickets.map((t, i) => (
            <StaggerItem key={t.id}>
              <div className="flex items-center gap-5 rounded-card bg-surface p-5 ring-1 ring-line/60">
                <div className="size-28 shrink-0 rounded-[10px] bg-white p-2.5" role="img" aria-label={`QR code for ticket ${i + 1}`} dangerouslySetInnerHTML={{ __html: qrs[i] }} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-muted">Ticket {i + 1} of {b.tickets.length}</p>
                  <p className="mt-1 font-semibold text-ink-strong">{t.typeName}</p>
                  <p className="text-sm text-ink-subtle">{b.contactName}</p>
                  <p className="mt-2 font-mono text-xs text-ink-subtle">{b.code}-{String(i + 1).padStart(2, "0")}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-16 flex flex-col items-start gap-4 rounded-card bg-sunken p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-2xl text-ink-strong">Hosted by {b.event.organizer.name}</p>
            <p className="mt-1 text-ink-muted">See what else they have coming up.</p>
          </div>
          <ButtonLink href={`/organizers/${b.event.organizer.slug}`} variant="secondary">View organizer</ButtonLink>
        </div>
      </div>
    </div>
  );
}

type BookingData = NonNullable<Awaited<ReturnType<typeof getBookingByCode>>>;

function BookingStatus({ b }: { b: BookingData }) {
  const copy = {
    PENDING: {
      lead: `Booking ${b.code}`,
      title: "Confirming your payment",
      body: "This usually takes a few seconds. The page updates by itself, and we email your tickets as soon as the payment is confirmed.",
    },
    EXPIRED: {
      lead: `Booking ${b.code} was not completed`,
      title: "The payment wasn't finished in time",
      body: "We held your seats while you were at checkout, then released them. Nothing was charged.",
    },
    CANCELLED: {
      lead: `Booking ${b.code} is cancelled`,
      title: b.event.status === "CANCELLED" ? `${b.event.title} was cancelled` : "This booking is cancelled",
      body: b.event.status === "CANCELLED" ? (b.event.cancelReason ? `The organizer's note: ${b.event.cancelReason}` : "The organizer cancelled the event.") : "Its tickets no longer work at the door.",
    },
    REFUNDED: {
      lead: `Booking ${b.code} is cancelled`,
      title: b.event.status === "CANCELLED" ? `${b.event.title} was cancelled` : "This booking was refunded",
      body: "The payment went back to the card it came from. Banks usually show it within 5 to 10 days.",
    },
  }[b.status as "PENDING" | "EXPIRED" | "CANCELLED" | "REFUNDED"];

  return (
    <div className="shell flex min-h-[70vh] max-w-[760px] flex-col justify-center pb-24 pt-32">
      {b.status === "PENDING" && <PendingRefresh />}
      <p className="text-[15px] text-ink-muted">{copy.lead}</p>
      <h1 className="mt-3 font-display text-[clamp(2.4rem,1.4rem+3.4vw,4rem)] font-normal leading-[1.03] text-ink-strong">{copy.title}</h1>
      <p className="mt-5 max-w-xl text-lg text-ink-muted">{copy.body}</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href={`/events/${b.event.slug}`} size="lg" variant={b.status === "PENDING" ? "secondary" : "primary"}>
          {b.status === "EXPIRED" ? "Book again" : "Event details"}
        </ButtonLink>
        {b.status !== "PENDING" && <ButtonLink href="/events" variant="secondary" size="lg">Explore events</ButtonLink>}
      </div>
    </div>
  );
}
