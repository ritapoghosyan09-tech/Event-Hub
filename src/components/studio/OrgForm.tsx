"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert, TEXTAREA, TextInput } from "@/components/ui/Field";
import { createOrganization, updateOrganization, type FormState } from "@/app/studio/actions";
import { SELECT } from "./StudioShell";

const TYPES = [
  ["INDIVIDUAL", "An individual (artist, teacher, host)"],
  ["BUSINESS", "A business or brand"],
  ["COMMUNITY", "A community or club"],
  ["NONPROFIT", "A nonprofit"],
] as const;

export function OrgForm({
  org,
  defaultEmail,
}: {
  org?: { id: string; name: string; type: string; contactEmail: string; bio: string; websiteUrl: string };
  defaultEmail?: string;
}) {
  const uid = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(org ? updateOrganization : createOrganization, {});
  const err = (f: string) => (state.field === f ? state.error : undefined);
  return (
    <form action={action} className="space-y-5">
      {org && <input type="hidden" name="orgId" value={org.id} />}
      <Field id={`${uid}-name`} label="Organizer name" hint="Shown on every event you host." error={err("name")}>
        <TextInput id={`${uid}-name`} name="name" defaultValue={org?.name} required maxLength={80} error={err("name")} hint="Shown on every event you host." />
      </Field>
      <Field id={`${uid}-type`} label="Who is hosting">
        <select id={`${uid}-type`} name="type" defaultValue={org?.type ?? "INDIVIDUAL"} className={SELECT}>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field id={`${uid}-email`} label="Contact email" hint="Attendees use this to reach you. It appears on your public page." error={err("contactEmail")}>
        <TextInput id={`${uid}-email`} name="contactEmail" type="email" defaultValue={org?.contactEmail ?? defaultEmail} required error={err("contactEmail")} hint="Attendees use this to reach you. It appears on your public page." />
      </Field>
      <Field id={`${uid}-bio`} label="About (optional)" error={err("bio")}>
        <textarea id={`${uid}-bio`} name="bio" defaultValue={org?.bio} maxLength={1000} className={TEXTAREA} />
      </Field>
      <Field id={`${uid}-web`} label="Website (optional)" error={err("websiteUrl")}>
        <TextInput id={`${uid}-web`} name="websiteUrl" type="url" placeholder="https://" defaultValue={org?.websiteUrl} error={err("websiteUrl")} />
      </Field>
      {state.error && !state.field && <FormAlert>{state.error}</FormAlert>}
      {state.ok && state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : org ? "Save profile" : "Create organizer profile"}
      </Button>
    </form>
  );
}
