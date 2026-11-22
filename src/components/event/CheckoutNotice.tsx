"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shown when someone comes back from the card checkout without paying.
 * Releases their held seats (a POST, so prefetching the return link can't),
 * then tidies the address bar.
 */
export function CheckoutNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const booking = params.get("booking");
  const token = params.get("token");
  const back = params.get("checkout") === "cancelled";
  const [released, setReleased] = useState<boolean | null>(null);

  useEffect(() => {
    if (!back || !booking || !token) return;
    let live = true;
    fetch("/api/checkout/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking, token }) })
      .then((r) => r.json())
      .then((d: { released?: boolean }) => {
        if (!live) return;
        setReleased(Boolean(d.released));
        window.history.replaceState(null, "", `${window.location.pathname}?checkout=cancelled`);
        router.refresh();
      })
      .catch(() => live && setReleased(false));
    return () => {
      live = false;
    };
  }, [back, booking, token, router]);

  if (!back) return null;
  return (
    <p role="status" className="mb-4 rounded-card bg-sunken px-5 py-4 text-[15px] text-ink">
      {released === null && booking ? "Payment cancelled. Releasing your seats…" : "Payment cancelled, so nothing was charged and your seats were released. You can book again below."}
    </p>
  );
}
