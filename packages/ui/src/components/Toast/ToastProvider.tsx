'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastVariant = 'default' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantIcon: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const variantIconColor: Record<ToastVariant, string> = {
  default: 'text-accent',
  success: 'text-status-positive',
  warning: 'text-status-caution',
  error: 'text-status-alert',
};

/** Radix wants a physical swipe direction; the viewport sits at the logical end (bottom-end). */
function useSwipeDirection(): 'left' | 'right' {
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  useEffect(() => {
    setDirection(document.documentElement.dir === 'rtl' ? 'left' : 'right');
  }, []);
  return direction;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const swipeDirection = useSwipeDirection();

  const toast = useCallback((options: ToastOptions) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, variant: 'default', durationMs: 5000, ...options }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection={swipeDirection}>
        {children}
        {toasts.map(({ id, title, description, variant = 'default', durationMs }) => {
          const Icon = variantIcon[variant];
          return (
            <ToastPrimitive.Root
              key={id}
              duration={durationMs}
              onOpenChange={(open) => !open && remove(id)}
              className={cn(
                'bg-card flex items-start gap-3 rounded-md border border-[var(--border-default)] p-4 shadow-lg',
                'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2',
                'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
                'data-[swipe=end]:animate-out data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
              )}
            >
              <Icon
                className={cn('size-5 shrink-0', variantIconColor[variant])}
                aria-hidden="true"
              />
              <div className="font-body flex-1">
                <ToastPrimitive.Title className="text-ink text-sm font-semibold">
                  {title}
                </ToastPrimitive.Title>
                {description && (
                  <ToastPrimitive.Description className="text-muted-body mt-0.5 text-sm">
                    {description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                aria-label="Dismiss"
                className="text-muted-tertiary hover:text-ink rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed end-0 bottom-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-6 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
