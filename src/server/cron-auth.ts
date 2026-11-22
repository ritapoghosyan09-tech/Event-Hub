import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Scheduled jobs call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron and Render cron both can). */
export function isCronRequest(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}
