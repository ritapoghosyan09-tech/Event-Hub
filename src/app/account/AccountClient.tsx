"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useId, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert, TextInput } from "@/components/ui/Field";
import { cancelMyBooking, updateProfile, type CancelState, type ProfileState } from "./actions";

export function AccountNotices({ verified }: { verified: boolean }) {
  const params = useSearchParams();
  if (params.get("verified") === "1" && verified) {
    return (
      <div className="mt-8">
        <FormAlert tone="success">Email confirmed. Tickets you booked with this address are now in your account.</FormAlert>
      </div>
    );
  }
  if (params.get("welcome") === "1") {
    return (
      <div className="mt-8">
        <FormAlert tone="success">Your account is ready. Saved events on this device are now part of it.</FormAlert>
      </div>
    );
  }
  return null;
}

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (state === "sent") return <p className="text-sm font-semibold text-success" role="status">Sent. Check your inbox.</p>;
  return (
    <div className="shrink-0">
      <Button
        variant="secondary"
        disabled={state === "sending"}
        onClick={async () => {
          setState("sending");
          const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/account?verified=1" });
          setState(error ? "error" : "sent");
        }}
      >
        {state === "sending" ? "Sending…" : "Send the link again"}
      </Button>
      {state === "error" && <p className="mt-2 text-sm text-danger" role="alert">Couldn&apos;t send it. Try again in a few minutes.</p>}
    </div>
  );
}

export function ProfileForm({ name, city }: { name: string; city: string }) {
  const uid = useId();
  const router = useRouter();
  const [state, action, pending] = useActionState<ProfileState, FormData>(async (prev, form) => {
    const res = await updateProfile(prev, form);
    if (res.ok) router.refresh();
    return res;
  }, {});
  return (
    <form action={action} className="mt-5 space-y-4">
      <Field id={`${uid}-name`} label="Name" error={state.fieldErrors?.name}>
        <TextInput id={`${uid}-name`} name="name" defaultValue={name} autoComplete="name" required error={state.fieldErrors?.name} />
      </Field>
      <Field id={`${uid}-city`} label="Home city" hint="Used to show events near you first.">
        <TextInput id={`${uid}-city`} name="city" defaultValue={city} autoComplete="address-level2" hint="Used to show events near you first." />
      </Field>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.ok && <FormAlert tone="success">Profile saved.</FormAlert>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}

export function PasswordForm() {
  const uid = useId();
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const newPassword = String(f.get("new"));
    if (newPassword.length < 8) return setState({ error: "Use at least 8 characters for the new password." });
    setBusy(true);
    const { error } = await authClient.changePassword({ currentPassword: String(f.get("current")), newPassword, revokeOtherSessions: true });
    setBusy(false);
    if (error) return setState({ error: error.code === "INVALID_PASSWORD" ? "Your current password is wrong." : error.message ?? "Couldn't change the password." });
    formEl.reset();
    setState({ ok: true });
  }
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <Field id={`${uid}-current`} label="Current password">
        <TextInput id={`${uid}-current`} name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field id={`${uid}-new`} label="New password" hint="At least 8 characters. Other devices get signed out.">
        <TextInput id={`${uid}-new`} name="new" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters. Other devices get signed out." />
      </Field>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.ok && <FormAlert tone="success">Password changed.</FormAlert>}
      <Button type="submit" variant="secondary" disabled={busy}>{busy ? "Changing…" : "Change password"}</Button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="quiet"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function CancelBookingButton({ bookingId, paidOnline }: { bookingId: string; paidOnline: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<CancelState, FormData>(async (prev, form) => {
    const res = await cancelMyBooking(prev, form);
    if (res.ok) router.refresh();
    return res;
  }, {});

  if (!confirming) {
    return (
      <Button variant="quiet" className="h-10" onClick={() => setConfirming(true)}>
        Cancel booking
      </Button>
    );
  }
  return (
    <form action={action} className="flex w-full flex-wrap items-center gap-2 rounded-input bg-sunken p-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="mr-auto text-sm text-ink">
        {paidOnline ? "Cancel and refund to your card?" : "Cancel these tickets? They stop working at the door."}
      </p>
      <Button type="button" variant="quiet" className="h-10 bg-surface" onClick={() => setConfirming(false)} disabled={pending}>
        Keep tickets
      </Button>
      <Button type="submit" className="h-10 bg-danger hover:bg-danger" disabled={pending}>
        {pending ? "Cancelling…" : "Yes, cancel"}
      </Button>
      {state.error && <p className="w-full text-sm text-danger" role="alert">{state.error}</p>}
    </form>
  );
}
