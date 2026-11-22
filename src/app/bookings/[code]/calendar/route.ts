import { getBookingByCode } from "@/server/bookings";

const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** An .ics file the visitor's calendar app opens: the event as booked. */
export async function GET(_req: Request, ctx: RouteContext<"/bookings/[code]/calendar">) {
  const { code } = await ctx.params;
  const b = await getBookingByCode(code);
  if (!b) return new Response("Booking not found", { status: 404 });

  const where = b.event.venue ? `${b.event.venue.name}, ${b.event.venue.address}, ${b.event.venue.city}` : "Online";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EVENT HUB//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${b.code}@eventhub`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.event.startsAt)}`,
    `DTEND:${stamp(b.event.endsAt)}`,
    `SUMMARY:${esc(b.event.title)}`,
    `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(`Booking ${b.code}, ${b.tickets.length} ticket(s). Hosted by ${b.event.organizer.name}.`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(b.event.title)} starts in 2 hours`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${b.code}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
