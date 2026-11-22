import Link from "next/link";
import type { ReactNode } from "react";
import { ROLE_LABEL, type MemberRole } from "@/server/permissions";

/** Studio frame: the organization's name and the studio's own navigation on a navy band. */
export function StudioShell({
  org,
  role,
  current,
  title,
  actions,
  crumbs,
  children,
}: {
  org: { slug: string; name: string };
  role: MemberRole | null;
  current?: "overview" | "settings";
  title: string;
  actions?: ReactNode;
  crumbs?: { href: string; label: string }[];
  children: ReactNode;
}) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${on ? "bg-cream text-navy" : "text-cream/80 hover:bg-cream/10 hover:text-cream"}`}>
      {label}
    </Link>
  );
  return (
    <div className="pb-24">
      <div className="bg-inverse pb-10 pt-28 text-cream md:pt-32">
        <div className="shell">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {tab(`/studio/${org.slug}`, "Overview", current === "overview")}
              {tab(`/studio/${org.slug}/settings`, "Profile and team", current === "settings")}
              <Link href={`/organizers/${org.slug}`} className="rounded-full px-4 py-2 text-sm font-medium text-cream/80 hover:bg-cream/10 hover:text-cream">
                Public page
              </Link>
            </div>
            <p className="text-sm text-cream/70">
              {org.name}
              {role ? `, ${ROLE_LABEL[role]}` : ", platform admin"}
            </p>
          </div>
          {crumbs && crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mt-8 flex flex-wrap gap-2 text-sm text-cream/70">
              {crumbs.map((c) => (
                <span key={c.href} className="flex items-center gap-2">
                  <Link href={c.href} className="underline-offset-4 hover:text-cream hover:underline">{c.label}</Link>
                  <span aria-hidden>/</span>
                </span>
              ))}
            </nav>
          )}
          <div className={`${crumbs?.length ? "mt-3" : "mt-10"} flex flex-wrap items-end justify-between gap-6`}>
            <h1 className="max-w-3xl font-display text-[clamp(2.3rem,1.5rem+2.6vw,3.8rem)] font-normal leading-[1.02]">{title}</h1>
            {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          </div>
        </div>
      </div>
      <div className="shell mt-10">{children}</div>
    </div>
  );
}

export function NotInRole({ what }: { what: string }) {
  return (
    <div className="rounded-card bg-surface p-8 ring-1 ring-line/60">
      <p className="font-display text-2xl text-ink-strong">Not part of your role</p>
      <p className="mt-2 max-w-xl text-ink-muted">Your role in this organization doesn&apos;t include {what}. An owner can change roles under Profile and team.</p>
    </div>
  );
}

export function StudioSkeleton() {
  return (
    <div className="pb-24" aria-hidden>
      <div className="bg-inverse pb-10 pt-28 md:pt-32">
        <div className="shell">
          <div className="h-9 w-72 rounded-full bg-cream/10" />
          <div className="mt-10 h-14 w-2/3 max-w-xl rounded-md bg-cream/10" />
        </div>
      </div>
      <div className="shell mt-10 space-y-4">
        <div className="skeleton h-28 rounded-card" />
        <div className="skeleton h-64 rounded-card" />
      </div>
    </div>
  );
}

export const SELECT =
  "mt-1.5 h-12 w-full appearance-none rounded-input border border-line bg-white bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5' fill='none' stroke='%23526780' stroke-width='1.8'/%3E%3C/svg%3E\")] bg-[length:18px] bg-[right_12px_center] bg-no-repeat px-3.5 pr-10 text-base text-ink-strong outline-none transition-[border-color,box-shadow] hover:border-line-strong focus:border-ink-muted focus:shadow-[0_0_0_3px_var(--eh-lavender-tint)]";

export const STATUS_STYLE: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-sunken text-ink" },
  PUBLISHED: { label: "On sale", tone: "bg-[#e6efe6] text-success" },
  CANCELLED: { label: "Cancelled", tone: "bg-[#f7e7e7] text-danger" },
  COMPLETED: { label: "Finished", tone: "bg-sunken text-ink-muted" },
};
