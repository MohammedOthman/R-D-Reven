'use client';

import { useState, type CSSProperties } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowUpRight, ArrowRight, Handshake, Layers3 } from 'lucide-react';
import { Link } from '@/src/i18n/navigation';
import {
  PARTNERSHIP_STAGES,
  type Partnership,
  type PartnershipStage,
} from '@/src/lib/partnerships/types';
import { HEALTH_KEYS, portfolioSummary, dashboardAccess } from '@/src/lib/dashboard/visuals';

export function PortfolioHealth({ partnerships }: { partnerships: Partnership[] }) {
  const t = useTranslations('visual');
  const format = useFormatter();
  const { health, open } = portfolioSummary(partnerships);
  return (
    <div className="rv-health" id="portfolio-health">
      <div
        className="rv-health-chart"
        role="img"
        aria-label={t('healthAccessible', {
          total: open,
          healthy: health.HEALTHY,
          attention: health.NEEDS_ATTENTION,
          critical: health.CRITICAL,
          unassessed: health.UNASSESSED,
        })}
      >
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle className="rv-ring-track" cx="100" cy="100" r="78" fill="none" strokeWidth="15" />
          {HEALTH_KEYS.map((key, index) => {
            const segment = open ? (health[key] / open) * 100 : 0;
            const start = open
              ? (HEALTH_KEYS.slice(0, index).reduce((sum, previous) => sum + health[previous], 0) /
                  open) *
                100
              : 0;
            return segment > 0 ? (
              <circle
                key={key}
                className={`rv-health-${key.toLowerCase()}`}
                cx="100"
                cy="100"
                r="78"
                fill="none"
                strokeWidth="15"
                pathLength="100"
                strokeDasharray={`${Math.max(0, segment - (segment < 100 ? 1.5 : 0))} 100`}
                strokeDashoffset={-start}
                transform="rotate(-90 100 100)"
              />
            ) : null;
          })}
        </svg>
        <div className="rv-health-center" aria-hidden="true">
          <strong>{format.number(open)}</strong>
          <span>{t('openRelationships')}</span>
        </div>
      </div>
      <div className="rv-health-info">
        <h2>{t('healthTitle')}</h2>
        <p>{t('healthScope')}</p>
        <dl className="rv-health-legend">
          {HEALTH_KEYS.map((key) => (
            <div key={key}>
              <dt>
                <i className={`rv-dot rv-health-${key.toLowerCase()}`} aria-hidden="true" />
                {t(`health.${key}`)}
              </dt>
              <dd>{format.number(health[key])}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export type PortfolioRecord = Partnership & { partnerName: string };
export function PortfolioStages({ partnerships }: { partnerships: PortfolioRecord[] }) {
  const t = useTranslations('visual');
  const format = useFormatter();
  const [selected, setSelected] = useState<PartnershipStage | null>(null);
  const { stages, total } = portfolioSummary(partnerships);
  const max = Math.max(1, ...Object.values(stages));
  const filtered = partnerships.filter((p) => !selected || p.stage === selected);
  const preview = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  return (
    <section className="rv-panel rv-stage-panel" aria-labelledby="portfolio-stages-heading">
      <div className="rv-panel-heading">
        <div>
          <p className="rv-kicker">
            <Layers3 size={15} aria-hidden="true" />
            {t('portfolio')}
          </p>
          <h2 id="portfolio-stages-heading">{t('stagesTitle')}</h2>
          <p>{t('stagesDescription')}</p>
        </div>
        <span className="rv-total">
          {format.number(total)}
          <span>{t('relationships')}</span>
        </span>
      </div>
      <div className="rv-stage-chart" role="group" aria-label={t('stageFilter')}>
        {PARTNERSHIP_STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            aria-pressed={selected === stage}
            onClick={() => setSelected(selected === stage ? null : stage)}
            className={`rv-stage rv-stage--${stage.toLowerCase()}`}
          >
            <span className="rv-stage-count">{format.number(stages[stage])}</span>
            <span className="rv-stage-track" aria-hidden="true">
              <span style={{ '--bar-size': stages[stage] / max } as CSSProperties} />
            </span>
            <span className="rv-stage-label">{t(`stage.${stage}`)}</span>
          </button>
        ))}
      </div>
      <div className="rv-preview-heading">
        <h3>
          {selected
            ? t('selectedStage', { stage: t(`stage.${selected}`), count: filtered.length })
            : t('recentRelationships')}
        </h3>
        {selected && (
          <button type="button" className="rv-text-action" onClick={() => setSelected(null)}>
            {t('clearFilter')}
          </button>
        )}
      </div>
      <div
        key={selected ?? 'all'}
        className="rv-stage-results"
        aria-live="polite"
        aria-atomic="true"
      >
        {preview.length ? (
          <ul>
            {preview.map((p) => (
              <li key={p.id}>
                <span className="rv-record-icon">
                  <Handshake size={18} aria-hidden="true" />
                </span>
                <div>
                  <p>{p.partnerName}</p>
                  <span>{p.objective || t('noObjective')}</span>
                </div>
                <span className={`rv-stage-tag rv-stage--${p.stage.toLowerCase()}`}>
                  {t(`stage.${p.stage}`)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rv-chart-empty">
            <Handshake size={24} aria-hidden="true" />
            <p>{t(total ? 'emptyStage' : 'emptyPortfolio')}</p>
          </div>
        )}
      </div>
      <Link href="/partnerships" prefetch={false} className="rv-panel-link">
        {t('openPortfolio')}
        <ArrowRight size={16} className="rv-arrow" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function OverviewAction({ role }: { role: string }) {
  const t = useTranslations('visual');
  const action = dashboardAccess(role).canCreate
    ? 'partner'
    : role === 'EXECUTIVE'
      ? 'review'
      : 'outcome';
  const href =
    action === 'partner'
      ? '/partnerships?create=partner'
      : action === 'review'
        ? '/reviews'
        : '/evidence-outcomes';
  return (
    <Link href={href} prefetch={false} className="rv-hero-action">
      {t(`action.${action}`)}
      <ArrowUpRight size={18} className="rv-arrow" aria-hidden="true" />
    </Link>
  );
}
