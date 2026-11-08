import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getPartners } from '@/src/lib/partners/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getMemberDirectory } from '@/src/lib/members/session';
import { PartnershipsContent } from './PartnershipsContent';

// PRD §2.3 "Portfolio read" — everyone except Guest (see AppShell's nav
// filtering and docs/DECISIONS.md for why Guest has no path to this yet).
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function PartnershipsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('partnerships.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [partners, partnerships, members] = await Promise.all([
    getPartners(tenant.id),
    getPartnerships(tenant.id),
    getMemberDirectory(tenant.id),
  ]);

  return (
    <PartnershipsContent
      tenantId={tenant.id}
      initialPartners={partners}
      initialPartnerships={partnerships}
      members={members}
      currentRole={role}
    />
  );
}
