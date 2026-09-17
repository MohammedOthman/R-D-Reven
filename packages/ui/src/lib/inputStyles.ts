import { cva } from 'class-variance-authority';

/** Shared visual treatment for Input, Textarea, Select trigger and DateInput. */
export const inputVariants = cva(
  [
    'w-full font-body text-sm text-ink bg-card rounded-md border',
    'border-[var(--border-default)] placeholder:text-muted-micro',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:border-accent',
    'disabled:pointer-events-none disabled:opacity-50 disabled:bg-canvas',
  ],
  {
    variants: {
      invalid: {
        true: 'border-status-alert focus-visible:ring-status-alert/30 focus-visible:border-status-alert',
        false: '',
      },
      size: {
        sm: 'h-8 px-2.5 text-sm',
        md: 'h-10 px-3',
      },
    },
    defaultVariants: {
      invalid: false,
      size: 'md',
    },
  },
);
