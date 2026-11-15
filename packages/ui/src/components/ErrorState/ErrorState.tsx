import type { ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'The request failed. Try again, or contact support if this keeps happening.',
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'bg-card flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border-default)] px-6 py-16 text-center',
        className,
      )}
    >
      <div className="bg-status-alert/10 text-status-alert flex size-12 items-center justify-center rounded-full">
        <AlertOctagon className="size-6" aria-hidden="true" />
      </div>
      <p className="font-display text-ink text-base font-bold tracking-[var(--tracking-display)]">
        {title}
      </p>
      <p className="font-body text-muted-body max-w-sm text-sm">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
