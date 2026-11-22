import { revalidateTag } from "next/cache";
import { isCronRequest } from "@/server/cron-auth";
import { expireStaleHolds } from "@/server/payments";

/** Every few minutes: seats held for a checkout that was never paid go back on sale. */
export async function GET(req: Request) {
  if (!isCronRequest(req)) return new Response("Unauthorized", { status: 401 });
  const result = await expireStaleHolds();
  if (result.expired) revalidateTag("events", "max");
  return Response.json(result);
}
