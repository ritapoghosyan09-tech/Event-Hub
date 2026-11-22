import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { verifyCheckoutCancelToken } from "@/server/checkout-token";
import { paymentProvider } from "@/server/payments";
import { expireHeldBooking } from "@/server/bookings";

/**
 * The buyer came back from the card checkout without paying: close that
 * checkout and put the seats back on sale now instead of waiting for the hold
 * to lapse. POST only, sent by the event page once the buyer is actually
 * there, so link scanners and prefetching can never release someone's seats.
 */
export async function POST(req: Request) {
  const body = z.object({ booking: z.string().min(1), token: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!body.success || !verifyCheckoutCancelToken(body.data.booking, body.data.token)) return Response.json({ released: false }, { status: 400 });
  const booking = await db.booking.findUnique({
    where: { id: body.data.booking },
    select: { id: true, status: true, event: { select: { slug: true } }, payments: { where: { status: "REQUIRES_ACTION" }, select: { id: true, providerPaymentRef: true } } },
  });
  if (!booking || booking.status !== "PENDING") return Response.json({ released: false });

  const provider = paymentProvider();
  for (const p of booking.payments) {
    const state = provider ? await provider.closeCheckout(p.providerPaymentRef).catch(() => "closed" as const) : "closed";
    if (state === "paid") return Response.json({ released: false, paid: true }); // its webhook confirms it
    await db.payment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: "Checkout abandoned" } });
  }
  const released = await expireHeldBooking(booking.id);
  if (released) {
    revalidateTag(`event:${booking.event.slug}`, "max");
    revalidateTag("events", "max");
  }
  return Response.json({ released });
}
