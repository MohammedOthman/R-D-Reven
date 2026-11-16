import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * PRD §3.2: "Empty states explain why the screen matters and provide the
 * next allowed action; no blank dashboards." Always pass a title that says
 * why the screen matters, and an action when the user has one available.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      data-slot="emptystate"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border-default)] px-6 py-16 text-center',
        className,
      )}
    >
      <div className="bg-canvas text-muted-tertiary flex size-12 items-center justify-center rounded-full">
        {icon ?? <Inbox className="size-6" aria-hidden="true" />}
      </div>
      <p className="font-display text-ink text-base font-bold tracking-[var(--tracking-display)]">
        {title}
      </p>
      {description && <p className="font-body text-muted-body max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
