import { cn } from '../../lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer h-12 w-full rounded-lg bg-gradient-to-r", className)}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 p-4 bg-surface-0 rounded-lg border border-surface-3">
      <div className="h-4 w-3/4 bg-surface-3 rounded" />
      <div className="h-3 w-1/2 bg-surface-3 rounded" />
      <div className="h-3 w-3/4 bg-surface-3 rounded" />
      <div className="space-x-2 pt-3 mt-4">
        <div className="h-8 w-20 bg-surface-3 rounded-md" />
        <div className="h-8 w-24 bg-surface-3 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <div className="flex items-center p-4 space-x-4 bg-surface-0 border border-surface-3 rounded-lg">
      <div className="h-10 w-10 bg-surface-3 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-surface-3 rounded" />
        <div className="h-3 w-32 bg-surface-3 rounded" />
      </div>
      <div className="h-8 w-24 bg-surface-3 rounded-md" />
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div className="p-6 bg-surface-0 border border-surface-3 rounded-lg shadow-card">
      <div className="h-4 w-24 bg-surface-3 rounded mb-3" />
      <div className="h-12 w-3/4 bg-surface-3 rounded" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="h-64 bg-surface-3 rounded-lg animate-shimmer" />
  );
}

