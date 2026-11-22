import { isCronRequest } from "@/server/cron-auth";
import { sendDueReminders } from "@/server/notifications";

/** Hourly: day-before and two-hours-before reminders, each sent once per booking. */
export async function GET(req: Request) {
  if (!isCronRequest(req)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await sendDueReminders());
}
