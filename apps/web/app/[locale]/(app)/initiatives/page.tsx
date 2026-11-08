import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getInitiatives } from '@/src/lib/initiatives/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getMemberDirectory } from '@/src/lib/members/session';
import { InitiativesContent } from './InitiativesContent';

// PRD §2.3 "Initiatives/actions" — Admin/Executive/Manager only. Unlike
// "Portfolio read," Reviewer gets no access at all on this row.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER'];

export default async function InitiativesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('initiatives.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [initiatives, partnerships, partners, members] = await Promise.all([
    getInitiatives(tenant.id),
    getPartnerships(tenant.id),
    getPartners(tenant.id),
    getMemberDirectory(tenant.id),
  ]);

  return (
    <InitiativesContent
      tenantId={tenant.id}
      initialInitiatives={initiatives}
      partnerships={partnerships}
      partners={partners}
      members={members}
      currentRole={role}
    />
  );
}
