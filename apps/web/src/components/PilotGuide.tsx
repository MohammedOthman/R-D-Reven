import { getTranslations } from 'next-intl/server';
import { ArrowUpRight, Handshake, Rocket, CalendarClock, ShieldCheck } from 'lucide-react';
import { Link } from '@/src/i18n/navigation';
import type { MembershipRole } from '@/src/lib/tenant/types';
import { MotionControl } from './WorkspaceMotion';

export async function PilotGuide({ role }: { role: MembershipRole }) {
  const t = await getTranslations('pilot');
  const v = await getTranslations('visual');
  if (role === 'REVIEWER' || role === 'EXECUTIVE') {
    const reviewer = role === 'REVIEWER';
    const Icon = reviewer ? ShieldCheck : CalendarClock;
    return (
      <section className="rv-role-guide">
        <span className="rv-guide-symbol">
          <Icon size={28} aria-hidden="true" />
        </span>
        <div>
          <p className="rv-kicker">{v('yourNextStep')}</p>
          <h2>{t(reviewer ? 'reviewerGuideTitle' : 'executiveGuideTitle')}</h2>
          <p>{t(reviewer ? 'reviewerGuideDescription' : 'executiveGuideDescription')}</p>
        </div>
        <Link
          prefetch={false}
          href={reviewer ? '/evidence-outcomes' : '/reviews'}
          className="rv-panel-link"
        >
          {t(reviewer ? 'reviewerAction' : 'executiveAction')}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
    );
  }
  const steps = [
    { key: 'partner', href: '/partnerships', icon: Handshake },
    { key: 'initiative', href: '/initiatives', icon: Rocket },
    { key: 'review', href: '/reviews', icon: CalendarClock },
    { key: 'outcome', href: '/evidence-outcomes', icon: ShieldCheck },
  ] as const;
  return (
    <section className="rv-workflow rv-panel" aria-labelledby="workflow-heading">
      <div className="rv-panel-heading">
        <div>
          <p className="rv-kicker">{v('workflowEyebrow')}</p>
          <h2 id="workflow-heading">{t('guideTitle')}</h2>
          <p>{v('workflowDescription')}</p>
        </div>
        <MotionControl compact />
      </div>
      <ol className="rv-workflow-steps">
        {steps.map(({ key, href, icon: Icon }, index) => (
          <li key={key}>
            <Link prefetch={false} href={href} className="rv-workflow-step">
              <div className="rv-workflow-track">
                <span className="rv-workflow-icon">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <span className="rv-step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3>{t(`${key}Title`)}</h3>
              <p>{t(`${key}Description`)}</p>
              <ArrowUpRight className="rv-workflow-arrow" size={18} aria-hidden="true" />
            </Link>
            {index < steps.length - 1 && (
              <span className="rv-workflow-connector" aria-hidden="true">
                <span />
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="rv-workflow-footer">
        <p>{v('workflowHint')}</p>
        <Link prefetch={false} href="/partnerships?create=partner" className="rv-panel-link">
          {t('startAction')}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
