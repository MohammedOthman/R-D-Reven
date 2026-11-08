import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { inputVariants } from '../../lib/inputStyles';
import { cn } from '../../lib/cn';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, VariantProps<typeof inputVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, size, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputVariants({ invalid, size }), className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
