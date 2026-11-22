import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/session";
import { getMyBookings, getMyOrganizations, type MyBooking } from "@/server/me";
import { EventPhoto } from "@/components/event/EventCard";
import { DateStub } from "@/components/event/DateStub";
import { ButtonLink } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { cityTimeZoneNote, dayLabel, formatMoney, plural, timeLabel } from "@/lib/format";
import { ROLE_LABEL } from "@/server/permissions";
import { AccountNotices, CancelBookingButton, PasswordForm, ProfileForm, ResendVerification, SignOutButton } from "./AccountClient";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <Account />
    </Suspense>
  );
}

function AccountSkeleton() {
  return (
    <div className="shell pb-24 pt-28 md:pt-36" aria-hidden>
      <div className="skeleton h-16 w-2/3 max-w-md rounded-md" />
      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="skeleton h-36 rounded-card" />
          <div className="skeleton h-36 rounded-card" />
        </div>
        <div className="skeleton h-80 rounded-card" />
      </div>
    </div>
  );
}

async function Account() {
  const user = await requireUser("/account");
  const [bookings, orgs] = await Promise.all([getMyBookings(user), getMyOrganizations(user)]);
  const upcoming = bookings.filter((b) => b.upcoming && b.status !== "EXPIRED");
  const past = bookings.filter((b) => !b.upcoming).reverse();

  return (
    <div className="pb-24 pt-28 md:pt-36">
      <div className="shell">
        <div className="flex flex-wrap items-center gap-5">
          <Monogram name={user.name} size="md" />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(2.4rem,1.6rem+2.6vw,3.8rem)] font-normal leading-none text-ink-strong">{user.name}</h1>
            <p className="mt-2 text-ink-muted">{user.email}</p>
          </div>
        </div>
        <Suspense fallback={null}>
          <AccountNotices verified={user.emailVerified} />
        </Suspense>
        {!user.emailVerified && (
          <div className="mt-8 flex flex-col gap-4 rounded-card bg-accent-surface p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink-strong">Confirm your email address</p>
              <p className="mt-1 text-[15px] text-ink-muted">We sent a link to {user.email}. Confirming it moves tickets you booked as a guest into this account.</p>
            </div>
            <ResendVerification email={user.email} />
          </div>
        )}

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          <section aria-labelledby="tickets-title">
            <h2 id="tickets-title" className="font-display text-display-sm font-normal text-ink-strong">Your tickets</h2>
            {upcoming.length ? (
              <ul className="mt-6 space-y-4">
                {upcoming.map((b) => (
                  <BookingRow key={b.id} b={b} />
                ))}
              </ul>
            ) : (
              <div className="mt-6 rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
                <p className="font-display text-2xl text-ink-strong">No upcoming tickets</p>
                <p className="mx-auto mt-2 max-w-sm text-ink-muted">Tickets you book while signed in, or with {user.email}, appear here.</p>
                <ButtonLink href="/events" className="mt-6">Explore events</ButtonLink>
              </div>
            )}

            {past.length > 0 && (
              <details className="group mt-12">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink-strong">
                  <svg viewBox="0 0 24 24" className="size-4 transition-transform group-open:rotate-90" aria-hidden>
                    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  Past events ({past.length})
                </summary>
                <ul className="mt-5 space-y-4">
                  {past.map((b) => (
                    <BookingRow key={b.id} b={b} />
                  ))}
                </ul>
              </details>
            )}
          </section>

          <div className="space-y-6">
            <section aria-labelledby="studio-title" className="rounded-card bg-inverse p-6 text-cream">
              <h2 id="studio-title" className="font-display text-2xl">Organizer studio</h2>
              {orgs.length ? (
                <ul className="mt-4 space-y-2">
                  {orgs.map((o) => (
                    <li key={o.slug}>
                      <Link href={`/studio/${o.slug}`} className="flex items-center justify-between gap-3 rounded-input bg-cream/8 px-4 py-3 transition-colors hover:bg-cream/14">
                        <span className="font-semibold">{o.name}</span>
                        <span className="text-sm text-cream/70">{ROLE_LABEL[o.role]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[15px] leading-relaxed text-cream/80">Hosting something? Create an organizer profile to publish events and sell tickets.</p>
              )}
              <ButtonLink href="/studio/new" variant="inverse" className="mt-5">
                {orgs.length ? "New organizer profile" : "Start hosting"}
              </ButtonLink>
            </section>

            <section aria-labelledby="profile-title" className="rounded-card bg-surface p-6 ring-1 ring-line/60">
              <h2 id="profile-title" className="font-display text-2xl text-ink-strong">Profile</h2>
              <ProfileForm name={user.name} city={user.city ?? ""} />
            </section>

            <section aria-labelledby="security-title" className="rounded-card bg-surface p-6 ring-1 ring-line/60">
              <h2 id="security-title" className="font-display text-2xl text-ink-strong">Password</h2>
              <PasswordForm />
            </section>

            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<string, { label: string; tone: string }> = {
  CONFIRMED: { label: "Confirmed", tone: "bg-[#e6efe6] text-success" },
  PENDING: { label: "Awaiting payment", tone: "bg-sunken text-ink" },
  CANCELLED: { label: "Cancelled", tone: "bg-[#f7e7e7] text-danger" },
  REFUNDED: { label: "Refunded", tone: "bg-[#f7e7e7] text-danger" },
};

function BookingRow({ b }: { b: MyBooking }) {
  const start = new Date(b.event.startsAt);
  const status = STATUS[b.status] ?? STATUS.CONFIRMED;
  const amount = b.totalMinor === 0 ? "Free" : b.paidOnline ? `${formatMoney(b.totalMinor, b.currency)} paid` : `${formatMoney(b.totalMinor, b.currency)} at the venue`;
  return (
    <li className="overflow-hidden rounded-card bg-surface ring-1 ring-line/60">
      <div className="grid sm:grid-cols-[180px_minmax(0,1fr)]">
        <EventPhoto id={`acct-${b.id}`} morph={false} zoom={false} image={b.event.image} sizes="(min-width:640px) 180px, 100vw" className="aspect-[16/9] sm:aspect-auto sm:h-full" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <DateStub iso={b.event.startsAt} timezone={b.event.timezone} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-tag px-2 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
              <span className="text-sm text-ink-subtle">{b.code}</span>
            </div>
            <Link href={`/events/${b.event.slug}`} className="mt-2 block font-display text-[1.45rem] leading-tight text-ink-strong hover:underline hover:underline-offset-4">
              {b.event.title}
            </Link>
            <p className="mt-1 text-[15px] text-ink-subtle">
              {dayLabel(start, b.event.timezone)}, {timeLabel(start, b.event.timezone)} ({cityTimeZoneNote(b.event.timezone)}), {b.event.place}
            </p>
            <p className="mt-1 text-[15px] text-ink-subtle">
              {plural(b.tickets, "ticket")}, {amount}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(b.status === "CONFIRMED" || b.status === "PENDING") && (
                <ButtonLink href={`/bookings/${b.code}`} variant="secondary" className="h-10">
                  {b.status === "CONFIRMED" ? "Show tickets" : "Check status"}
                </ButtonLink>
              )}
              {b.canCancel && <CancelBookingButton bookingId={b.id} paidOnline={b.paidOnline} />}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
