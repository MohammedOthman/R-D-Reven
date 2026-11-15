import { cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
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
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control =
    isValidElement<{ id?: string; 'aria-describedby'?: string }>(children) &&
    children.props.id === id
      ? cloneElement(
          children as ReactElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>,
          {
            'aria-describedby':
              [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') ||
              undefined,
            ...(error ? { 'aria-invalid': true } : {}),
          },
        )
      : children;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} required={required} optional={optional}>
        {label}
      </Label>
      {control}
      {hint && !error && (
        <p id={`${id}-hint`} className="font-body text-muted-caption text-[13px] leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="font-body text-status-alert inline-flex items-center gap-1 text-[13px]"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
