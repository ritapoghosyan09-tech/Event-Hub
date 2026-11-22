"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { EventCardData } from "@/server/discovery";
import { dayLabel, timeLabel } from "@/lib/format";
import { SearchBar } from "@/components/search/SearchBar";
import { EASE } from "@/components/motion/Reveal";

const INTERVAL = 7000;
const LINES = ["Find the night", "you'll still be", "talking about."];

export function Hero({
  featured,
  cities,
  stats,
}: {
  featured: EventCardData[];
  cities: string[];
  stats: { events: number; cities: number; organizers: number };
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const slides = featured.filter((f) => f.image);
  const current = slides[index % Math.max(slides.length, 1)];

  useEffect(() => {
    if (reduce || paused || slides.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), INTERVAL);
    return () => clearTimeout(t);
  }, [index, paused, reduce, slides.length]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <section
      aria-label="Featured events"
      className="relative isolate flex min-h-[max(680px,min(100svh,940px))] flex-col overflow-hidden bg-night text-cream"
    >
      {/* Photography: crossfade between featured events, each drifting slowly */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        <AnimatePresence initial={false}>
          {current?.image && (
            <motion.div
              key={current.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: EASE }}
            >
              <div className="drift absolute inset-0">
                <Image src={current.image.src} alt="" fill priority={index === 0} sizes="100vw" className="object-cover" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,31,45,.92)_0%,rgba(20,31,45,.72)_38%,rgba(20,31,45,.18)_72%,rgba(20,31,45,.35)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(180deg,rgba(20,31,45,0)_0%,rgba(20,31,45,.85)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(20,31,45,.65),rgba(20,31,45,0))]" />
      </div>

      <div className="shell flex flex-1 flex-col justify-end pb-12 pt-32 md:pb-16">
        <motion.p
          className="text-[15px] text-[#d5dbe3]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
        >
          {stats.events} upcoming events in {stats.cities} cities, from {stats.organizers} organizers
        </motion.p>

        <h1 className="mt-4 font-display text-[clamp(3rem,1.4rem+6.4vw,7.25rem)] font-normal leading-[0.96] tracking-[-0.025em]">
          {LINES.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block"
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.12 + i * 0.09 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <div className="mt-10 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.42 }}
          >
            <SearchBar cities={cities} />
          </motion.div>

          {current && (
            <motion.aside
              aria-label="Now featuring"
              className="rounded-card border border-cream/15 bg-night/55 p-5 backdrop-blur-md"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            >
              <p className="text-xs font-medium text-[#b9c3cf]">Now featuring</p>
              <div className="relative mt-2 lg:min-h-[92px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <Link href={`/events/${current.slug}`} className="group/f block">
                      <span className="font-display text-[1.45rem] leading-tight decoration-cream/40 underline-offset-4 group-hover/f:underline">
                        {current.title}
                      </span>
                      <span className="mt-1.5 block text-sm text-[#c9d1dc]">
                        {dayLabel(new Date(current.startsAt), current.timezone)}, {timeLabel(new Date(current.startsAt), current.timezone)} in {current.city}
                      </span>
                    </Link>
                  </motion.div>
                </AnimatePresence>
              </div>
              {slides.length > 1 && (
                <div className="mt-3 flex gap-1.5" role="group" aria-label="Choose featured event">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Show ${s.title}`}
                      aria-current={i === index}
                      className="relative h-6 flex-1 cursor-pointer"
                    >
                      <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-cream/20">
                        {i === index && (
                          <motion.span
                            key={`${s.id}-${paused}`}
                            className="absolute inset-y-0 left-0 rounded-full bg-cream"
                            initial={{ width: reduce || paused ? "100%" : "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: reduce || paused ? 0 : INTERVAL / 1000, ease: "linear" }}
                          />
                        )}
                        {i < index && <span className="absolute inset-0 rounded-full bg-cream/60" />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.aside>
          )}
        </div>
      </div>
    </section>
  );
}
