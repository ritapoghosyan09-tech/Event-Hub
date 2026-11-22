"use client";

import { motion } from "motion/react";
import { EASE } from "@/components/motion/Reveal";

export function CategoryHeroText({ name, line, count }: { name: string; line: string; count: string }) {
  return (
    <>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="text-[15px] text-[#d5dbe3]">
        {count}
      </motion.p>
      <h1 className="mt-3 overflow-hidden pb-[0.08em] font-display text-[clamp(3rem,1.6rem+6vw,7rem)] font-normal leading-[0.95] tracking-[-0.025em]">
        <motion.span className="block" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.08 }}>
          {name}
        </motion.span>
      </h1>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.3 }} className="mt-4 max-w-xl text-xl text-[#e3e7ec]">
        {line}
      </motion.p>
    </>
  );
}
