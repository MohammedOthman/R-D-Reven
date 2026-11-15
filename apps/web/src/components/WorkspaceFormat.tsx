'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useLocale } from 'next-intl';

const TimezoneContext = createContext('Asia/Riyadh');
export function WorkspaceFormatProvider({
  timezone,
  children,
}: {
  timezone: string;
  children: ReactNode;
}) {
  return <TimezoneContext.Provider value={timezone}>{children}</TimezoneContext.Provider>;
}

export function formatWorkspaceDate(
  value: string,
  locale: string,
  timezone: string,
  withTime = false,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: timezone,
  };
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date);
  }
}

export function useWorkspaceDate() {
  const locale = useLocale();
  const timezone = useContext(TimezoneContext);
  return useCallback(
    (value: string, withTime = false) => formatWorkspaceDate(value, locale, timezone, withTime),
    [locale, timezone],
  );
}

export function WorkspaceDate({ value, withTime = false }: { value: string; withTime?: boolean }) {
  const formatDate = useWorkspaceDate();
  return <time dateTime={value}>{formatDate(value, withTime)}</time>;
}
