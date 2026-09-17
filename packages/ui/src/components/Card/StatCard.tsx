import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../../lib/cn';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  trend?: { direction: 'up' | 'down'; label: string; tone?: 'positive' | 'negative' };
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, trend, icon, className }: StatCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-label text-muted-tertiary text-xs font-medium tracking-[var(--tracking-label)] uppercase">
          {label}
        </span>
        {icon && <span className="text-accent">{icon}</span>}
      </div>
      <div className="font-display text-ink mt-2 text-3xl font-extrabold tracking-[var(--tracking-display)]">
        {value}
      </div>
      {trend && (
        <div
          className={cn(
            'font-body mt-2 inline-flex items-center gap-1 text-xs font-medium',
            (trend.tone ?? (trend.direction === 'up' ? 'positive' : 'negative')) === 'positive'
              ? 'text-status-positive'
              : 'text-status-alert',
          )}
        >
          {trend.direction === 'up' ? (
            <ArrowUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden="true" />
          )}
          {trend.label}
        </div>
      )}
    </Card>
  );
}
