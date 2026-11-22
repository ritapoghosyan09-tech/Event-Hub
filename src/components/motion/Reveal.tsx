"use client";

import { motion, MotionConfig, type Variants } from "motion/react";
import type { ReactNode } from "react";

/** One timing language for the whole product. */
export const EASE = [0.22, 1, 0.36, 1] as const;
export const DUR = { fast: 0.14, base: 0.24, slow: 0.6 } as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  // Respects the visitor's reduced-motion setting everywhere Motion animates.
  return <MotionConfig reducedMotion="user" transition={{ ease: EASE, duration: DUR.slow }}>{children}</MotionConfig>;
}

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE } },
};

/** Fades and rises once as it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "header" | "li";
}) {
  const M = motion[as];
  return (
    <M
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      variants={rise}
      transition={{ delay }}
    >
      {children}
    </M>
  );
}

/** Children marked <StaggerItem> appear one after another (60 ms apart). */
export function Stagger({
  children,
  className,
  as = "div",
  gap = 0.06,
  onMount = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol";
  gap?: number;
  /** Animate immediately instead of waiting to scroll into view (for must-see content). */
  onMount?: boolean;
}) {
  const M = motion[as];
  return (
    <M
      className={className}
      initial="hidden"
      {...(onMount ? { animate: "show" } : { whileInView: "show", viewport: { once: true, margin: "0px 0px -10% 0px" } })}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </M>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const M = motion[as];
  return (
    <M className={className} variants={rise}>
      {children}
    </M>
  );
}
