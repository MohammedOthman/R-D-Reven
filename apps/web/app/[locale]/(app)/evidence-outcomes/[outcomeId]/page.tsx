import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getCurrentUser } from '@/src/lib/auth/session';
import { getOutcome } from '@/src/lib/outcomes/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getMemberDirectory } from '@/src/lib/members/session';
import { OutcomeWorkspace } from './OutcomeWorkspace';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function OutcomeWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; outcomeId: string }>;
}) {
  const { locale, outcomeId } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('evidenceOutcomes.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const outcome = await getOutcome(tenant.id, outcomeId);
  if (!outcome) {
    notFound();
  }

  const [partnerships, partners, members, currentUser] = await Promise.all([
    getPartnerships(tenant.id),
    getPartners(tenant.id),
    getMemberDirectory(tenant.id),
    getCurrentUser(),
  ]);
  const partnership = partnerships.find((p) => p.id === outcome.partnershipId) ?? null;
  const partner = partnership
    ? (partners.find((p) => p.id === partnership.partnerId) ?? null)
    : null;

  return (
    <OutcomeWorkspace
      tenantId={tenant.id}
      initialOutcome={outcome}
      partnerName={partner?.displayName ?? null}
      members={members}
      currentRole={role}
      currentUserId={currentUser?.id ?? ''}
    />
  );
}
