/**
 * Converting between a wall-clock time in an IANA zone ("2026-12-14T20:00"
 * in Europe/Amsterdam) and a UTC instant, using only Intl. Organizers type
 * times as the venue's local time; the database stores UTC.
 */

function offsetMinutes(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - instant.getTime()) / 60_000;
}

/** "2026-12-14T20:00" in `timeZone` → the UTC instant. Returns null for an unparseable value. */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset, including across a DST change.
  let t = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  t = guess - offsetMinutes(new Date(t), timeZone) * 60_000;
  return new Date(t);
}

/** The UTC instant → "2026-12-14T20:00" as shown on a clock in `timeZone` (for datetime-local inputs). */
export function utcToZonedLocal(instant: Date, timeZone: string) {
  const shifted = new Date(instant.getTime() + offsetMinutes(instant, timeZone) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Every zone the runtime knows, for the venue time-zone picker. */
export function timeZones(): string[] {
  const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
  return list?.length ? list : ["UTC", "Europe/London", "Europe/Lisbon", "Europe/Berlin", "Europe/Amsterdam", "Asia/Yerevan", "America/New_York"];
}
