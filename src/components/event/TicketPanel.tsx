"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { bookTickets, type BookingFormState } from "@/app/actions";
import { formatMoney, timeLabel, dayLabel } from "@/lib/format";
import { DateStub } from "./DateStub";
import type { EventDetail } from "@/server/discovery";
import { EASE } from "@/components/motion/Reveal";
import { useSession } from "@/lib/auth-client";

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const btn =
    "grid size-9 place-items-center rounded-full border border-line text-ink transition-[background-color,transform,opacity] duration-150 hover:bg-sunken active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`${label} quantity`}>
      <button type="button" className={btn} onClick={() => onChange(value <= min ? 0 : value - 1)} disabled={value === 0} aria-label={`One fewer ${label}`}>
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden><path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <span className="relative w-6 overflow-hidden text-center font-semibold tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} className="block" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.18 }}>
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" className={btn} onClick={() => onChange(value === 0 ? Math.max(1, min) : value + 1)} disabled={value >= max} aria-label={`One more ${label}`}>
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden><path d="M6 12h12M12 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

export function TicketPanel({ event, cardPayments = false }: { event: EventDetail; cardPayments?: boolean }) {
  const upcoming = event.upcoming;
  const { data: session } = useSession();
  // Unique ids: with Cache Components, a previously visited event page stays mounted (hidden).
  const uid = useId();
  const [state, action, pending] = useActionState<BookingFormState, FormData>(bookTickets, {});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [key] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const start = new Date(event.startsAt);

  const total = useMemo(() => event.tickets.reduce((s, t) => s + (qty[t.id] ?? 0) * t.priceMinor, 0), [qty, event.tickets]);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const currency = event.tickets[0]?.currency ?? event.currency ?? "USD";
  const anyOnSale = event.tickets.some((t) => t.onSale && t.remaining > 0);
  const paid = total > 0;

  return (
    <div id={`tickets-${event.slug}`} className="scroll-mt-28 rounded-sheet bg-surface shadow-[0_30px_70px_-40px_rgba(20,31,45,.45)] ring-1 ring-line/60">
      <div className="flex items-center gap-4 p-6">
        <DateStub iso={event.startsAt} timezone={event.timezone} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-strong">{dayLabel(start, event.timezone)}, {timeLabel(start, event.timezone)}</p>
          <p className="truncate text-sm text-ink-subtle">{event.venue ? `${event.venue.name}, ${event.venue.city}` : "Online"}</p>
        </div>
      </div>
      <div className="tear" style={{ "--tear-bg": "var(--eh-canvas)" } as React.CSSProperties} aria-hidden />

      {event.status === "CANCELLED" ? (
        <div className="p-6">
          <p className="font-display text-2xl text-ink-strong">Cancelled</p>
          <p className="mt-2 text-sm text-ink-muted">The organizer cancelled this event. Everyone with tickets has been emailed{event.cancelReason ? `: ${event.cancelReason}` : "."}</p>
        </div>
      ) : !upcoming ? (
        <p className="p-6 text-ink-muted">This event has already taken place.</p>
      ) : !anyOnSale ? (
        <div className="p-6">
          <p className="font-display text-2xl text-ink-strong">Sold out</p>
          <p className="mt-2 text-sm text-ink-muted">Every ticket for this event has been booked. Save it to keep an eye on returns.</p>
        </div>
      ) : (
        <form action={action} className="p-6">
          <input type="hidden" name="eventId" value={event.id} />
          <input type="hidden" name="eventSlug" value={event.slug} />
          <input type="hidden" name="idempotencyKey" value={key} />
          <fieldset>
            <legend className="text-sm font-semibold text-ink-strong">Choose tickets</legend>
            <ul className="mt-3 divide-y divide-line-subtle">
              {event.tickets.map((t) => {
                const max = Math.min(t.maxPerOrder, t.remaining);
                const out = !t.onSale || t.remaining === 0;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-strong">{t.name}</p>
                      <p className="mt-0.5 text-sm text-ink-subtle">
                        {t.priceMinor === 0 ? "Free" : formatMoney(t.priceMinor, t.currency)}
                        {t.description ? `, ${t.description.charAt(0).toLowerCase()}${t.description.slice(1)}` : ""}
                      </p>
                      {!out && t.remaining <= 20 && <p className="mt-1 text-xs font-semibold text-warning">{t.remaining} left</p>}
                    </div>
                    {out ? (
                      <span className="text-sm font-semibold text-ink-subtle">Sold out</span>
                    ) : (
                      <>
                        <Stepper value={qty[t.id] ?? 0} min={t.minPerOrder} max={max} label={t.name} onChange={(n) => setQty((q) => ({ ...q, [t.id]: n }))} />
                        <input type="hidden" name={`qty:${t.id}`} value={qty[t.id] ?? 0} />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {state.fieldErrors?.items && <p className="mt-2 text-sm font-medium text-danger" role="alert">{state.fieldErrors.items}</p>}
          </fieldset>

          <AnimatePresence initial={false}>
            {count > 0 && (
              <motion.div
                key="details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t border-line-subtle pt-5">
                  <div>
                    <label htmlFor={`${uid}-name`} className="text-sm font-semibold text-ink-strong">Name on tickets</label>
                    <input id={`${uid}-name`} name="name" autoComplete="name" required defaultValue={session?.user.name ?? undefined} className="mt-1.5 h-12 w-full rounded-input border border-line bg-white px-3.5 text-base text-ink-strong outline-none transition-[border-color,box-shadow] hover:border-line-strong focus:border-ink-muted focus:shadow-[0_0_0_3px_var(--eh-lavender-tint)] aria-[invalid=true]:border-danger" aria-invalid={!!state.fieldErrors?.name} />
                    {state.fieldErrors?.name && <p className="mt-1 text-sm text-danger">{state.fieldErrors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor={`${uid}-email`} className="text-sm font-semibold text-ink-strong">Email</label>
                    <input id={`${uid}-email`} name="email" type="email" autoComplete="email" required defaultValue={session?.user.email ?? undefined} className="mt-1.5 h-12 w-full rounded-input border border-line bg-white px-3.5 text-base text-ink-strong outline-none transition-[border-color,box-shadow] hover:border-line-strong focus:border-ink-muted focus:shadow-[0_0_0_3px_var(--eh-lavender-tint)] aria-[invalid=true]:border-danger" aria-invalid={!!state.fieldErrors?.email} />
                    {state.fieldErrors?.email ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.email}</p> : <p className="mt-1 text-sm text-ink-subtle">We email your tickets here and show them straight after booking.</p>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex items-baseline justify-between border-t border-line-subtle pt-5">
            <span className="text-sm text-ink-muted">{count ? `${count} ${count === 1 ? "ticket" : "tickets"}` : "Total"}</span>
            <motion.span key={total} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="font-display text-[1.9rem] leading-none text-ink-strong tabular-nums">
              {count === 0 ? <span className="font-sans text-base text-ink-subtle">Nothing selected</span> : total === 0 ? "Free" : formatMoney(total, currency)}
            </motion.span>
          </div>

          {state.error && <p className="mt-4 rounded-input bg-[#f7e7e7] px-3.5 py-3 text-sm text-danger" role="alert">{state.error}</p>}

          <motion.button
            type="submit"
            disabled={!count || pending}
            whileTap={{ scale: 0.98 }}
            className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-action text-base font-semibold text-cream transition-[background-color,opacity] hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? (
              <>
                <motion.span className="size-4 rounded-full border-2 border-cream/30 border-t-cream" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} aria-hidden />
                Booking…
              </>
            ) : !count ? (
              "Choose your tickets"
            ) : paid && cardPayments ? (
              "Continue to payment"
            ) : paid ? (
              `Reserve ${count === 1 ? "ticket" : `${count} tickets`}`
            ) : (
              `Get ${count === 1 ? "free ticket" : `${count} free tickets`}`
            )}
          </motion.button>
          <p className="mt-3 text-center text-xs leading-relaxed text-ink-subtle">
            {event.tickets.every((t) => t.priceMinor === 0) || (count > 0 && !paid)
              ? "No payment needed. Tickets are confirmed straight away."
              : cardPayments
                ? "Your seats are held for 30 minutes while you pay by card on the next page."
                : "Paid tickets are reserved now and paid at the venue."}
          </p>
        </form>
      )}
    </div>
  );
}
