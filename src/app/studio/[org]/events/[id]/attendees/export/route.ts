import { db } from "@/server/db";
import { AccessError, assertOrgAction } from "@/server/session";
import { getAttendees } from "@/server/studio";

const cell = (v: string) => {
  // Quote every cell; neutralise leading = + - @ so spreadsheets never run it as a formula.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Attendee list as CSV, for owners and admins. */
export async function GET(_req: Request, ctx: RouteContext<"/studio/[org]/events/[id]/attendees/export">) {
  const { org: slug, id } = await ctx.params;
  const org = await db.organization.findUnique({ where: { slug }, select: { id: true } });
  if (!org) return new Response("Not found", { status: 404 });
  try {
    await assertOrgAction(org.id, "attendees:export");
  } catch (e) {
    if (e instanceof AccessError) return new Response(e.message, { status: e.status });
    throw e;
  }
  const data = await getAttendees(org.id, id);
  if (!data) return new Response("Not found", { status: 404 });
  const header = ["Booking", "Name", "Email", "Ticket type", "Payment", "Status", "Checked in at (UTC)", "Booked at (UTC)"];
  const lines = data.rows.map((r) =>
    [r.code, r.name, r.email, r.ticketType, r.payment, r.status === "CHECKED_IN" ? "Checked in" : "Valid", r.checkedInAt ?? "", r.bookedAt].map((v) => cell(String(v))).join(","),
  );
  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees-${data.event.slug}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
