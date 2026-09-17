import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { inputVariants } from '../../lib/inputStyles';
import { cn } from '../../lib/cn';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof inputVariants> {
  /** Shows a live "n / max" counter when maxLength is set. */
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, size: _size, showCount, maxLength, value, ...props }, ref) => {
    const length = typeof value === 'string' ? value.length : 0;
    return (
      <div className="relative w-full">
        <textarea
          ref={ref}
          className={cn(
            inputVariants({ invalid }),
            'h-auto min-h-24 resize-y py-2.5',
            showCount && maxLength ? 'pb-6' : '',
            className,
          )}
          aria-invalid={invalid || undefined}
          maxLength={maxLength}
          value={value}
          {...props}
        />
        {showCount && maxLength && (
          <span className="font-label text-muted-micro pointer-events-none absolute end-3 bottom-2 text-xs tabular-nums">
            {length}/{maxLength}
          </span>
        )}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
