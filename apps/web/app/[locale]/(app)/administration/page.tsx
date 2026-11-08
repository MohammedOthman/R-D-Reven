import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getMembers, getInvitations } from '@/src/lib/members/session';
import { AdministrationContent } from './AdministrationContent';

const ADMIN_ROLES = ['OWNER', 'ADMIN'];

export default async function AdministrationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !ADMIN_ROLES.includes(role)) {
    const t = await getTranslations('administration.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [members, invitations] = await Promise.all([
    getMembers(tenant.id),
    getInvitations(tenant.id),
  ]);

  return (
    <AdministrationContent
      tenantId={tenant.id}
      initialMembers={members}
      initialInvitations={invitations}
      currentRole={role}
    />
  );
}
