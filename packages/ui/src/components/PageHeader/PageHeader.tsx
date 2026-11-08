import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Adapts the brand doc's deck header rhythm (mono eyebrow → bold headline,
 * §08) to an application page header. No accent rule/underline is used here —
 * that motif is deck chrome, not a product-UI convention.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex flex-col gap-1.5 text-start">
        {eyebrow && (
          <span className="font-label text-muted-tertiary text-xs font-medium tracking-[var(--tracking-label-wide)] uppercase">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-ink text-2xl font-extrabold tracking-[var(--tracking-display)] text-balance">
          {title}
        </h1>
        {description && (
          <p className="font-body text-muted-body max-w-2xl text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
