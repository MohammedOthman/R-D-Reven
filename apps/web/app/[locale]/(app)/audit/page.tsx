import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getAuditEvents } from '@/src/lib/audit/session';
import { getMemberDirectory } from '@/src/lib/members/session';
import { AuditContent } from './AuditContent';

// §2.3's "Audit/export" row: every role but Guest has some real access —
// Admin/Executive read broadly, Manager/Reviewer are scoped to their own
// actor by the API itself. See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('audit.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [initial, members] = await Promise.all([
    getAuditEvents(tenant.id),
    getMemberDirectory(tenant.id),
  ]);

  return (
    <AuditContent
      tenantId={tenant.id}
      initialEvents={initial.events}
      initialNextCursor={initial.nextCursor}
      members={members}
      currentRole={role}
    />
  );
}
