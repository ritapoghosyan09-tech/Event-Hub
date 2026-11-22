"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert, TextInput } from "@/components/ui/Field";
import { addMember, changeMember, type FormState } from "@/app/studio/actions";
import { SELECT } from "./StudioShell";

type Member = { userId: string; name: string; email: string; role: "OWNER" | "ADMIN" | "STAFF" };

const ROLES = [
  ["OWNER", "Owner: everything, including team and payouts"],
  ["ADMIN", "Admin: events, attendees and check-in"],
  ["STAFF", "Door staff: attendee list and check-in"],
] as const;

function MemberRow({ orgId, m, canManage }: { orgId: string; m: Member; canManage: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeMember, {});
  return (
    <li className="py-4">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="userId" value={m.userId} />
        <div className="mr-auto min-w-0">
          <p className="font-semibold text-ink-strong">{m.name}</p>
          <p className="truncate text-sm text-ink-subtle">{m.email}</p>
        </div>
        {canManage ? (
          <>
            <label className="sr-only" htmlFor={`role-${m.userId}`}>Role for {m.name}</label>
            <select id={`role-${m.userId}`} name="role" defaultValue={m.role} className={`${SELECT} mt-0 h-11 w-auto`} onChange={(e) => e.currentTarget.form?.requestSubmit()} disabled={pending}>
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Door staff</option>
            </select>
            <Button type="submit" name="role" value="REMOVE" variant="quiet" className="h-11" disabled={pending}>Remove</Button>
          </>
        ) : (
          <span className="text-sm text-ink-muted">{m.role === "STAFF" ? "Door staff" : m.role[0] + m.role.slice(1).toLowerCase()}</span>
        )}
      </form>
      {state.error && <div className="mt-2"><FormAlert>{state.error}</FormAlert></div>}
    </li>
  );
}

export function TeamManager({ orgId, members, canManage }: { orgId: string; members: Member[]; canManage: boolean }) {
  const uid = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(addMember, {});
  return (
    <div>
      <ul className="divide-y divide-line-subtle">
        {members.map((m) => (
          <MemberRow key={m.userId} orgId={orgId} m={m} canManage={canManage} />
        ))}
      </ul>
      {canManage && (
        <form action={action} className="mt-6 space-y-4 rounded-card bg-sunken p-5">
          <input type="hidden" name="orgId" value={orgId} />
          <p className="font-semibold text-ink-strong">Add someone</p>
          <Field id={`${uid}-email`} label="Their EVENT HUB email" error={state.field === "email" ? state.error : undefined}>
            <TextInput id={`${uid}-email`} name="email" type="email" required error={state.field === "email" ? state.error : undefined} />
          </Field>
          <Field id={`${uid}-role`} label="Role">
            <select id={`${uid}-role`} name="role" defaultValue="STAFF" className={SELECT}>
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          {state.error && state.field !== "email" && <FormAlert>{state.error}</FormAlert>}
          {state.ok && <FormAlert tone="success">{state.message}</FormAlert>}
          <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add to team"}</Button>
        </form>
      )}
    </div>
  );
}
