import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getCommercialRules } from '@/src/lib/commercial-rules/session';
import { CommercialRulesContent } from './CommercialRulesContent';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function CommercialRulesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('commercialRules.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const commercialRules = await getCommercialRules(tenant.id);

  return (
    <CommercialRulesContent
      tenantId={tenant.id}
      initialCommercialRules={commercialRules}
      currentRole={role}
    />
  );
}
