import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EmptyState, ForbiddenState } from '@revn/ui';
import { Network } from 'lucide-react';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getEcosystemGraph } from '@/src/lib/ecosystem/session';
import { EcosystemContent } from './EcosystemContent';

// PRD §2.3 "Portfolio read" shape — everyone inside the tenant except Guest.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function EcosystemPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('ecosystem.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  let graph = null;
  try {
    graph = await getEcosystemGraph(tenant.id, { failOnError: true });
  } catch {
    graph = null;
  }

  if (!graph) {
    const t = await getTranslations('ecosystem');
    return (
      <EmptyState
        icon={<Network className="size-6" aria-hidden="true" />}
        title={t('errorTitle')}
        description={t('errorDescription')}
      />
    );
  }

  return (
    <EcosystemContent
      tenantId={tenant.id}
      graph={graph}
      pilotMode={process.env.PILOT_AUTO_LOGIN === 'true'}
      currentRole={role}
    />
  );
}
