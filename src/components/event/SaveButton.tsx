"use client";

import { motion, AnimatePresence } from "motion/react";
import { toggleSaved, useSaved } from "@/lib/saved";

export function SaveButton({
  eventId,
  title,
  tone = "light",
  className = "",
}: {
  eventId: string;
  title: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const saved = useSaved().includes(eventId);
  return (
    <div className={className}>
    <motion.button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSaved(eventId);
      }}
      whileTap={{ scale: 0.88 }}
      className={`relative grid size-11 place-items-center rounded-full shadow-[0_6px_18px_-8px_rgba(20,31,45,.5)] backdrop-blur-[2px] transition-colors duration-200 ${
        tone === "light" ? "bg-cream/92 text-navy hover:bg-cream" : "bg-navy/70 text-cream hover:bg-navy"
      }`}
    >
      <motion.svg
        viewBox="0 0 24 24"
        className="size-5"
        animate={saved ? { scale: [1, 1.22, 1] } : { scale: 1 }}
        transition={{ duration: 0.34 }}
        aria-hidden
      >
        <path
          d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.6}
          style={{ transition: "fill 200ms" }}
        />
      </motion.svg>
      <AnimatePresence>
        {saved && (
          <motion.span
            key="ring"
            className="pointer-events-none absolute inset-0 rounded-full border border-current"
            initial={{ opacity: 0.6, scale: 0.8 }}
            animate={{ opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
    </motion.button>
    </div>
  );
}
