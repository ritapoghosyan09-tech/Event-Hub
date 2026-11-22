"use client";

import { motion } from "motion/react";

export function SuccessMark() {
  return (
    <motion.svg viewBox="0 0 64 64" className="size-16 text-success" aria-hidden initial="h" animate="s">
      <motion.circle
        cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2"
        variants={{ h: { pathLength: 0, opacity: 0 }, s: { pathLength: 1, opacity: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } } }}
      />
      <motion.path
        d="M20 33.5l8 8 16-18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        variants={{ h: { pathLength: 0 }, s: { pathLength: 1, transition: { delay: 0.45, duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}
      />
    </motion.svg>
  );
}
