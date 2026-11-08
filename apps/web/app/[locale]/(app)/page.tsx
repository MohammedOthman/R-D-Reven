import { setRequestLocale, getTranslations } from 'next-intl/server';
import {
  AlertTriangle,
  CalendarClock,
  Gavel,
  Handshake,
  Plug,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  StatusBadge,
} from '@revn/ui';
import { Link } from '@/src/i18n/navigation';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getDashboard } from '@/src/lib/dashboard/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getMemberDirectory } from '@/src/lib/members/session';

// No PRD matrix row is named "Command Center" — US-006 traces it to
// PORT/RPT, so this borrows "Portfolio read"'s shape (Reviewer included,
// same as Partner/Partnership lists). Guest gets a lighter landing message
// below rather than a hard Forbidden page, since `/` is the default
// post-sign-in destination for every role, not a link a Guest chose to
// follow. See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

export default async function CommandCenterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  const t = await getTranslations('commandCenter');

  if (!tenant || !role || !READ_ROLES.includes(role)) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <EmptyState
          icon={<Handshake className="size-6" aria-hidden="true" />}
          title={t('guestTitle')}
          description={t('guestDescription')}
        />
      </div>
    );
  }

  const [dashboard, partnerships, partners, members] = await Promise.all([
    getDashboard(tenant.id),
    getPartnerships(tenant.id),
    getPartners(tenant.id),
    getMemberDirectory(tenant.id),
  ]);

  if (!dashboard) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <EmptyState title={t('errorTitle')} description={t('errorDescription')} />
      </div>
    );
  }

  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const partnerNameForPartnership = (partnershipId: string) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return '—';
    return partnerById.get(partnership.partnerId)?.displayName ?? '—';
  };
  const memberName = (userId: string | null) => members.find((m) => m.id === userId)?.name ?? '—';

  const kpis = [
    {
      key: 'activePartnerships',
      value: dashboard.kpis.activePartnerships,
      icon: <Handshake className="size-4" aria-hidden="true" />,
      href: '/partnerships',
      alert: false,
    },
    {
      key: 'atRiskPartnerships',
      value: dashboard.kpis.atRiskPartnerships,
      icon: <AlertTriangle className="size-4" aria-hidden="true" />,
      href: '/partnerships',
      alert: dashboard.kpis.atRiskPartnerships > 0,
    },
    {
      key: 'openInitiatives',
      value: dashboard.kpis.openInitiatives,
      icon: <Rocket className="size-4" aria-hidden="true" />,
      href: '/initiatives',
      alert: false,
    },
    {
      key: 'pendingDecisions',
      value: dashboard.kpis.pendingDecisions,
      icon: <Gavel className="size-4" aria-hidden="true" />,
      href: '/reviews',
      alert: dashboard.kpis.pendingDecisions > 0,
    },
    {
      key: 'reviewsDue',
      value: dashboard.kpis.reviewsDue,
      icon: <CalendarClock className="size-4" aria-hidden="true" />,
      href: '/partnerships',
      alert: dashboard.kpis.reviewsDue > 0,
    },
    {
      key: 'outcomesAwaitingVerification',
      value: dashboard.kpis.outcomesAwaitingVerification,
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      href: '/evidence-outcomes',
      alert: false,
    },
  ] as const;

  const hasExceptions =
    dashboard.exceptions.atRiskPartnerships.length > 0 ||
    dashboard.exceptions.blockedInitiatives.length > 0 ||
    dashboard.exceptions.blockedActions.length > 0 ||
    dashboard.exceptions.rejectedOutcomes.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-label text-muted-tertiary text-xs font-medium tracking-[var(--tracking-label-wide)] uppercase">
          {t('eyebrow')}
        </span>
        <h1 className="font-display text-ink mt-1 text-2xl font-extrabold tracking-[var(--tracking-display)]">
          {t('title')}
        </h1>
        <p className="font-body text-muted-body mt-1 text-sm">{t('description')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Link key={kpi.key} href={kpi.href} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 pt-5">
                <div
                  className={
                    kpi.alert
                      ? 'text-status-alert flex items-center gap-1.5'
                      : 'text-muted-tertiary flex items-center gap-1.5'
                  }
                >
                  {kpi.icon}
                </div>
                <p className="font-display text-ink text-2xl font-extrabold">{kpi.value}</p>
                <p className="text-muted-body text-xs">{t(`kpi.${kpi.key}`)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('exceptionsTitle')}</CardTitle>
          <CardDescription>{t('exceptionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!hasExceptions ? (
            <EmptyState title={t('noExceptionsTitle')} description={t('noExceptionsDescription')} />
          ) : (
            <>
              {dashboard.exceptions.atRiskPartnerships.map((p) => (
                <Link
                  key={p.id}
                  href="/partnerships"
                  className="hover:bg-canvas flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2 text-sm"
                >
                  <span className="text-ink truncate">{partnerNameForPartnership(p.id)}</span>
                  <StatusBadge label={t('exceptionType.atRiskPartnership')} tone="alert" />
                </Link>
              ))}
              {dashboard.exceptions.blockedInitiatives.map((i) => (
                <Link
                  key={i.id}
                  href={`/initiatives/${i.id}`}
                  className="hover:bg-canvas flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2 text-sm"
                >
                  <span className="text-ink truncate">{i.objective}</span>
                  <StatusBadge label={t('exceptionType.blockedInitiative')} tone="alert" />
                </Link>
              ))}
              {dashboard.exceptions.blockedActions.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2 text-sm"
                >
                  <span className="text-ink truncate">{a.title}</span>
                  <StatusBadge label={t('exceptionType.blockedAction')} tone="alert" />
                </div>
              ))}
              {dashboard.exceptions.rejectedOutcomes.map((o) => (
                <Link
                  key={o.id}
                  href={`/evidence-outcomes/${o.id}`}
                  className="hover:bg-canvas flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2 text-sm"
                >
                  <span className="text-ink truncate">{o.type}</span>
                  <StatusBadge label={t('exceptionType.rejectedOutcome')} tone="alert" />
                </Link>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('reviewsDueTitle')}</CardTitle>
            <CardDescription>{t('reviewsDueDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dashboard.reviewsDue.length === 0 ? (
              <EmptyState title={t('noReviewsDueTitle')} />
            ) : (
              dashboard.reviewsDue.map((p) => {
                const overdue = p.nextReviewAt ? new Date(p.nextReviewAt) < new Date() : false;
                return (
                  <Link
                    key={p.id}
                    href="/partnerships"
                    className="hover:bg-canvas flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2 text-sm"
                  >
                    <span className="text-ink truncate">{partnerNameForPartnership(p.id)}</span>
                    <span
                      className={overdue ? 'text-status-alert text-xs' : 'text-muted-body text-xs'}
                    >
                      {p.nextReviewAt ? new Date(p.nextReviewAt).toLocaleDateString() : '—'}
                    </span>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('decisionsTitle')}</CardTitle>
            <CardDescription>{t('decisionsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dashboard.pendingDecisions.length === 0 ? (
              <EmptyState title={t('noDecisionsTitle')} />
            ) : (
              dashboard.pendingDecisions.map((d) => (
                <Link
                  key={d.id}
                  href={d.reviewId ? `/reviews/${d.reviewId}` : '/reviews'}
                  className="hover:bg-canvas flex flex-col gap-0.5 rounded-md border border-[var(--border-default)] px-3 py-2 text-sm"
                >
                  <span className="text-ink truncate">{d.rationale}</span>
                  <span className="text-muted-body text-xs">{memberName(d.deciderId)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('initiativesTitle')}</CardTitle>
            <CardDescription>{t('initiativesDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dashboard.initiativesNeedingAttention.length === 0 ? (
              <EmptyState title={t('noInitiativesTitle')} />
            ) : (
              dashboard.initiativesNeedingAttention.map((i) => (
                <Link
                  key={i.id}
                  href={`/initiatives/${i.id}`}
                  className="hover:bg-canvas flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2 text-sm"
                >
                  <span className="text-ink truncate">{i.objective}</span>
                  <StatusBadge label={t(`initiativeStage.${i.stage}`)} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('integrationsTitle')}</CardTitle>
            <CardDescription>{t('integrationsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<Plug className="size-6" aria-hidden="true" />}
              title={t('noIntegrationsTitle')}
              description={t('noIntegrationsDescription')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
