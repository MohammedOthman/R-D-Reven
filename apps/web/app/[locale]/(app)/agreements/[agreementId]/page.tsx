import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getAgreement } from '@/src/lib/agreements/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getInitiatives } from '@/src/lib/initiatives/session';
import { AgreementWorkspace } from './AgreementWorkspace';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function AgreementDetailPage({
  params,
}: {
  params: Promise<{ locale: string; agreementId: string }>;
}) {
  const { locale, agreementId } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('agreements.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [agreement, partnerships, partners, initiatives] = await Promise.all([
    getAgreement(tenant.id, agreementId),
    getPartnerships(tenant.id),
    getPartners(tenant.id),
    getInitiatives(tenant.id),
  ]);

  if (!agreement) {
    notFound();
  }

  const partnership = partnerships.find((p) => p.id === agreement.partnershipId) ?? null;
  const partner = partnership ? (partners.find((p) => p.id === partnership.partnerId) ?? null) : null;

  return (
    <AgreementWorkspace
      tenantId={tenant.id}
      initialAgreement={agreement}
      partnerName={partner?.displayName ?? null}
      initiatives={initiatives}
      currentRole={role}
    />
  );
}
