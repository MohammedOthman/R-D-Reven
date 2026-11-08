import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { inputVariants } from '../../lib/inputStyles';
import { cn } from '../../lib/cn';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps extends ComponentPropsWithoutRef<
  typeof SelectPrimitive.Trigger
> {
  invalid?: boolean;
}

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        inputVariants({ invalid }),
        'inline-flex items-center justify-between gap-2 text-start',
        'data-[placeholder]:text-muted-micro',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="text-muted-tertiary size-4 shrink-0" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  ),
);
SelectTrigger.displayName = 'SelectTrigger';

export function SelectContent({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'bg-card z-50 overflow-hidden rounded-md border border-[var(--border-default)] shadow-md',
          'font-body text-ink text-sm',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          className,
        )}
        position="popper"
        sideOffset={4}
        {...props}
      >
        <SelectPrimitive.Viewport className="max-h-72 p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export interface SelectItemProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  children: ReactNode;
}

export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer items-center rounded-sm py-2 ps-8 pe-2 text-sm select-none',
        'data-[highlighted]:bg-canvas outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute start-2 inline-flex items-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="text-accent size-4" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  ),
);
SelectItem.displayName = 'SelectItem';
