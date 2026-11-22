import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Signs the "back from checkout without paying" link so only the buyer's own link can release a hold early. */
export function checkoutCancelToken(bookingId: string) {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "dev").update(`cancel:${bookingId}`).digest("base64url");
}

export function verifyCheckoutCancelToken(bookingId: string, token: string) {
  const a = Buffer.from(checkoutCancelToken(bookingId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
