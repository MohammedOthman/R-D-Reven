import type { HTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="presentation"
      className={cn('animate-pulse rounded-md bg-[var(--border-subtle)]', className)}
      {...props}
    />
  );
}

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** Full-region loading spinner. Prefer <Skeleton> for content that has a known shape. */
export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'text-muted-body flex flex-col items-center justify-center gap-3 py-16',
        className,
      )}
    >
      <Loader2 className="text-accent size-6 animate-spin" aria-hidden="true" />
      <span className="font-body text-sm">{label}</span>
    </div>
  );
}

/** Skeleton rows shaped like a data table, for list screens' loading state. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading table data">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
