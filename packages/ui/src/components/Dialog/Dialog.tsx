import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  showClose = true,
  closeLabel = 'Close',
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showClose?: boolean;
  closeLabel?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'bg-ink/50 fixed inset-0 z-50',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain',
          'bg-card rounded-lg border border-[var(--border-default)] shadow-lg',
          'font-body p-6',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className="text-muted-body hover:text-ink absolute end-2 top-2 flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none"
            aria-label={closeLabel}
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-col gap-1.5 pe-8 text-start', className)}>{children}</div>
  );
}

export function DialogTitle({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'font-display text-ink text-lg font-bold tracking-[var(--tracking-display)]',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

export function DialogDescription({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('font-body text-muted-body text-sm', className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Description>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
