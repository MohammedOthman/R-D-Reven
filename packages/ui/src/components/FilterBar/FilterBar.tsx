import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface FilterBarProps {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Layout shell for a list screen's filter row. Compose with SearchInput, Select and Pill. */
export function FilterBar({ search, filters, actions, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col gap-3 rounded-lg border border-[var(--border-default)] p-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {search && <div className="w-full sm:max-w-xs">{search}</div>}
        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
