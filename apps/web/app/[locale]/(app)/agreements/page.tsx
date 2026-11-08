import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getAgreements } from '@/src/lib/agreements/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { AgreementsContent } from './AgreementsContent';

// §2.3's "Agreements/rules" row: Admin=Admin, Executive=Read, Manager=
// Metadata, Reviewer=Review/approve, Guest=No by default.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function AgreementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('agreements.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [agreements, partnerships, partners] = await Promise.all([
    getAgreements(tenant.id),
    getPartnerships(tenant.id),
    getPartners(tenant.id),
  ]);

  return (
    <AgreementsContent
      tenantId={tenant.id}
      initialAgreements={agreements}
      partnerships={partnerships}
      partners={partners}
      currentRole={role}
    />
  );
}
