/**
 * Stand-in for the card provider's hosted checkout, used only by the browser
 * test suite (PAYMENT_PROVIDER=test with E2E=1). Paying here sends a signed
 * webhook through the same handler Stripe's webhooks use.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { handleWebhook, paymentProvider } from "@/server/payments";
import { signTestEvent, TestProvider } from "@/server/providers/test";
import { formatMoney } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false } };

async function pay(form: FormData) {
  "use server";
  if (!(paymentProvider() instanceof TestProvider)) notFound();
  const ref = String(form.get("ref"));
  const success = String(form.get("success"));
  const payment = await db.payment.findUnique({ where: { providerPaymentRef: ref } });
  if (!payment) notFound();
  const body = JSON.stringify({ id: `evt_${randomUUID()}`, kind: "completed", checkoutRef: ref, bookingId: payment.bookingId, amountMinor: payment.amountMinor });
  await handleWebhook(body, new Headers({ "x-test-signature": signTestEvent(body) }));
  redirect(success);
}

export default function TestCheckoutPage({ params, searchParams }: PageProps<"/test-checkout/[ref]">) {
  return (
    <Suspense fallback={null}>
      <Checkout params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Checkout({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(paymentProvider() instanceof TestProvider)) notFound();
  const { ref } = await params;
  const sp = await searchParams;
  const payment = await db.payment.findUnique({ where: { providerPaymentRef: ref } });
  if (!payment) notFound();
  return (
    <div className="shell max-w-lg pb-24 pt-36">
      <p className="text-[15px] text-ink-muted">Test card checkout</p>
      <h1 className="mt-3 font-display text-5xl text-ink-strong">{formatMoney(payment.amountMinor, payment.currency)}</h1>
      <form action={pay} className="mt-10 flex gap-3">
        <input type="hidden" name="ref" value={ref} />
        <input type="hidden" name="success" value={String(sp.success ?? "/")} />
        <Button type="submit" size="lg">Pay {formatMoney(payment.amountMinor, payment.currency)}</Button>
        <ButtonLink href={String(sp.cancel ?? "/")} variant="secondary" size="lg">Cancel payment</ButtonLink>
      </form>
    </div>
  );
}
