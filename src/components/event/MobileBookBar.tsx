"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { EASE } from "@/components/motion/Reveal";

/** Phones only: a slim bar that appears once the title scrolls away and hides when the ticket panel is on screen. */
export function MobileBookBar({ price, label, target }: { price: string; label: string; target: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const panel = document.getElementById(target);
    let panelVisible = false;
    const io = panel
      ? new IntersectionObserver(([e]) => {
          panelVisible = e.isIntersecting;
          update();
        })
      : null;
    if (panel && io) io.observe(panel);
    function update() {
      setShow(window.scrollY > 520 && !panelVisible);
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      io?.disconnect();
    };
  }, [target]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 px-[var(--eh-gutter)] pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md lg:hidden"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold text-ink-strong">{price}</span>
            <a href={`#${target}`} className="inline-flex h-12 items-center rounded-full bg-action px-6 font-semibold text-cream active:scale-[0.97]">
              {label}
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
