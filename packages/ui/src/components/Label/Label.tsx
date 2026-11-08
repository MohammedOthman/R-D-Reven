import { forwardRef } from 'react';
import type { LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  optional?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, optional, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'font-body text-ink inline-flex items-center gap-1 text-sm font-medium',
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-status-alert" aria-hidden="true">
          *
        </span>
      )}
      {optional && <span className="text-muted-tertiary text-xs font-normal">(optional)</span>}
    </label>
  ),
);
Label.displayName = 'Label';
