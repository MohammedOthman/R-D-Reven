import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { CalendarDays } from 'lucide-react';
import { inputVariants } from '../../lib/inputStyles';
import { cn } from '../../lib/cn';

export interface DateInputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>,
    VariantProps<typeof inputVariants> {}

/**
 * Native date input, styled to match the rest of the system. PRD §3.2: dates
 * display in tenant timezone with UTC storage; Hijri display is a later
 * configurable view, not a storage format — so this stays Gregorian-only
 * for now regardless of locale.
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, invalid, size, ...props }, ref) => (
    <div className="relative w-full">
      <input
        ref={ref}
        type="date"
        className={cn(
          inputVariants({ invalid, size }),
          'pe-9 [color-scheme:light]',
          '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
      <CalendarDays
        className="text-muted-tertiary pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  ),
);
DateInput.displayName = 'DateInput';
