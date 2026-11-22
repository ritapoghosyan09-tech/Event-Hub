"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While a card payment is being confirmed, re-check every two seconds for a minute. */
export function PendingRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (++n > 30) return clearInterval(t);
      router.refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <span className="mb-8 block h-1 w-40 overflow-hidden rounded-full bg-line" aria-hidden>
      <span className="block h-full w-1/3 animate-[eh-pending_1.4s_ease-in-out_infinite] rounded-full bg-navy" />
    </span>
  );
}
