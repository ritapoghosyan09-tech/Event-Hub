"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { EASE } from "@/components/motion/Reveal";

type Img = { src: string; alt: string };

export function Gallery({ images }: { images: Img[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + images.length) % images.length)), [images.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, go]);

  if (images.length < 2) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <li key={img.src} className={i === 0 ? "col-span-2 row-span-2 sm:col-span-2" : ""}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group relative block h-full w-full overflow-hidden rounded-card bg-night-soft"
              aria-label={`View photo: ${img.alt}`}
            >
              <span className={`relative block ${i === 0 ? "aspect-[4/3]" : "aspect-[4/3] sm:h-full sm:aspect-auto"}`}>
                <Image src={img.src} alt={img.alt} fill sizes="(min-width:1024px) 30vw, 50vw" className="object-cover transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.05]" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {open !== null && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-night/95 p-4 sm:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
          >
            <AnimatePresence mode="wait">
              <motion.figure
                key={open}
                className="relative h-[72vh] w-full max-w-6xl"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
              >
                <Image src={images[open].src} alt={images[open].alt} fill sizes="100vw" className="object-contain" />
                <figcaption className="absolute -bottom-10 left-0 right-0 text-center text-sm text-[#c3cbd6]">
                  {images[open].alt}, {open + 1} of {images.length}
                </figcaption>
              </motion.figure>
            </AnimatePresence>
            {[-1, 1].map((d) => (
              <button
                key={d}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(d);
                }}
                aria-label={d < 0 ? "Previous photo" : "Next photo"}
                className={`absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-cream/10 text-cream transition hover:bg-cream/20 ${d < 0 ? "left-4" : "right-4"}`}
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path d={d < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}
            <button type="button" onClick={close} aria-label="Close photo viewer" className="absolute right-4 top-4 grid size-12 place-items-center rounded-full bg-cream/10 text-cream transition hover:bg-cream/20">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
