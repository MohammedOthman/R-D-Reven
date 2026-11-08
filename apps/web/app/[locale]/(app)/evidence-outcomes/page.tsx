import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getOutcomes } from '@/src/lib/outcomes/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getInitiatives } from '@/src/lib/initiatives/session';
import { EvidenceOutcomesContent } from './EvidenceOutcomesContent';

// §2.3's "Evidence/outcomes" row: every role but Guest has some real access —
// Executive reads, Manager creates, Reviewer verifies if assigned, Admin/
// Owner have full control. See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function EvidenceOutcomesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('evidenceOutcomes.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [outcomes, partnerships, partners, initiatives] = await Promise.all([
    getOutcomes(tenant.id),
    getPartnerships(tenant.id),
    getPartners(tenant.id),
    getInitiatives(tenant.id),
  ]);

  return (
    <EvidenceOutcomesContent
      tenantId={tenant.id}
      initialOutcomes={outcomes}
      partnerships={partnerships}
      partners={partners}
      initiatives={initiatives}
      currentRole={role}
    />
  );
}
