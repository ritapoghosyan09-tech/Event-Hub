import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet" | "inverse" | "ghost-inverse";
type Size = "md" | "lg";

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold " +
  "transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(.22,1,.36,1)] " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:shadow-[var(--eh-focus-ring)]";

const variants: Record<Variant, string> = {
  primary: "bg-action text-cream hover:bg-action-hover hover:shadow-[0_10px_30px_-12px_rgba(41,61,86,.55)] active:bg-action-pressed",
  secondary: "border border-navy text-ink hover:bg-navy hover:text-cream",
  quiet: "bg-sunken text-ink hover:bg-[var(--eh-beige-deep)]",
  inverse: "bg-cream text-navy hover:bg-white hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]",
  "ghost-inverse": "border border-cream/40 text-cream hover:border-cream hover:bg-cream/10",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function ButtonLink({
  variant,
  size,
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function Button({
  variant,
  size,
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}
