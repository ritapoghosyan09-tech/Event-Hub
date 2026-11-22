import type { ComponentProps, ReactNode } from "react";

export const INPUT =
  "mt-1.5 h-12 w-full rounded-input border border-line bg-white px-3.5 text-base text-ink-strong outline-none " +
  "transition-[border-color,box-shadow] hover:border-line-strong focus:border-ink-muted " +
  "focus:shadow-[0_0_0_3px_var(--eh-lavender-tint)] aria-[invalid=true]:border-danger disabled:bg-sunken disabled:text-ink-subtle";

export const TEXTAREA = INPUT.replace("h-12", "min-h-32 py-3 leading-relaxed");

/** Label, control, hint and error wired together for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  className = "",
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-strong">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  id,
  error,
  hint,
  className = "",
  ...props
}: ComponentProps<"input"> & { id: string; error?: string; hint?: ReactNode }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return <input id={id} aria-invalid={!!error} aria-describedby={describedBy} className={`${INPUT} ${className}`} {...props} />;
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "bg-[#f7e7e7] text-danger",
    success: "bg-[#e6efe6] text-success",
    info: "bg-sunken text-ink",
  }[tone];
  return (
    <p className={`rounded-input px-3.5 py-3 text-sm ${styles}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
