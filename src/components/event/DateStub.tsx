import { dayNumber, monthShort } from "@/lib/format";

/** The ticket stub's date block: month over a large Bodoni day, in the venue's time zone. */
export function DateStub({ iso, timezone }: { iso: string; timezone: string }) {
  const d = new Date(iso);
  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r border-line-subtle pr-4 pt-1" aria-hidden>
      <span className="text-xs font-semibold text-ink-muted">{monthShort(d, timezone)}</span>
      <span className="font-display text-[2.1rem] leading-none text-ink-strong">{dayNumber(d, timezone)}</span>
    </div>
  );
}
