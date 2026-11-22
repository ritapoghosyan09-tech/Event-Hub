/** Initials disc used for organizers until they upload a logo. */
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

const SIZES = { sm: "size-14 text-xl", md: "size-16 text-2xl", lg: "size-24 text-4xl" } as const;

export function Monogram({ name, size = "md", tone = "navy", className = "" }: { name: string; size?: keyof typeof SIZES; tone?: "navy" | "cream"; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-display ${SIZES[size]} ${tone === "navy" ? "bg-navy text-cream" : "bg-cream text-navy shadow-[0_8px_20px_-8px_rgba(20,31,45,.6)]"} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
