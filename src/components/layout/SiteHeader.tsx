"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { useSaved, useSavedAccountSync } from "@/lib/saved";
import { useSession } from "@/lib/auth-client";
import { initials } from "@/components/ui/Monogram";
import { EASE } from "@/components/motion/Reveal";

const NAV = [
  { href: "/events", label: "Explore" },
  { href: "/events?when=weekend", label: "This weekend" },
  { href: "/organizers", label: "Organizers" },
];

/** Pages whose first screen is a dark photograph: the header starts transparent over it. */
const OVERLAY = [/^\/$/, /^\/categories\/[^/]+$/];

export function SiteHeader() {
  const pathname = usePathname();
  const overlay = OVERLAY.some((r) => r.test(pathname));
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const saved = useSaved();
  const { data: session, isPending } = useSession();
  const user = session?.user ?? null;
  useSavedAccountSync(user?.id, isPending);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));
  // Close the mobile menu when the route changes (state adjusted during render, no effect needed).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const solid = !overlay || scrolled || open;
  const ink = solid ? "text-ink-strong" : "text-cream";
  const active = (href: string) => (href === "/events" ? pathname === "/events" : pathname.startsWith(href.split("?")[0]) && href !== "/events?when=weekend");

  return (
    <header className={`fixed inset-x-0 top-0 z-50 ${ink}`}>
      <motion.div
        aria-hidden
        className="absolute inset-0 border-b border-line/70 bg-canvas/95 backdrop-blur-md"
        initial={false}
        animate={{ opacity: solid ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      />
      <div className="shell relative flex h-18 items-center gap-6">
        <Link href="/" className="font-display text-[1.55rem] font-semibold tracking-[0.01em]" aria-label="EVENT HUB home">
          EVENT HUB
        </Link>

        <nav aria-label="Main" className="ml-6 hidden md:block" onMouseLeave={() => setHovered(null)}>
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href} className="relative" onMouseEnter={() => setHovered(n.href)}>
                <Link
                  href={n.href}
                  className={`relative z-10 block rounded-full px-4 py-2 text-sm font-medium transition-opacity ${active(n.href) ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
                  aria-current={active(n.href) ? "page" : undefined}
                >
                  {n.label}
                </Link>
                {hovered === n.href && (
                  <motion.span
                    layoutId="nav-hover"
                    className={`absolute inset-0 rounded-full ${solid ? "bg-sunken" : "bg-cream/12"}`}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                {active(n.href) && (
                  <motion.span layoutId="nav-active" className="absolute inset-x-4 -bottom-0.5 h-px bg-current" />
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/saved"
            className={`relative hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:flex ${solid ? "hover:bg-sunken" : "hover:bg-cream/12"}`}
          >
            <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
              <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="none" stroke="currentColor" strokeWidth={1.6} />
            </svg>
            Saved
            <AnimatePresence>
              {saved.length > 0 && (
                <motion.span
                  key={saved.length}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  className="grid h-5 min-w-5 place-items-center rounded-full bg-lavender px-1.5 text-[11px] font-semibold text-ink-strong"
                >
                  {saved.length}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          {user ? (
            <Link
              href="/account"
              aria-label={`Your account, ${user.name}`}
              className={`hidden items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-medium transition-colors sm:flex ${solid ? "hover:bg-sunken" : "hover:bg-cream/12"}`}
            >
              <span aria-hidden className={`grid size-7 place-items-center rounded-full font-display text-[13px] ${solid ? "bg-navy text-cream" : "bg-cream text-navy"}`}>
                {initials(user.name)}
              </span>
              {user.name.split(" ")[0]}
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className={`hidden rounded-full px-4 py-2 text-sm font-medium transition-[background-color,opacity] sm:block ${isPending ? "opacity-0" : "opacity-100"} ${solid ? "hover:bg-sunken" : "hover:bg-cream/12"}`}
            >
              Sign in
            </Link>
          )}
          <Link
            href="/events"
            className={`hidden h-10 items-center rounded-full px-5 text-sm font-semibold transition-colors sm:inline-flex ${
              solid ? "bg-action text-cream hover:bg-action-hover" : "bg-cream text-navy hover:bg-white"
            }`}
          >
            Find events
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="relative block h-3 w-5">
              <motion.span className="absolute left-0 top-0 h-px w-5 bg-current" animate={open ? { y: 6, rotate: 45 } : { y: 0, rotate: 0 }} />
              <motion.span className="absolute bottom-0 left-0 h-px w-5 bg-current" animate={open ? { y: -5, rotate: -45 } : { y: 0, rotate: 0 }} />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Mobile"
            className="relative h-[calc(100dvh-4.5rem)] overflow-y-auto bg-canvas px-[var(--eh-gutter)] pb-10 pt-6 text-ink-strong md:hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <motion.ul
              initial="h"
              animate="s"
              variants={{ h: {}, s: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } }}
              className="flex flex-col"
            >
              {[
                ...NAV,
                { href: "/saved", label: `Saved${saved.length ? ` (${saved.length})` : ""}` },
                user ? { href: "/account", label: "Your account" } : { href: "/sign-in", label: "Sign in" },
              ].map((n) => (
                <motion.li key={n.href} variants={{ h: { opacity: 0, y: 12 }, s: { opacity: 1, y: 0 } }} className="border-b border-line">
                  <Link href={n.href} className="block py-5 font-display text-4xl">
                    {n.label}
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
