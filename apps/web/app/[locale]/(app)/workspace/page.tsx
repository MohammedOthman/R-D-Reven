import type { ReactNode } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCheck,
  Gavel,
  Handshake,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { EmptyState, StatusBadge } from '@revn/ui';
import { WorkspaceDate } from '@/src/components/WorkspaceFormat';
import { Link } from '@/src/i18n/navigation';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getDashboard } from '@/src/lib/dashboard/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
import { getPartners } from '@/src/lib/partners/session';
import { getMemberDirectory } from '@/src/lib/members/session';
import { PilotGuide } from '@/src/components/PilotGuide';
import {
  PortfolioHealth,
  PortfolioStages,
  OverviewAction,
} from '@/src/components/PortfolioVisuals';
import { dashboardAccess } from '@/src/lib/dashboard/visuals';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

function QueueItem({
  children,
  href,
  className = '',
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <li className={className}>
      {href ? (
        <Link href={href} prefetch={false} className="rv-queue-item">
          {children}
          <ArrowUpRight size={16} className="rv-queue-arrow" aria-hidden="true" />
        </Link>
      ) : (
        <div className="rv-queue-item">{children}</div>
      )}
    </li>
  );
}

export default async function CommandCenterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tenant, role } = await getCurrentTenant();
  const t = await getTranslations('commandCenter');
  const v = await getTranslations('visual');
  if (!tenant || !role || !READ_ROLES.includes(role))
    return (
      <EmptyState
        icon={<Handshake size={24} aria-hidden="true" />}
        title={t('guestTitle')}
        description={t('guestDescription')}
      />
    );
  const data = await Promise.all([
    getDashboard(tenant.id),
    getPartnerships(tenant.id, { failOnError: true }),
    getPartners(tenant.id, { failOnError: true }),
    getMemberDirectory(tenant.id),
  ]).catch(() => null);
  if (!data || !data[0])
    return <EmptyState title={t('errorTitle')} description={t('errorDescription')} />;
  const [dashboard, partnerships, partners, members] = data;
  if (!dashboard) return <EmptyState title={t('errorTitle')} description={t('errorDescription')} />;
  const { canExecute } = dashboardAccess(role);
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const portfolio = partnerships.map((p) => ({
    ...p,
    partnerName: partnerById.get(p.partnerId)?.displayName ?? '—',
  }));
  const partnerName = (id: string) => portfolio.find((p) => p.id === id)?.partnerName ?? '—';
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? '—';
  const kpis = [
    { key: 'activePartnerships', icon: Handshake, href: '/partnerships', tone: 'blue' },
    { key: 'atRiskPartnerships', icon: AlertTriangle, href: '/partnerships', tone: 'alert' },
    {
      key: 'openInitiatives',
      icon: Rocket,
      href: canExecute ? '/initiatives' : undefined,
      tone: 'blue',
    },
    {
      key: 'pendingDecisions',
      icon: Gavel,
      href: canExecute ? '/reviews' : undefined,
      tone: 'caution',
    },
    { key: 'reviewsDue', icon: CalendarClock, href: '/partnerships', tone: 'caution' },
    {
      key: 'outcomesAwaitingVerification',
      icon: ShieldCheck,
      href: '/evidence-outcomes',
      tone: 'blue',
    },
  ] as const;
  const exceptions = [
    ...dashboard.exceptions.atRiskPartnerships.map((p) => ({
      id: p.id,
      name: partnerName(p.id),
      type: 'atRiskPartnership',
      href: '/partnerships',
    })),
    ...dashboard.exceptions.blockedInitiatives.map((i) => ({
      id: i.id,
      name: i.objective,
      type: 'blockedInitiative',
      href: canExecute ? `/initiatives/${i.id}` : undefined,
    })),
    ...dashboard.exceptions.blockedActions.map((a) => ({
      id: a.id,
      name: a.title,
      type: 'blockedAction',
      href: undefined,
    })),
    ...dashboard.exceptions.rejectedOutcomes.map((o) => ({
      id: o.id,
      name: o.type,
      type: 'rejectedOutcome',
      href: `/evidence-outcomes/${o.id}`,
    })),
  ];
  return (
    <div className="rv-overview">
      <section
        className="rv-hero"
        aria-labelledby="overview-heading"
        data-design="visual-workspace-v1"
      >
        <div className="rv-hero-copy">
          <p className="rv-kicker">
            <span className="rv-brand-line" aria-hidden="true" />
            {v('eyebrow')}
          </p>
          <h1 id="overview-heading">{v('title')}</h1>
          <p className="rv-hero-lead">{v('description')}</p>
          <OverviewAction role={role} />
          <p className="rv-hero-note">
            <Handshake size={15} aria-hidden="true" />
            {v('portfolioScope', { partners: partners.length, relationships: partnerships.length })}
          </p>
        </div>
        <PortfolioHealth partnerships={partnerships} />
      </section>
      <section className="rv-metrics" aria-label={v('metricsTitle')}>
        {kpis.map(({ key, icon: Icon, href, tone }) => {
          const value = dashboard.kpis[key];
          const content = (
            <>
              <div className={`rv-metric-icon rv-tone-${value > 0 ? tone : 'blue'}`}>
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="rv-metric-value">{new Intl.NumberFormat(locale).format(value)}</p>
                <p className="rv-metric-label">{t(`kpi.${key}`)}</p>
              </div>
              {href && <ArrowUpRight className="rv-metric-arrow" size={16} aria-hidden="true" />}
            </>
          );
          return href ? (
            <Link key={key} prefetch={false} href={href} className="rv-metric">
              {content}
            </Link>
          ) : (
            <div key={key} className="rv-metric">
              {content}
            </div>
          );
        })}
      </section>
      <div className="rv-analytics-grid">
        <PortfolioStages partnerships={portfolio} />
        <section className="rv-panel rv-attention" aria-labelledby="attention-heading">
          <div className="rv-panel-heading">
            <div>
              <p className="rv-kicker">
                <AlertTriangle size={15} aria-hidden="true" />
                {v('attentionEyebrow')}
              </p>
              <h2 id="attention-heading">{t('exceptionsTitle')}</h2>
              <p>{v('attentionDescription')}</p>
            </div>
          </div>
          {exceptions.length ? (
            <>
              <ul className="rv-queue-list">
                {exceptions.slice(0, 5).map((item) => (
                  <QueueItem key={item.id} href={item.href}>
                    <span className="rv-attention-mark" aria-hidden="true" />
                    <div className="rv-queue-copy">
                      <p>{item.name}</p>
                      <span>{t(`exceptionType.${item.type}`)}</span>
                    </div>
                  </QueueItem>
                ))}
              </ul>
              <p className="rv-list-note">{v('attentionPreview')}</p>
            </>
          ) : (
            <div className="rv-clear-state">
              <span>
                <CheckCheck size={28} aria-hidden="true" />
              </span>
              <h3>{t('noExceptionsTitle')}</h3>
              <p>{t('noExceptionsDescription')}</p>
            </div>
          )}
          <div className="rv-attention-footer">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>
                {new Intl.NumberFormat(locale).format(dashboard.kpis.outcomesAwaitingVerification)}
              </strong>
              <span>{t('kpi.outcomesAwaitingVerification')}</span>
            </div>
            <Link
              href="/evidence-outcomes"
              prefetch={false}
              aria-label={v('action.outcome')}
              className="rv-icon-link"
            >
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
      {process.env.PILOT_AUTO_LOGIN === 'true' && <PilotGuide role={role} />}
      <div className={`rv-queue-grid ${!canExecute ? 'rv-queue-grid--single' : ''}`}>
        <section className="rv-panel" aria-labelledby="reviews-due-heading">
          <div className="rv-panel-heading">
            <div>
              <p className="rv-kicker">
                <CalendarClock size={15} aria-hidden="true" />
                {v('reviewEyebrow')}
              </p>
              <h2 id="reviews-due-heading">{t('reviewsDueTitle')}</h2>
              <p>{t('reviewsDueDescription')}</p>
            </div>
          </div>
          {dashboard.reviewsDue.length ? (
            <ul className="rv-queue-list rv-timeline">
              {dashboard.reviewsDue.slice(0, 4).map((p) => (
                <QueueItem key={p.id} href="/partnerships">
                  <span className="rv-timeline-node" aria-hidden="true" />
                  <div className="rv-queue-copy">
                    <p>{partnerName(p.id)}</p>
                    <span>{p.nextReviewAt ? <WorkspaceDate value={p.nextReviewAt} /> : '—'}</span>
                  </div>
                </QueueItem>
              ))}
            </ul>
          ) : (
            <div className="rv-queue-empty">
              <CalendarClock size={24} aria-hidden="true" />
              <p>{t('noReviewsDueTitle')}</p>
            </div>
          )}
          <Link href="/partnerships" prefetch={false} className="rv-panel-link">
            {v('openPortfolio')}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </section>
        {canExecute && (
          <>
            <section className="rv-panel" aria-labelledby="decisions-heading">
              <div className="rv-panel-heading">
                <div>
                  <p className="rv-kicker">
                    <Gavel size={15} aria-hidden="true" />
                    {v('decisionEyebrow')}
                  </p>
                  <h2 id="decisions-heading">{t('decisionsTitle')}</h2>
                  <p>{t('decisionsDescription')}</p>
                </div>
              </div>
              {dashboard.pendingDecisions.length ? (
                <ul className="rv-queue-list">
                  {dashboard.pendingDecisions.slice(0, 4).map((d) => (
                    <QueueItem key={d.id} href={d.reviewId ? `/reviews/${d.reviewId}` : '/reviews'}>
                      <div className="rv-queue-copy">
                        <p>{d.rationale}</p>
                        <span>{memberName(d.deciderId)}</span>
                      </div>
                    </QueueItem>
                  ))}
                </ul>
              ) : (
                <div className="rv-queue-empty">
                  <Gavel size={24} aria-hidden="true" />
                  <p>{t('noDecisionsTitle')}</p>
                </div>
              )}
              <Link href="/reviews" prefetch={false} className="rv-panel-link">
                {v('action.review')}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </section>
            <section className="rv-panel" aria-labelledby="initiatives-heading">
              <div className="rv-panel-heading">
                <div>
                  <p className="rv-kicker">
                    <Rocket size={15} aria-hidden="true" />
                    {v('workEyebrow')}
                  </p>
                  <h2 id="initiatives-heading">{t('initiativesTitle')}</h2>
                  <p>{t('initiativesDescription')}</p>
                </div>
              </div>
              {dashboard.initiativesNeedingAttention.length ? (
                <ul className="rv-queue-list">
                  {dashboard.initiativesNeedingAttention.slice(0, 4).map((i) => (
                    <QueueItem key={i.id} href={`/initiatives/${i.id}`}>
                      <div className="rv-queue-copy">
                        <p>{i.objective}</p>
                        <StatusBadge
                          label={t(`initiativeStage.${i.stage}`)}
                          tone={i.stage === 'BLOCKED' ? 'alert' : 'neutral'}
                        />
                      </div>
                    </QueueItem>
                  ))}
                </ul>
              ) : (
                <div className="rv-queue-empty">
                  <Rocket size={24} aria-hidden="true" />
                  <p>{t('noInitiativesTitle')}</p>
                </div>
              )}
              <Link href="/initiatives" prefetch={false} className="rv-panel-link">
                {v('openInitiatives')}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </>
        )}
      </div>
      <p className="rv-overview-footnote">{v('previewNote')}</p>
    </div>
  );
}
