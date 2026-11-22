import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/AuthForms";
import { AuthHeading, FormSkeleton } from "../AuthHeading";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <>
      <AuthHeading title="Create your account" lead="Keep every ticket in one place, save events for later and get reminders before doors open." />
      <Suspense fallback={<FormSkeleton fields={3} />}>
        <SignUpForm google={google} />
      </Suspense>
    </>
  );
}
