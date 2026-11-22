"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal row that starts aligned with the page column and bleeds to the
 * viewport edge. Scroll-snap on touch; arrow buttons on pointer devices.
 */
export function Scroller({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 280), behavior: "smooth" });
  };

  const pad = "max(var(--eh-gutter), calc((100vw - var(--eh-content-max)) / 2 + var(--eh-gutter)))";

  return (
    <div className="relative" role="region" aria-label={label}>
      <div
        ref={ref}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-6 pt-1"
        style={{ paddingInline: pad, scrollPaddingInline: pad }}
      >
        {children}
      </div>
      <div className="hidden justify-end gap-2 md:flex" style={{ paddingInline: pad }}>
        {([-1, 1] as const).map((d) => {
          const disabled = d === -1 ? edges.start : edges.end;
          return (
            <button
              key={d}
              type="button"
              onClick={() => step(d)}
              disabled={disabled}
              aria-label={d === -1 ? `Scroll ${label} back` : `Scroll ${label} forward`}
              className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink transition-[opacity,transform,background-color] duration-200 hover:bg-sunken active:scale-95 disabled:opacity-35"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path d={d === -1 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
