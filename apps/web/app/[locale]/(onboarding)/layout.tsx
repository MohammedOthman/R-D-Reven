import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/src/i18n/navigation';
import { getCurrentUser } from '@/src/lib/auth/session';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { CenteredCardLayout } from '@/src/components/CenteredCardLayout';

export default async function OnboardingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    return redirect({ href: '/sign-in', locale });
  }

  const { tenant } = await getCurrentTenant();
  if (tenant) {
    return redirect({ href: '/workspace', locale });
  }

  return <CenteredCardLayout>{children}</CenteredCardLayout>;
}
