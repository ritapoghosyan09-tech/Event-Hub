export function AuthHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-10">
      <h1 className="font-display text-[clamp(2.4rem,1.8rem+2vw,3.4rem)] font-normal leading-[1.02] text-ink-strong">{title}</h1>
      {lead && <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">{lead}</p>}
    </div>
  );
}

export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-5" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i}>
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton mt-2 h-12 rounded-input" />
        </div>
      ))}
      <div className="skeleton h-13 rounded-full" />
    </div>
  );
}
