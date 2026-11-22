import { getEventsByIds } from "@/server/discovery";

/** GET /api/events?ids=a,b,c — public event cards by id (used by Saved). */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 100);
  const events = await getEventsByIds(ids);
  return Response.json({ events }, { headers: { "Cache-Control": "public, max-age=60" } });
}
