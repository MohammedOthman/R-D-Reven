import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EmptyState, ForbiddenState } from '@revn/ui';
import { ArrowLeft, ArrowUpRight, Building2, Handshake } from 'lucide-react';
import { Link } from '@/src/i18n/navigation';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getEcosystemAccount } from '@/src/lib/ecosystem/session';
import type { FeatureFamily } from '@/src/lib/ecosystem/types';
import {
  FEATURE_FAMILIES,
  NEUTRAL_TONE,
  companyMonogram,
  groupTone,
} from '@/src/components/ecosystem/ecosystem-visuals';
import '../../ecosystem.css';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

function familyLabelKey(family: FeatureFamily): 'tools' | 'topics' | 'industry' | 'lists' {
  switch (family) {
    case 'technologies':
      return 'tools';
    case 'keywords':
      return 'topics';
    case 'industries':
      return 'industry';
    case 'lists':
      return 'lists';
  }
}

function Chips({ values }: { values: string[] }) {
  return (
    <div className="eco-chips">
      {values.map((value) => (
        <span key={value} className="eco-chip">
          {value}
        </span>
      ))}
    </div>
  );
}

export default async function EcosystemAccountPage({
  params,
}: {
  params: Promise<{ locale: string; accountId: string }>;
}) {
  const { locale, accountId } = await params;
  setRequestLocale(locale);

  const { tenant, role } = await getCurrentTenant();
  if (!tenant || !role || !READ_ROLES.includes(role)) {
    const forbidden = await getTranslations('ecosystem.forbidden');
    return <ForbiddenState title={forbidden('title')} description={forbidden('description')} />;
  }

  const detail = await getEcosystemAccount(tenant.id, accountId);
  if (!detail) {
    const t = await getTranslations('ecosystem.account');
    return (
      <EmptyState
        icon={<Building2 className="size-6" aria-hidden="true" />}
        title={t('notFoundTitle')}
        description={t('notFoundDescription')}
        action={
          <Link href="/ecosystem" className="text-accent text-sm font-semibold hover:underline">
            {t('back')}
          </Link>
        }
      />
    );
  }

  const t = await getTranslations('ecosystem');
  const a = await getTranslations('ecosystem.account');
  const partnershipT = await getTranslations('partnerships.relationship');
  const number = new Intl.NumberFormat(locale);
  const account = detail.account;

  const tone = detail.group ? groupTone(detail.group.id) : NEUTRAL_TONE;
  const location = [account.hqCity, account.hqCountry].filter(Boolean).join(', ');
  const teamSize = account.headcount ? number.format(account.headcount) : '';
  const domainsAndRevenue = [account.domains.join(', '), account.revenue]
    .filter(Boolean)
    .join(' · ');

  const signalSections = [
    {
      key: 'technologies',
      label: t('tools'),
      values: account.technologies,
      emptyText: a('missingTechnologies'),
    },
    {
      key: 'keywords',
      label: t('topics'),
      values: account.keywords,
      emptyText: a('missingKeywords'),
    },
    {
      key: 'industries',
      label: t('industry'),
      values: account.industryCodes,
      emptyText: a('missingIndustries'),
    },
    {
      key: 'lists',
      label: t('lists'),
      values: account.lists,
      emptyText: a('missingLists'),
    },
  ] as const;

  const filledSignals = signalSections.filter((section) => section.values.length > 0).length;
  const completenessPct = Math.round((filledSignals / signalSections.length) * 100);

  return (
    <div className="eco-page">
      {/* Matching Deep Navy Hero + Inline Key-Facts Strip */}
      <section className="eco-profile-hero" aria-labelledby="account-profile-heading">
        <div className="flex flex-col gap-4">
          <Link href="/ecosystem" className="eco-back-link">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            {a('back')}
          </Link>

          <p className="eco-kicker">
            <span className="eco-kicker-bar" aria-hidden="true" />
            {a('eyebrow')}
          </p>

          <div className="eco-profile-headline">
            <span
              className="eco-monogram-badge"
              style={{ backgroundColor: tone.fill }}
              aria-hidden="true"
            >
              {companyMonogram(account.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 id="account-profile-heading">{account.name}</h1>
                {detail.group && (
                  <span className="eco-hub-badge eco-hub-badge--on-navy">{detail.group.label}</span>
                )}
              </div>
              <p className="eco-hero-lead mt-2">{a('description')}</p>
            </div>
          </div>
        </div>

        {/* Inline Key-Facts Strip */}
        <dl className="eco-facts-strip" aria-label={a('detailsTitle')}>
          <Fact label={a('hq')} value={location} empty={a('notSet')} />
          <Fact label={t('employeesHeader')} value={teamSize} empty={a('notSet')} />
          <Fact label={t('group')} value={detail.group?.label ?? ''} empty={a('notSet')} />
          <Fact label={a('parent')} value={account.parentName ?? ''} empty={a('notSet')} />
          <Fact
            label={`${a('domains')} / ${a('revenue')}`}
            value={domainsAndRevenue}
            empty={a('notSet')}
          />
        </dl>
      </section>

      <div className="eco-profile-grid">
        {/* Left Column: Closest Matches */}
        <div className="eco-profile-col">
          <section className="eco-panel" aria-labelledby="profile-closest-heading">
            <div className="eco-panel-head">
              <h2 id="profile-closest-heading">{a('closestTitle')}</h2>
              <p>{a('closestDescription')}</p>
            </div>
            <div className="eco-panel-body">
              {detail.neighbours.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-default)] p-5">
                  <p className="text-ink text-sm font-semibold">{a('noNeighboursTitle')}</p>
                  <p className="text-muted-body mt-1 text-xs">{a('noNeighboursDescription')}</p>
                </div>
              ) : (
                detail.neighbours.map((neighbour) => {
                  const matchPct = Math.round(neighbour.score * 100);
                  const byFamily = new Map(neighbour.components.map((c) => [c.family, c]));
                  const evidenceFamilies = FEATURE_FAMILIES.map((family) =>
                    byFamily.get(family),
                  ).filter(
                    (component): component is NonNullable<typeof component> =>
                      component !== undefined &&
                      (component.score > 0 || component.evidence.length > 0),
                  );

                  return (
                    <article key={neighbour.id} className="eco-profile-match">
                      <div className="eco-profile-match-head">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="eco-monogram-badge eco-monogram-badge--sm"
                            style={{ backgroundColor: NEUTRAL_TONE.fill }}
                            aria-hidden="true"
                          >
                            {companyMonogram(neighbour.name)}
                          </span>
                          <Link
                            href={`/ecosystem/accounts/${neighbour.id}`}
                            className="eco-profile-match-link inline-flex items-center gap-1"
                          >
                            {neighbour.name}
                            <ArrowUpRight
                              className="size-3.5 rtl:-scale-x-100"
                              aria-hidden="true"
                            />
                          </Link>
                        </div>
                        <span className="eco-match-pct">{t('match', { score: matchPct })}</span>
                      </div>

                      <div className="eco-bar-track" aria-hidden="true">
                        <div
                          className="eco-bar-fill"
                          style={{ width: `${Math.max(4, matchPct)}%` }}
                        />
                      </div>

                      {evidenceFamilies.length > 0 && (
                        <div className="grid gap-3 pt-1 sm:grid-cols-2">
                          {evidenceFamilies.map((component) => {
                            const signalPct = Math.round(component.score * 100);
                            return (
                              <div key={component.family} className="eco-signal-row">
                                <div className="eco-signal-row-head">
                                  <span>{t(familyLabelKey(component.family))}</span>
                                  <span className="eco-signal-row-pct">
                                    {t('signalScore', { score: signalPct })}
                                  </span>
                                </div>
                                {component.evidence.length > 0 && (
                                  <Chips values={component.evidence} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Partners Already Here + Profile Signals */}
        <div className="eco-profile-col">
          <section className="eco-panel" aria-labelledby="profile-partners-heading">
            <div className="eco-panel-head">
              <h2 id="profile-partners-heading">{a('partnersTitle')}</h2>
            </div>
            <div className="eco-panel-body">
              {detail.partners.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border-default)] p-4">
                  <Handshake className="text-muted-tertiary size-5 shrink-0" aria-hidden="true" />
                  <p className="text-muted-body text-sm">{a('partnersEmpty')}</p>
                </div>
              ) : (
                <ul className="eco-partner-list">
                  {detail.partners.map((partner) => (
                    <li key={partner.partnerId} className="eco-partner-row">
                      <div className="min-w-0">
                        <p className="eco-partner-name">{partner.name}</p>
                        <p className="eco-partner-meta">
                          {[
                            partner.health ? partnershipT(`health.${partner.health}`) : null,
                            partner.relationship,
                          ]
                            .filter(Boolean)
                            .join(' · ') || a('notSet')}
                        </p>
                      </div>
                      <span className="eco-partner-tag">
                        {partner.stage ? partnershipT(`stage.${partner.stage}`) : a('notSet')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="eco-panel" aria-labelledby="profile-signals-heading">
            <div className="eco-panel-head">
              <h2 id="profile-signals-heading">{a('dataQualityTitle')}</h2>
              <p>{a('dataQualityDescription')}</p>
            </div>
            <div className="eco-panel-body">
              <div className="eco-completeness">
                <div className="eco-completeness-head">
                  <span>
                    {a('signalsCompleteness', {
                      filled: filledSignals,
                      total: signalSections.length,
                    })}
                  </span>
                  <span className="eco-match-pct">{completenessPct}%</span>
                </div>
                <div className="eco-bar-track" aria-hidden="true">
                  <div className="eco-bar-fill" style={{ width: `${completenessPct}%` }} />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {signalSections.map((section) => (
                  <div key={section.key} className="eco-signal-group">
                    <div className="eco-signal-group-head">
                      <p className="eco-section-label">{section.label}</p>
                      <span className="eco-signal-row-pct">
                        {number.format(section.values.length)}
                      </span>
                    </div>
                    {section.values.length > 0 ? (
                      <Chips values={section.values} />
                    ) : (
                      <p className="eco-signal-empty">{section.emptyText}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <p className="text-muted-caption text-xs">{t('note')}</p>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, empty }: { label: string; value: string; empty: string }) {
  return (
    <div className="eco-fact-item">
      <dt className="eco-fact-label">{label}</dt>
      <dd className={`eco-fact-value ${value ? '' : 'eco-fact-value--muted'}`}>{value || empty}</dd>
    </div>
  );
}
