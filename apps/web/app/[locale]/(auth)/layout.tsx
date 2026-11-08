import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { CenteredCardLayout } from '@/src/components/CenteredCardLayout';

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CenteredCardLayout>{children}</CenteredCardLayout>;
}
