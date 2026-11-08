import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForbiddenState } from '@revn/ui';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getReview } from '@/src/lib/reviews/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getMemberDirectory } from '@/src/lib/members/session';
import { ReviewWorkspace } from './ReviewWorkspace';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER'];

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ locale: string; reviewId: string }>;
}) {
  const { locale, reviewId } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const t = await getTranslations('reviews.forbidden');
    return <ForbiddenState title={t('title')} description={t('description')} />;
  }

  const [review, partnerships, partners, members] = await Promise.all([
    getReview(tenant.id, reviewId),
    getPartnerships(tenant.id),
    getPartners(tenant.id),
    getMemberDirectory(tenant.id),
  ]);

  if (!review) {
    notFound();
  }

  const partnership = partnerships.find((p) => p.id === review.partnershipId) ?? null;
  const partner = partnership
    ? (partners.find((p) => p.id === partnership.partnerId) ?? null)
    : null;

  return (
    <ReviewWorkspace
      tenantId={tenant.id}
      initialReview={review}
      partnerName={partner?.displayName ?? null}
      members={members}
      currentRole={role}
    />
  );
}
