/**
 * Stripe Checkout. EVENT HUB collects the payment on its own Stripe account
 * and records its commission per payment (platformFeeMinor); paying out to
 * organizers (Stripe Connect) is a separate, later step.
 */
import Stripe from "stripe";
import type { CheckoutInput, PaymentEvent, PaymentProvider } from "../payments-core";

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private stripe: Stripe;

  constructor(
    secretKey: string,
    private webhookSecret: string | undefined,
  ) {
    this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, appInfo: { name: "EVENT HUB" } });
  }

  async createCheckout(input: CheckoutInput) {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: input.bookingId,
        metadata: { bookingId: input.bookingId, bookingCode: input.bookingCode },
        payment_intent_data: { metadata: { bookingId: input.bookingId, bookingCode: input.bookingCode }, description: input.description },
        line_items: input.lines.map((l) => ({
          quantity: l.quantity,
          price_data: { currency: input.currency.toLowerCase(), unit_amount: l.unitAmountMinor, product_data: { name: l.name } },
        })),
        // Stripe requires 30 minutes to 24 hours.
        expires_at: Math.max(Math.floor(input.expiresAt.getTime() / 1000), Math.floor(Date.now() / 1000) + 30 * 60 + 5),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      { idempotencyKey: `checkout:${input.bookingId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { ref: session.id, url: session.url };
  }

  async closeCheckout(ref: string): Promise<"closed" | "paid"> {
    const session = await this.stripe.checkout.sessions.retrieve(ref);
    if (session.status === "complete" || session.payment_status === "paid") return "paid";
    if (session.status === "open") await this.stripe.checkout.sessions.expire(ref);
    return "closed";
  }

  async refund(checkoutRef: string, amountMinor: number) {
    const session = await this.stripe.checkout.sessions.retrieve(checkoutRef);
    const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intent) throw new Error(`Checkout ${checkoutRef} has no payment to refund.`);
    await this.stripe.refunds.create({ payment_intent: intent, amount: amountMinor }, { idempotencyKey: `refund:${checkoutRef}:${amountMinor}` });
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent> {
    if (!this.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
    const signature = headers.get("stripe-signature");
    if (!signature) throw new Error("Missing Stripe signature.");
    const event = await this.stripe.webhooks.constructEventAsync(rawBody, signature, this.webhookSecret);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status !== "paid") return { id: event.id, kind: "ignored", type: event.type }; // async methods settle later
      return { id: event.id, kind: "completed", checkoutRef: s.id, bookingId: s.metadata?.bookingId ?? s.client_reference_id ?? "", amountMinor: s.amount_total ?? 0 };
    }
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const s = event.data.object as Stripe.Checkout.Session;
      return { id: event.id, kind: "expired", checkoutRef: s.id, bookingId: s.metadata?.bookingId ?? s.client_reference_id ?? "" };
    }
    return { id: event.id, kind: "ignored", type: event.type };
  }
}
