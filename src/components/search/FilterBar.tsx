"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useId, useTransition } from "react";
import { EASE } from "@/components/motion/Reveal";

type Opt = { value: string; label: string };

const WHEN: Opt[] = [
  { value: "", label: "Any date" },
  { value: "today", label: "24 hours" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
];
const PRICE: Opt[] = [
  { value: "", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

const SELECT =
  "select-pill h-10 cursor-pointer rounded-full border border-line bg-surface pl-4 pr-10 text-sm font-medium text-ink-strong outline-none transition-colors hover:border-line-strong";

function Chips({ name, options, value, onPick }: { name: string; options: Opt[]; value: string; onPick: (v: string) => void }) {
  return (
    <LayoutGroup id={name}>
      <div role="radiogroup" aria-label={name} className={`no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 ${name === "Category" ? "md:flex-wrap md:overflow-visible" : "md:mx-0 md:shrink-0 md:overflow-visible md:px-0"}`}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value || "all"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(o.value)}
              className={`relative h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-200 ${on ? "text-ink-strong" : "text-ink-muted hover:text-ink-strong"}`}
            >
              {on && <motion.span layoutId="pill" className="absolute inset-0 rounded-full bg-lavender" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
              {!on && <span className="absolute inset-0 rounded-full border border-line" />}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export function FilterBar({ categories, cities }: { categories: { slug: string; name: string; upcoming: number }[]; cities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const uid = useId();

  const get = (k: string) => params.get(k) ?? "";
  function set(k: string, v: string) {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    start(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
  }
  const active = ["q", "category", "city", "when", "price"].filter((k) => get(k));

  return (
    <div className="relative">
      <AnimatePresence>
        {pending && (
          <motion.div
            className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-navy"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 0.85, transition: { duration: 1.2, ease: EASE } }}
            exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.3 } }}
          />
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <Chips
          name="Category"
          value={get("category")}
          onPick={(v) => set("category", v)}
          options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
        />
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
          <div className="contents md:flex md:flex-wrap md:items-center md:gap-x-4 md:gap-y-3">
            <Chips name="Date" value={get("when")} onPick={(v) => set("when", v)} options={WHEN} />
            <span className="hidden h-6 w-px bg-line md:block" aria-hidden />
            <Chips name="Price" value={get("price")} onPick={(v) => set("price", v)} options={PRICE} />
          </div>
          <div className="flex flex-wrap items-center gap-3 md:ml-auto">
            <label className="sr-only" htmlFor={`${uid}-city`}>City</label>
            <select
              id={`${uid}-city`}
              value={get("city")}
              onChange={(e) => set("city", e.target.value)}
              className={SELECT}
            >
              <option value="">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="sr-only" htmlFor={`${uid}-sort`}>Sort</label>
            <select
              id={`${uid}-sort`}
              value={get("sort") || "soonest"}
              onChange={(e) => set("sort", e.target.value === "soonest" ? "" : e.target.value)}
              className={SELECT}
            >
              <option value="soonest">Soonest first</option>
              <option value="price">Lowest price</option>
            </select>
            <AnimatePresence>
              {active.length > 0 && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  onClick={() => start(() => router.replace(pathname, { scroll: false }))}
                  className="h-10 rounded-full px-3 text-sm font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
                >
                  Clear filters
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div aria-live="polite" className="sr-only">{pending ? "Updating results" : ""}</div>
    </div>
  );
}
