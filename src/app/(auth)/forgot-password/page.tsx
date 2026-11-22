import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { AuthHeading } from "../AuthHeading";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password" lead="Enter the email you use for EVENT HUB and we'll send a link to choose a new password." />
      <ForgotPasswordForm />
    </>
  );
}
