import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getInitiative } from '@/src/lib/initiatives/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getMemberDirectory } from '@/src/lib/members/session';
import { InitiativeWorkspace } from './InitiativeWorkspace';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER'];

export default async function InitiativeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; initiativeId: string }>;
}) {
  const { locale, initiativeId } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('initiatives.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [initiative, partnerships, partners, members] = await Promise.all([
    getInitiative(tenant.id, initiativeId),
    getPartnerships(tenant.id),
    getPartners(tenant.id),
    getMemberDirectory(tenant.id),
  ]);

  if (!initiative) {
    notFound();
  }

  const partnership = partnerships.find((p) => p.id === initiative.partnershipId) ?? null;
  const partner = partnership
    ? (partners.find((p) => p.id === partnership.partnerId) ?? null)
    : null;

  return (
    <InitiativeWorkspace
      tenantId={tenant.id}
      initialInitiative={initiative}
      partnerName={partner?.displayName ?? null}
      members={members}
      currentRole={role}
    />
  );
}
