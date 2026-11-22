/**
 * The app's handle on payments. Card payments are on when a provider is
 * configured (STRIPE_SECRET_KEY); without one, paid tickets are reserved and
 * paid at the venue, exactly as before.
 */
import "server-only";
import { db } from "./db";
import {
  cancelEventBookingsWith,
  expireStaleHoldsWith,
  handlePaymentEventWith,
  refundBookingPaymentsWith,
  startCheckoutWith,
  type CheckoutInput,
  type PaymentEvent,
  type PaymentProvider,
} from "./payments-core";
import { StripeProvider } from "./providers/stripe";
import { TestProvider } from "./providers/test";
import { sendBookingConfirmation } from "./notifications";

const g = globalThis as unknown as { __ehPaymentProvider?: PaymentProvider | null };

export function paymentProvider(): PaymentProvider | null {
  if (g.__ehPaymentProvider !== undefined) return g.__ehPaymentProvider;
  let provider: PaymentProvider | null = null;
  if (process.env.PAYMENT_PROVIDER === "test" && (process.env.E2E === "1" || process.env.NODE_ENV !== "production")) {
    provider = new TestProvider();
  } else if (process.env.STRIPE_SECRET_KEY) {
    provider = new StripeProvider(process.env.STRIPE_SECRET_KEY, process.env.STRIPE_WEBHOOK_SECRET);
  }
  g.__ehPaymentProvider = provider;
  return provider;
}

export const cardPaymentsEnabled = () => paymentProvider() !== null;

/** Minutes a held seat waits for payment. Stripe's checkout needs at least 30. */
export const holdMinutes = () => Math.max(30, Number(process.env.BOOKING_HOLD_MINUTES ?? 30));

export function startCheckout(input: CheckoutInput) {
  const provider = paymentProvider();
  if (!provider) throw new Error("Card payments are not configured.");
  return startCheckoutWith(db, provider, input);
}

export async function handleWebhook(rawBody: string, headers: Headers) {
  const provider = paymentProvider();
  if (!provider) throw new Error("Card payments are not configured.");
  const event: PaymentEvent = await provider.parseWebhook(rawBody, headers);
  return handlePaymentEventWith(db, provider, event, { onConfirmed: (id) => sendBookingConfirmation(id) });
}

export const expireStaleHolds = (now?: Date) => expireStaleHoldsWith(db, paymentProvider(), now);

export async function refundBookingPayments(bookingId: string) {
  return refundBookingPaymentsWith(db, paymentProvider(), bookingId);
}

export const cancelEventBookings = (eventId: string) => cancelEventBookingsWith(db, paymentProvider(), eventId);
