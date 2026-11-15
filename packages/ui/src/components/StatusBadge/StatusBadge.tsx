import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

export const statusBadgeVariants = cva(
  'inline-flex max-w-full items-center gap-1.5 rounded-pill px-2.5 py-1 text-[13px] font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-canvas text-muted-body border border-[var(--border-default)]',
        accent: 'bg-accent/10 text-accent-deep',
        positive: 'bg-status-positive/10 text-status-positive',
        caution: 'bg-status-caution/10 text-status-caution',
        alert: 'bg-status-alert/10 text-status-alert',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  label: string;
  className?: string;
}

/**
 * Renders a domain state as a badge. `label` must be the localized display
 * label for an actual domain state — never invent a UI-only status here
 * (PRD §7.1).
 */
export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
