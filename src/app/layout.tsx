import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MotionProvider } from "@/components/motion/Reveal";

const bodoni = localFont({
  src: [
    { path: "../fonts/bodoni-moda-latin-opsz-normal.woff2", style: "normal" },
    { path: "../fonts/bodoni-moda-latin-opsz-italic.woff2", style: "italic" },
  ],
  weight: "400 900",
  variable: "--font-bodoni",
  display: "swap",
});

const hanken = localFont({
  src: [{ path: "../fonts/hanken-grotesk-latin-wght-normal.woff2", style: "normal" }],
  weight: "100 900",
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "EVENT HUB: concerts, conferences, exhibitions and workshops", template: "%s · EVENT HUB" },
  description: "Discover live events in cities around the world and book tickets in a minute.",
};

export const viewport: Viewport = {
  themeColor: "#F5F0E8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${hanken.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-navy focus:px-4 focus:py-2 focus:text-cream">
          Skip to content
        </a>
        <MotionProvider>
          <Suspense
            fallback={
              <header className="fixed inset-x-0 top-0 z-50 border-b border-line/70 bg-canvas/95 text-ink-strong">
                <div className="shell flex h-18 items-center">
                  <Link href="/" className="font-display text-[1.55rem] font-semibold">EVENT HUB</Link>
                </div>
              </header>
            }
          >
            <SiteHeader />
          </Suspense>
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </MotionProvider>
      </body>
    </html>
  );
}
