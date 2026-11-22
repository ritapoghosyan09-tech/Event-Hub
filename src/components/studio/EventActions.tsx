"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert, TextInput } from "@/components/ui/Field";
import { cancelEvent, deleteDraft, publishEvent, unpublishEvent, type FormState } from "@/app/studio/actions";

type Props = { orgId: string; orgSlug: string; eventId: string };

function Hidden({ orgId, orgSlug, eventId }: Props) {
  return (
    <>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="eventId" value={eventId} />
    </>
  );
}

export function PublishButton({ ready, ...p }: Props & { ready: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(publishEvent, {});
  return (
    <form action={action}>
      <Hidden {...p} />
      <Button type="submit" variant="inverse" size="lg" disabled={!ready || pending}>
        {pending ? "Publishing…" : "Publish event"}
      </Button>
      {state.error && <p className="mt-2 max-w-xs text-sm text-[#f3c4c4]" role="alert">{state.error}</p>}
    </form>
  );
}

export function DangerZone({ status, bookings, ...p }: Props & { status: string; bookings: number }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [cState, cancel, cPending] = useActionState<FormState, FormData>(cancelEvent, {});
  const [uState, unpublish, uPending] = useActionState<FormState, FormData>(unpublishEvent, {});
  const [dState, remove, dPending] = useActionState<FormState, FormData>(deleteDraft, {});

  // Shown even after the page refreshes into its cancelled state.
  if (cState.ok) return <FormAlert tone="success">{cState.message}</FormAlert>;

  if (status === "DRAFT") {
    return (
      <form action={remove} className="flex flex-wrap items-center justify-between gap-4">
        <Hidden {...p} />
        <p className="max-w-lg text-[15px] text-ink-muted">Delete this draft and its photos. This can&apos;t be undone.</p>
        <Button type="submit" variant="quiet" disabled={dPending}>{dPending ? "Deleting…" : "Delete draft"}</Button>
        {dState.error && <div className="w-full"><FormAlert>{dState.error}</FormAlert></div>}
      </form>
    );
  }
  if (status !== "PUBLISHED") return <p className="text-[15px] text-ink-muted">Nothing to change here: this event is {status === "CANCELLED" ? "cancelled" : "finished"}.</p>;

  return (
    <div className="space-y-6">
      {bookings === 0 && (
        <form action={unpublish} className="flex flex-wrap items-center justify-between gap-4">
          <Hidden {...p} />
          <p className="max-w-lg text-[15px] text-ink-muted">Nobody has booked yet, so you can take the event off sale and back to draft.</p>
          <Button type="submit" variant="secondary" disabled={uPending}>{uPending ? "Moving…" : "Move back to draft"}</Button>
          {uState.error && <div className="w-full"><FormAlert>{uState.error}</FormAlert></div>}
        </form>
      )}
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-lg text-[15px] text-ink-muted">
            Cancelling stops sales, voids every ticket, refunds card payments and emails {bookings ? `all ${bookings} booking${bookings === 1 ? "" : "s"}` : "anyone who booked"}.
          </p>
          <Button variant="quiet" className="text-danger" onClick={() => setOpen(true)}>Cancel event</Button>
        </div>
      ) : (
        <form action={cancel} className="space-y-4 rounded-card bg-[#f7e7e7]/60 p-5">
          <Hidden {...p} />
          <Field id={`${uid}-reason`} label="Note to attendees (optional)" hint="Included in the cancellation email.">
            <TextInput id={`${uid}-reason`} name="reason" maxLength={500} hint="Included in the cancellation email." />
          </Field>
          <Field id={`${uid}-confirm`} label="Type CANCEL to confirm" error={cState.field === "confirm" ? cState.error : undefined}>
            <TextInput id={`${uid}-confirm`} name="confirm" autoComplete="off" required error={cState.field === "confirm" ? cState.error : undefined} />
          </Field>
          {cState.error && cState.field !== "confirm" && <FormAlert>{cState.error}</FormAlert>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="bg-danger hover:bg-danger" disabled={cPending}>{cPending ? "Cancelling…" : "Cancel the event"}</Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>Keep it on sale</Button>
          </div>
        </form>
      )}
    </div>
  );
}
