import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetNotice, SignInForm } from "@/components/auth/AuthForms";
import { AuthHeading, FormSkeleton } from "../AuthHeading";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <>
      <AuthHeading title="Welcome back" lead="Sign in to see your tickets and the events you've saved." />
      <Suspense fallback={<FormSkeleton />}>
        <ResetNotice />
        <SignInForm google={google} />
      </Suspense>
    </>
  );
}
