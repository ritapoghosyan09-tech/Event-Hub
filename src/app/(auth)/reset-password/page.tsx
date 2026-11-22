import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { AuthHeading, FormSkeleton } from "../AuthHeading";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Choose a new password" />
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
