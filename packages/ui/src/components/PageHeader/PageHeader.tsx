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
      data-slot="pageheader"
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex min-w-0 flex-col gap-2 text-start">
        {eyebrow && <span className="text-muted-body text-[13px] font-medium">{eyebrow}</span>}
        <h1 className="font-display text-ink text-2xl font-bold tracking-[var(--tracking-display)] text-balance sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="font-body text-muted-body max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}
