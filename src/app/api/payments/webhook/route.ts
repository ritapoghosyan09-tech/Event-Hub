import { revalidateTag } from "next/cache";
import { handleWebhook } from "@/server/payments";

/** Payment provider webhooks (Stripe: checkout.session.completed / expired). */
export async function POST(req: Request) {
  const body = await req.text();
  let result: string;
  try {
    result = await handleWebhook(body, req.headers);
  } catch (e) {
    const message = (e as Error).message ?? "error";
    const badSignature = /signature|not set|not configured/i.test(message);
    console.error("[webhook]", message);
    // 400: never retry a forged or misrouted call. 500: the provider retries.
    return Response.json({ error: badSignature ? "Invalid webhook" : "Processing failed" }, { status: badSignature ? 400 : 500 });
  }
  if (result === "confirmed" || result === "expired" || result === "refunded-unavailable") revalidateTag("events", "max");
  return Response.json({ received: true, result });
}
