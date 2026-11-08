import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Brand doc §09 component: "Pill — default / selected". Used for filter chips and mode toggles. */
export const Pill = forwardRef<HTMLButtonElement, PillProps>(
  ({ className, selected = false, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="button"
      aria-pressed={selected}
      className={cn(
        'rounded-pill font-body inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium transition-colors',
        'focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none',
        selected
          ? 'bg-accent text-white'
          : 'bg-card text-muted-body hover:text-ink border border-[var(--border-default)] hover:border-[var(--border-strong)]',
        className,
      )}
      {...props}
    />
  ),
);
Pill.displayName = 'Pill';
