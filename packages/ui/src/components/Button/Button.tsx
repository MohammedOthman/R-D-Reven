import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-body font-semibold rounded-md',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-deep active:bg-accent-deep shadow-xs',
        secondary:
          'bg-card text-ink border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-canvas',
        ghost: 'bg-transparent text-ink hover:bg-canvas',
        destructive: 'bg-status-alert text-white hover:brightness-110',
        link: 'bg-transparent text-accent underline-offset-4 hover:underline p-0 h-auto font-medium',
      },
      size: {
        sm: 'min-h-11 px-3 text-sm sm:min-h-9',
        md: 'min-h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11 shrink-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      disabled,
      leadingIcon,
      trailingIcon,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : leadingIcon}
        {children}
        {!loading && trailingIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';
