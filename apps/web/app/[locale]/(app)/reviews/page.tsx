import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getReviews } from '@/src/lib/reviews/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getMemberDirectory } from '@/src/lib/members/session';
import { ReviewsContent } from './ReviewsContent';

// Borrows "Initiatives/actions" RBAC — no dedicated matrix row exists for Reviews.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER'];

export default async function ReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('reviews.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [reviews, partnerships, partners, members] = await Promise.all([
    getReviews(tenant.id),
    getPartnerships(tenant.id),
    getPartners(tenant.id),
    getMemberDirectory(tenant.id),
  ]);

  return (
    <ReviewsContent
      tenantId={tenant.id}
      initialReviews={reviews}
      partnerships={partnerships}
      partners={partners}
      members={members}
      currentRole={role}
    />
  );
}
