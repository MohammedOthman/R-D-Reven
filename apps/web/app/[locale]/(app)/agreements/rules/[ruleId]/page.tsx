import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getCommercialRule } from '@/src/lib/commercial-rules/session';
import { CommercialRuleWorkspace } from './CommercialRuleWorkspace';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function CommercialRuleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; ruleId: string }>;
}) {
  const { locale, ruleId } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('commercialRules.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const commercialRule = await getCommercialRule(tenant.id, ruleId);
  if (!commercialRule) {
    notFound();
  }

  return (
    <CommercialRuleWorkspace tenantId={tenant.id} initialRule={commercialRule} currentRole={role} />
  );
}
