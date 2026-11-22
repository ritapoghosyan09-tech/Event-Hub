"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert, INPUT, TEXTAREA, TextInput } from "@/components/ui/Field";
import { saveEvent, type FormState } from "@/app/studio/actions";
import type { StudioEvent } from "@/server/studio";
import { SELECT } from "./StudioShell";

type Venue = { id: string; name: string; city: string; timezone: string };
type Ticket = { key: string; id?: string; name: string; description: string; price: string; quantity: string; maxPerOrder: string; booked: number };

const CURRENCIES = [
  ["EUR", "Euro (€)"],
  ["USD", "US dollar ($)"],
  ["GBP", "Pound sterling (£)"],
  ["AMD", "Armenian dram (AMD)"],
] as const;

let n = 0;
const key = () => `t${++n}`;

function toTickets(e?: StudioEvent): Ticket[] {
  if (!e) return [{ key: key(), name: "General admission", description: "", price: "0", quantity: "100", maxPerOrder: "10", booked: 0 }];
  return e.ticketTypes.map((t) => ({
    key: key(),
    id: t.id,
    name: t.name,
    description: t.description,
    price: (t.priceMinor / 100).toFixed(t.priceMinor % 100 ? 2 : 0),
    quantity: String(t.quantityTotal),
    maxPerOrder: String(t.maxPerOrder),
    booked: t.quantitySold + t.quantityHeld,
  }));
}

function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <p className="font-display text-2xl text-ink-strong">{title}</p>
        {lead && <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{lead}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

function Choice({ name, value, checked, onChange, label, note }: { name: string; value: string; checked: boolean; onChange: () => void; label: string; note?: string }) {
  return (
    <label className={`flex cursor-pointer flex-col rounded-input border px-4 py-3 transition-colors ${checked ? "border-navy bg-accent-surface" : "border-line bg-white hover:border-line-strong"}`}>
      <span className="flex items-center gap-2.5 font-semibold text-ink-strong">
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-4 accent-[var(--eh-navy)]" />
        {label}
      </span>
      {note && <span className="mt-1 pl-6.5 text-[13px] text-ink-subtle">{note}</span>}
    </label>
  );
}

export function EventForm({
  orgId,
  orgSlug,
  categories,
  venues,
  timeZones,
  event,
}: {
  orgId: string;
  orgSlug: string;
  categories: { id: string; name: string }[];
  venues: Venue[];
  timeZones: string[];
  event?: StudioEvent;
}) {
  const uid = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(saveEvent, {});
  const [format, setFormat] = useState(event?.format ?? "IN_PERSON");
  const [venueId, setVenueId] = useState(event?.venueId ?? (venues[0]?.id ?? ""));
  const [tz, setTz] = useState(event?.timezone ?? venues[0]?.timezone ?? "Europe/London");
  const [visibility, setVisibility] = useState(event?.visibility ?? "PUBLIC");
  const [summary, setSummary] = useState(event?.summary ?? "");
  const [tickets, setTickets] = useState<Ticket[]>(() => toTickets(event));
  const sold = tickets.some((t) => t.booked > 0);
  const err = (f: string) => (state.field === f ? state.error : undefined);

  const update = (k: string, patch: Partial<Ticket>) => setTickets((ts) => ts.map((t) => (t.key === k ? { ...t, ...patch } : t)));
  const serialized = JSON.stringify(
    tickets.map((t) => ({ id: t.id, name: t.name, description: t.description, price: t.price, quantity: t.quantity, maxPerOrder: t.maxPerOrder })),
  );

  return (
    <form action={action} className="space-y-10">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="orgSlug" value={orgSlug} />
      {event && <input type="hidden" name="eventId" value={event.id} />}
      <input type="hidden" name="tickets" value={serialized} />

      <Section title="The basics" lead="What people see first, on cards and at the top of the event page.">
        <Field id={`${uid}-title`} label="Event title" error={err("title")}>
          <TextInput id={`${uid}-title`} name="title" defaultValue={event?.title} required maxLength={120} error={err("title")} />
        </Field>
        <Field id={`${uid}-cat`} label="Category" error={err("categoryId")}>
          <select id={`${uid}-cat`} name="categoryId" defaultValue={event?.categoryId ?? categories[0]?.id} className={SELECT}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field id={`${uid}-summary`} label="Summary" hint={`${summary.length} of 280 characters. One or two sentences that sell it.`} error={err("summary")}>
          <textarea id={`${uid}-summary`} name="summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={280} rows={3} required aria-invalid={!!err("summary")} className={TEXTAREA.replace("min-h-32", "min-h-24")} />
        </Field>
        <Field id={`${uid}-desc`} label="Description" hint="Leave a blank line between paragraphs." error={err("description")}>
          <textarea id={`${uid}-desc`} name="description" defaultValue={event?.description} rows={8} required aria-invalid={!!err("description")} className={TEXTAREA} />
        </Field>
      </Section>

      <Section title="When and where" lead="Times are the venue's local time. We show them that way to everyone, wherever they are.">
        <div role="radiogroup" aria-label="Format" className="grid gap-3 sm:grid-cols-3">
          <Choice name="format" value="IN_PERSON" checked={format === "IN_PERSON"} onChange={() => setFormat("IN_PERSON")} label="In person" />
          <Choice name="format" value="ONLINE" checked={format === "ONLINE"} onChange={() => setFormat("ONLINE")} label="Online" />
          <Choice name="format" value="HYBRID" checked={format === "HYBRID"} onChange={() => setFormat("HYBRID")} label="Both" />
        </div>

        {format !== "ONLINE" && (
          <>
            <Field id={`${uid}-venue`} label="Venue" error={err("venueId")}>
              <select
                id={`${uid}-venue`}
                name="venueId"
                value={venueId}
                onChange={(e) => {
                  setVenueId(e.target.value);
                  const v = venues.find((x) => x.id === e.target.value);
                  if (v) setTz(v.timezone);
                }}
                className={SELECT}
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}, {v.city}</option>
                ))}
                <option value="">A new venue…</option>
              </select>
            </Field>
            {!venueId && (
              <div className="grid gap-5 rounded-card bg-sunken p-5 sm:grid-cols-2">
                <Field id={`${uid}-vname`} label="Venue name" error={err("venue")} className="sm:col-span-2">
                  <TextInput id={`${uid}-vname`} name="venueName" maxLength={120} error={err("venue")} />
                </Field>
                <Field id={`${uid}-vaddr`} label="Street address" className="sm:col-span-2">
                  <TextInput id={`${uid}-vaddr`} name="venueAddress" autoComplete="street-address" maxLength={200} />
                </Field>
                <Field id={`${uid}-vcity`} label="City">
                  <TextInput id={`${uid}-vcity`} name="venueCity" autoComplete="address-level2" maxLength={80} />
                </Field>
                <Field id={`${uid}-vcc`} label="Country code" hint="Two letters, like NL or AM.">
                  <TextInput id={`${uid}-vcc`} name="venueCountry" maxLength={2} autoComplete="country" className="uppercase" hint="Two letters, like NL or AM." />
                </Field>
              </div>
            )}
          </>
        )}
        {format !== "IN_PERSON" && (
          <Field id={`${uid}-online`} label="Link to join online" hint="Only people with tickets see it, on their ticket page." error={err("onlineUrl")}>
            <TextInput id={`${uid}-online`} name="onlineUrl" type="url" placeholder="https://" defaultValue={event?.onlineUrl} error={err("onlineUrl")} hint="Only people with tickets see it, on their ticket page." />
          </Field>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${uid}-start`} label="Starts" error={err("startsLocal")}>
            <TextInput id={`${uid}-start`} name="startsLocal" type="datetime-local" defaultValue={event?.startsLocal} required error={err("startsLocal")} />
          </Field>
          <Field id={`${uid}-end`} label="Ends" error={err("endsLocal")}>
            <TextInput id={`${uid}-end`} name="endsLocal" type="datetime-local" defaultValue={event?.endsLocal} required error={err("endsLocal")} />
          </Field>
        </div>
        <Field id={`${uid}-tz`} label="Time zone" error={err("timezone")}>
          <select id={`${uid}-tz`} name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} className={SELECT}>
            {timeZones.map((z) => (
              <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Tickets" lead="Each type has its own price and number available. Set the price to 0 for free tickets.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${uid}-cur`} label="Currency" hint={sold ? "Fixed once tickets are sold." : undefined} error={err("currency")}>
            <select id={`${uid}-cur`} name="currency" defaultValue={event?.currency ?? "EUR"} className={SELECT} disabled={sold}>
              {CURRENCIES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {sold && <input type="hidden" name="currency" value={event?.currency} />}
          </Field>
        </div>
        <ul className="space-y-4">
          {tickets.map((t, i) => (
            <li key={t.key} className="rounded-card bg-surface p-5 ring-1 ring-line/60">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-semibold text-ink-muted">Ticket type {i + 1}{t.booked ? `, ${t.booked} booked` : ""}</p>
                {tickets.length > 1 && (
                  <button type="button" className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-danger hover:underline" onClick={() => setTickets((ts) => ts.filter((x) => x.key !== t.key))}>
                    {t.booked ? "Stop selling" : "Remove"}
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <label className="text-sm font-semibold text-ink-strong">
                  Name
                  <input aria-label={`Ticket type ${i + 1} name`} value={t.name} onChange={(e) => update(t.key, { name: e.target.value })} maxLength={60} required className={INPUT} />
                </label>
                <label className="text-sm font-semibold text-ink-strong">
                  Price
                  <input aria-label={`Ticket type ${i + 1} price`} value={t.price} onChange={(e) => update(t.key, { price: e.target.value })} inputMode="decimal" required className={INPUT} />
                </label>
                <label className="text-sm font-semibold text-ink-strong">
                  Available
                  <input aria-label={`Ticket type ${i + 1} quantity`} value={t.quantity} onChange={(e) => update(t.key, { quantity: e.target.value })} inputMode="numeric" min={Math.max(1, t.booked)} type="number" required className={INPUT} />
                </label>
                <label className="text-sm font-semibold text-ink-strong">
                  Per order
                  <input aria-label={`Ticket type ${i + 1} per-order limit`} value={t.maxPerOrder} onChange={(e) => update(t.key, { maxPerOrder: e.target.value })} inputMode="numeric" min={1} max={50} type="number" required className={INPUT} />
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold text-ink-strong">
                What&apos;s included (optional)
                <input aria-label={`Ticket type ${i + 1} description`} value={t.description} onChange={(e) => update(t.key, { description: e.target.value })} maxLength={200} className={INPUT} />
              </label>
            </li>
          ))}
        </ul>
        {state.field === "tickets" && <FormAlert>{state.error}</FormAlert>}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setTickets((ts) => [...ts, { key: key(), name: "", description: "", price: "0", quantity: "50", maxPerOrder: "10", booked: 0 }])}
        >
          Add a ticket type
        </Button>
      </Section>

      <Section title="Policies and visibility">
        <div role="radiogroup" aria-label="Visibility" className="grid gap-3 sm:grid-cols-2">
          <Choice name="visibility" value="PUBLIC" checked={visibility === "PUBLIC"} onChange={() => setVisibility("PUBLIC")} label="Public" note="Listed in search, categories and your page." />
          <Choice name="visibility" value="UNLISTED" checked={visibility === "UNLISTED"} onChange={() => setVisibility("UNLISTED")} label="Unlisted" note="Only people with the link can find it." />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${uid}-age`} label="Minimum age (optional)">
            <TextInput id={`${uid}-age`} name="ageRestriction" type="number" min={0} max={99} defaultValue={event?.ageRestriction ?? ""} />
          </Field>
        </div>
        <Field id={`${uid}-refund`} label="Refund policy (optional)" hint="Shown next to the price. Attendees can cancel online until 24 hours before the start.">
          <TextInput id={`${uid}-refund`} name="refundPolicy" defaultValue={event?.refundPolicy} maxLength={300} hint="Shown next to the price. Attendees can cancel online until 24 hours before the start." />
        </Field>
      </Section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-full bg-surface/95 p-2 pl-6 shadow-[0_20px_50px_-24px_rgba(20,31,45,.5)] ring-1 ring-line/60 backdrop-blur">
        <p className="mr-auto text-sm" role={state.error ? "alert" : "status"}>
          {state.error && state.field !== "tickets" ? <span className="font-medium text-danger">{state.error}</span> : state.ok ? <span className="font-medium text-success">{state.message}</span> : <span className="text-ink-muted">{event ? "Edits to a live event show straight away." : "Saved as a draft. Nothing is public until you publish."}</span>}
        </p>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : event ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
