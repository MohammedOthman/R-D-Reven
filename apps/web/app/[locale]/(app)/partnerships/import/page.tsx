import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { ImportWizard } from './ImportWizard';

// S03's own screen-actor line names "Admin" specifically — narrower than
// Partnership's Owner/Admin/Manager write set. See docs/DECISIONS.md.
const WRITE_ROLES = ['OWNER', 'ADMIN'];

export default async function ImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !WRITE_ROLES.includes(role)) {
    const t = await getTranslations('partnerships.import.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  return <ImportWizard tenantId={tenant.id} />;
}
