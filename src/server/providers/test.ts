/**
 * Test-only payment provider, used by the browser test suite so the full
 * hold → pay → confirm path runs without reaching Stripe. Its checkout page
 * is /test-checkout/[ref]. It is only ever selected when PAYMENT_PROVIDER=test
 * and E2E=1 (see payments.ts); production never loads it.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { CheckoutInput, PaymentEvent, PaymentProvider } from "../payments-core";

const secret = () => process.env.BETTER_AUTH_SECRET ?? "test";

export function signTestEvent(body: string) {
  return createHmac("sha256", secret()).update(body).digest("hex");
}

export class TestProvider implements PaymentProvider {
  readonly name = "test";
  refunds: { ref: string; amountMinor: number }[] = [];
  closed = new Set<string>();
  paid = new Set<string>();

  async createCheckout(input: CheckoutInput) {
    const ref = `test_cs_${randomUUID().replace(/-/g, "")}`;
    const q = new URLSearchParams({ success: input.successUrl, cancel: input.cancelUrl });
    return { ref, url: `/test-checkout/${ref}?${q}` };
  }

  async closeCheckout(ref: string): Promise<"closed" | "paid"> {
    if (this.paid.has(ref)) return "paid";
    this.closed.add(ref);
    return "closed";
  }

  async refund(ref: string, amountMinor: number) {
    this.refunds.push({ ref, amountMinor });
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent> {
    const sig = Buffer.from(headers.get("x-test-signature") ?? "", "hex");
    const expected = Buffer.from(signTestEvent(rawBody), "hex");
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) throw new Error("Bad test signature.");
    const event = JSON.parse(rawBody) as PaymentEvent;
    if (event.kind === "completed") {
      if (this.closed.has(event.checkoutRef)) throw new Error("Checkout was closed.");
      this.paid.add(event.checkoutRef);
    }
    return event;
  }
}
