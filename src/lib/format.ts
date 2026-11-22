/** Formatting helpers. Every event time renders in the venue's own time zone. */

export function formatMoney(amountMinor: number, currency: string) {
  const zeroDecimal = ["JPY", "KRW"].includes(currency);
  const amount = zeroDecimal ? amountMinor : amountMinor / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    currencyDisplay: currency === "AMD" ? "code" : "narrowSymbol",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function priceLabel(e: { isFree: boolean; minPriceMinor: number | null; currency: string | null }) {
  if (e.isFree) return "Free";
  if (e.minPriceMinor == null || !e.currency) return "Tickets soon";
  if (e.minPriceMinor === 0) return "Free entry";
  return `From ${formatMoney(e.minPriceMinor, e.currency)}`;
}

function parts(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, ...opts }).format(date);
}

/** "Sat 14 Mar" */
export const dayLabel = (d: Date, tz: string) => parts(d, tz, { weekday: "short", day: "numeric", month: "short" });
/** "Mar" / "14" for the date stub */
export const monthShort = (d: Date, tz: string) => parts(d, tz, { month: "short" });
export const dayNumber = (d: Date, tz: string) => parts(d, tz, { day: "numeric" });
/** "19:30" — 24h reads cleanly across the global audience */
export const timeLabel = (d: Date, tz: string) => parts(d, tz, { hour: "2-digit", minute: "2-digit", hour12: false });
/** "Saturday 14 March 2027" */
export const longDate = (d: Date, tz: string) =>
  parts(d, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function timeRange(start: Date, end: Date, tz: string) {
  const sameDay = dayLabel(start, tz) === dayLabel(end, tz);
  return sameDay
    ? `${timeLabel(start, tz)} to ${timeLabel(end, tz)}`
    : `${dayLabel(start, tz)}, ${timeLabel(start, tz)} to ${dayLabel(end, tz)}, ${timeLabel(end, tz)}`;
}

export function cityTimeZoneNote(tz: string) {
  const city = tz.split("/").pop()?.replace(/_/g, " ");
  return `${city} time`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
