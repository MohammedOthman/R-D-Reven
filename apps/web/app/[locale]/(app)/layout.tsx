import type { ReactNode } from 'react';
import { redirect } from '@/src/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/src/lib/auth/session';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { AppShell } from '@/src/components/AppShell';

export default async function AppLayout({
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

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role) {
    return redirect({ href: '/create-organization', locale });
  }

  return (
    <AppShell user={user} tenant={tenant} role={role}>
      {children}
    </AppShell>
  );
}
