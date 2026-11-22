"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert, TextInput } from "@/components/ui/Field";

/** Only same-site paths may be a post-sign-in destination. */
export function safeNext(raw: string | null | undefined, fallback = "/account") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match an account.",
  USER_ALREADY_EXISTS: "An account with this email already exists. Sign in instead, or reset the password.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists. Sign in instead, or reset the password.",
  PASSWORD_TOO_SHORT: "Use at least 8 characters.",
  PASSWORD_TOO_LONG: "Use at most 128 characters.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_TOKEN: "This link has expired or was already used. Ask for a new one.",
  TOO_MANY_REQUESTS: "Too many attempts. Wait a minute and try again.",
};

function message(err: { code?: string; message?: string; status?: number } | null | undefined, fallback: string) {
  if (!err) return fallback;
  if (err.status === 429) return MESSAGES.TOO_MANY_REQUESTS;
  return (err.code && MESSAGES[err.code]) || err.message || fallback;
}

function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await authClient.signIn.social({ provider: "google", callbackURL: next });
          setBusy(false);
        }}
      >
        <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
        </svg>
        Continue with Google
      </Button>
      <p className="my-6 flex items-center gap-4 text-[13px] text-ink-subtle before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or</p>
    </>
  );
}

export function SignInForm({ google }: { google: boolean }) {
  const uid = useId();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email: String(f.get("email")), password: String(f.get("password")) });
    if (error) {
      setError(message(error, "We couldn't sign you in. Try again."));
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div>
      {google && <GoogleButton next={next} />}
      <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
        <Field id={`${uid}-email`} label="Email">
          <TextInput id={`${uid}-email`} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field id={`${uid}-password`} label="Password">
          <TextInput id={`${uid}-password`} name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-sm text-ink-muted underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-8 text-[15px] text-ink-muted">
        New to EVENT HUB?{" "}
        <Link href={`/sign-up${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink-strong underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm({ google }: { google: boolean }) {
  const uid = useId();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    const errs: Record<string, string> = {};
    if (name.length < 2) errs.name = "Enter your name.";
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name, email, password, callbackURL: "/account?verified=1" });
    if (error) {
      setError(message(error, "We couldn't create the account. Try again."));
      setBusy(false);
      return;
    }
    router.replace(next === "/account" ? "/account?welcome=1" : next);
    router.refresh();
  }

  return (
    <div>
      {google && <GoogleButton next={next} />}
      <form onSubmit={onSubmit} className="space-y-5">
        <Field id={`${uid}-name`} label="Your name" error={fieldErrors.name}>
          <TextInput id={`${uid}-name`} name="name" autoComplete="name" required error={fieldErrors.name} />
        </Field>
        <Field id={`${uid}-email`} label="Email" hint="We send tickets and reminders here.">
          <TextInput id={`${uid}-email`} name="email" type="email" autoComplete="email" required hint="We send tickets and reminders here." />
        </Field>
        <Field id={`${uid}-password`} label="Password" hint="At least 8 characters." error={fieldErrors.password}>
          <TextInput id={`${uid}-password`} name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." error={fieldErrors.password} />
        </Field>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </Button>
        <p className="text-[13px] leading-relaxed text-ink-subtle">
          Tickets you booked before with this email move into your account once you confirm the address.
        </p>
      </form>
      <p className="mt-8 text-[15px] text-ink-muted">
        Already have an account?{" "}
        <Link href={`/sign-in${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink-strong underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const uid = useId();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setBusy(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    if (error) {
      setError(message(error, "We couldn't send the email. Try again."));
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <FormAlert tone="success">
        If an account uses {sentTo}, a reset link is on its way. It works for one hour.
      </FormAlert>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field id={`${uid}-email`} label="Email">
        <TextInput id={`${uid}-email`} name="email" type="email" autoComplete="email" required />
      </Field>
      {error && <FormAlert>{error}</FormAlert>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Email me a reset link"}
      </Button>
      <p className="text-[15px] text-ink-muted">
        <Link href="/sign-in" className="font-semibold text-ink-strong underline underline-offset-4">Back to sign in</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const uid = useId();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token || linkError) {
    return (
      <div className="space-y-5">
        <FormAlert>{MESSAGES.INVALID_TOKEN}</FormAlert>
        <Link href="/forgot-password" className="inline-block font-semibold text-ink-strong underline underline-offset-4">
          Send a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const newPassword = String(new FormData(e.currentTarget).get("password"));
    if (newPassword.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token: token! });
    if (error) {
      setError(message(error, "We couldn't change the password. Try again."));
      setBusy(false);
      return;
    }
    router.replace("/sign-in?reset=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field id={`${uid}-password`} label="New password" hint="At least 8 characters. You'll be signed out on other devices.">
        <TextInput id={`${uid}-password`} name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters. You'll be signed out on other devices." />
      </Field>
      {error && <FormAlert>{error}</FormAlert>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

export function ResetNotice() {
  const params = useSearchParams();
  if (params.get("reset") !== "1") return null;
  return (
    <div className="mb-6">
      <FormAlert tone="success">Your password is changed. Sign in with the new one.</FormAlert>
    </div>
  );
}
