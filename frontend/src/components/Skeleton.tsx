// frontend/src/components/Skeleton.tsx

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-atmr-m bg-atmr-bg-surface3 ${className}`}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-atmr-bg-surface1 rounded-atmr-xl border border-atmr-border-soft overflow-hidden">
      <div
        className="bg-atmr-bg-surface2 px-5 py-3 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="px-5 py-4 border-t border-atmr-border-soft grid gap-4 items-center"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          <Skeleton className="h-9 w-9 rounded-atmr-m" />
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <Skeleton key={c} className="h-3 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-atmr-bg-surface1 rounded-atmr-xl p-5 border border-atmr-border-soft space-y-3"
        >
          <Skeleton className="h-10 w-10 rounded-atmr-l" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-16 rounded-atmr-full" />
            <Skeleton className="h-6 w-16 rounded-atmr-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-atmr-bg-surface1 rounded-atmr-xl p-5 border border-atmr-border-soft space-y-3"
        >
          <Skeleton className="h-10 w-10 rounded-atmr-l" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <StatsSkeleton />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-atmr-bg-surface1 rounded-atmr-xl p-6 border border-atmr-border-soft space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="bg-atmr-bg-surface1 rounded-atmr-xl p-6 border border-atmr-border-soft space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}