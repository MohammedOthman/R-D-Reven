import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Label } from '../Label';
import { cn } from '../../lib/cn';

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Wires a Label, a control, a hint and an error message together with the
 * aria-describedby relationships screen readers need. Pass the control's id
 * as `id` and give the control itself `aria-invalid`/`aria-describedby` via
 * the same id conventions produced here (`${id}-hint`, `${id}-error`).
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} required={required} optional={optional}>
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="font-body text-muted-caption text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="font-body text-status-alert inline-flex items-center gap-1 text-xs"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
