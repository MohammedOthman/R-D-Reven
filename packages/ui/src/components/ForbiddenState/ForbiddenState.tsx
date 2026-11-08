import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ForbiddenStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * PRD §3.2: disabled/denied actions should explain the missing requirement
 * "where disclosure is safe" — never reveal restricted object existence.
 * Keep `description` generic unless the caller has confirmed it's safe to
 * name the specific missing permission.
 */
export function ForbiddenState({
  title = "You don't have access to this",
  description = 'Ask a workspace admin if you believe this is a mistake.',
  action,
  className,
}: ForbiddenStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'bg-card flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border-default)] px-6 py-16 text-center',
        className,
      )}
    >
      <div className="bg-canvas text-muted-tertiary flex size-12 items-center justify-center rounded-full">
        <ShieldAlert className="size-6" aria-hidden="true" />
      </div>
      <h3 className="font-display text-ink text-base font-bold tracking-[var(--tracking-display)]">
        {title}
      </h3>
      <p className="font-body text-muted-body max-w-sm text-sm">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
