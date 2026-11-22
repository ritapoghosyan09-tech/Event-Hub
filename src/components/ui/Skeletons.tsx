/** Loading states that match the final layout, so nothing jumps when data lands. */

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-rest" aria-hidden>
      <div className="skeleton aspect-[4/3]" />
      <div className="tear" />
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 p-5">
        <div className="skeleton h-12 rounded-md" />
        <div className="space-y-2.5">
          <div className="skeleton h-5 w-4/5 rounded-md" />
          <div className="skeleton h-4 w-3/5 rounded-md" />
          <div className="skeleton mt-5 h-4 w-1/4 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading events">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function EventDetailSkeleton() {
  return (
    <div className="shell pt-28" role="status" aria-label="Loading event">
      <div className="skeleton h-4 w-40 rounded-md" />
      <div className="skeleton mt-6 aspect-[4/3] rounded-sheet md:aspect-[21/9]" />
      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="skeleton h-4 w-56 rounded-md" />
          <div className="skeleton h-14 w-full rounded-md" />
          <div className="skeleton h-14 w-3/4 rounded-md" />
          <div className="skeleton mt-6 h-24 w-full rounded-card" />
        </div>
        <div className="skeleton h-[420px] rounded-sheet lg:col-span-5" />
      </div>
    </div>
  );
}
