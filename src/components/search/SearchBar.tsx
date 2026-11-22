"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { motion } from "motion/react";

const WHEN = [
  { value: "", label: "Any date" },
  { value: "today", label: "Next 24 hours" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
];

export function SearchBar({
  cities,
  defaults = {},
  size = "hero",
}: {
  cities: string[];
  defaults?: { q?: string; city?: string; when?: string; category?: string };
  size?: "hero" | "compact";
}) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(defaults.q ?? "");
  const [city, setCity] = useState(defaults.city ?? "");
  const [when, setWhen] = useState(defaults.when ?? "");
  const [pending, start] = useTransition();
  const hero = size === "hero";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (city.trim()) p.set("city", city.trim());
    if (when) p.set("when", when);
    if (defaults.category) p.set("category", defaults.category);
    start(() => router.push(`/events${p.size ? `?${p}` : ""}`));
  }

  const field =
    "group/field relative flex min-w-0 flex-col justify-center rounded-[20px] px-5 py-2.5 transition-colors duration-200 focus-within:bg-accent-surface hover:bg-canvas/70";
  const label = "text-xs font-semibold text-ink-muted";
  const input = "w-full min-w-0 bg-transparent text-base text-ink-strong outline-none placeholder:text-ink-disabled";

  return (
    <form
      role="search"
      onSubmit={submit}
      className={`grid w-full items-stretch gap-1 bg-surface p-2 text-left shadow-[0_24px_60px_-30px_rgba(20,31,45,.55)] ${
        hero
          ? "max-w-[980px] rounded-sheet md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          : "rounded-sheet border border-line md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      }`}
    >
      <div className={field}>
        <label htmlFor={`${id}-q`} className={label}>What</label>
        <input id={`${id}-q`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artist, event or venue" className={input} autoComplete="off" />
      </div>
      <div className={`${field} md:before:absolute md:before:inset-y-[22%] md:before:left-0 md:before:w-px md:before:bg-line-subtle`}>
        <label htmlFor={`${id}-city`} className={label}>Where</label>
        <input id={`${id}-city`} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Any city" list={`${id}-cities`} className={input} autoComplete="off" />
        <datalist id={`${id}-cities`}>
          {cities.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div className={`${field} md:before:absolute md:before:inset-y-[22%] md:before:left-0 md:before:w-px md:before:bg-line-subtle`}>
        <label htmlFor={`${id}-when`} className={label}>When</label>
        <select id={`${id}-when`} value={when} onChange={(e) => setWhen(e.target.value)} className={`${input} cursor-pointer appearance-none`}>
          {WHEN.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </div>
      <motion.button
        type="submit"
        whileTap={{ scale: 0.97 }}
        className={`relative m-1 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-action px-7 font-semibold text-cream transition-colors hover:bg-action-hover ${hero ? "h-14 text-base" : "h-12 text-sm"}`}
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {pending ? "Searching…" : "Search events"}
      </motion.button>
    </form>
  );
}
