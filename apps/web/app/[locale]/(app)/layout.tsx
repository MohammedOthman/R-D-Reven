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
  const pilotMode = process.env.PILOT_AUTO_LOGIN === 'true';
  const [user, { tenant, role }] = await Promise.all([getCurrentUser(), getCurrentTenant()]).catch(
    (error: unknown) => {
      if (pilotMode) return redirect({ href: '/pilot-unavailable', locale });
      throw error;
    },
  );
  if (!user) {
    return redirect({ href: '/sign-in', locale });
  }

  if (!tenant || !role) {
    return redirect({ href: '/create-organization', locale });
  }
  if (pilotMode && tenant.slug !== 'reven-pilot') {
    return redirect({ href: '/sign-in', locale });
  }

  return (
    <AppShell user={user} tenant={tenant} role={role} pilotMode={pilotMode}>
      {children}
    </AppShell>
  );
}
