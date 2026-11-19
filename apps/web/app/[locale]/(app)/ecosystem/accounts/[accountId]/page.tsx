import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, ForbiddenState } from '@revn/ui';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Link } from '@/src/i18n/navigation';
import { getCurrentTenant } from '@/src/lib/tenant/session';
import { getEcosystemAccount } from '@/src/lib/ecosystem/session';

const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];

function Chips({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="bg-canvas text-muted-body rounded-pill border border-[var(--border-subtle)] px-2 py-0.5 text-[11px]"
        >
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
  const a = (key: string) => t(`account.${key}`);
  const partnershipT = await getTranslations('partnerships.relationship');
  const account = detail.account;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/ecosystem"
          className="text-muted-body hover:text-ink inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {a('back')}
        </Link>
        <div className="flex flex-col gap-2">
          <p className="text-muted-body text-[13px] font-medium">{a('eyebrow')}</p>
          <h1 className="font-display text-ink text-2xl font-bold tracking-[var(--tracking-display)] sm:text-3xl">
            {account.name}
          </h1>
          <p className="font-body text-muted-body max-w-2xl text-sm leading-relaxed">
            {a('description')}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{a('detailsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail
                label={a('hq')}
                value={[account.hqCity, account.hqCountry].filter(Boolean).join(', ')}
                empty={a('notSet')}
              />
              <Detail label={a('parent')} value={account.parentName ?? ''} empty={a('notSet')} />
              <Detail
                label={t('employeesHeader')}
                value={
                  account.headcount ? new Intl.NumberFormat(locale).format(account.headcount) : ''
                }
                empty={a('notSet')}
              />
              <Detail label={a('revenue')} value={account.revenue ?? ''} empty={a('notSet')} />
              <Detail label={a('domains')} value={account.domains.join(', ')} empty={a('notSet')} />
              <Detail label={t('group')} value={detail.group?.label ?? ''} empty={a('notSet')} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{a('closestTitle')}</CardTitle>
              <p className="text-muted-body text-sm">{a('closestDescription')}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {detail.neighbours.length === 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-ink text-sm font-medium">{a('noNeighboursTitle')}</p>
                  <p className="text-muted-body text-xs">{a('noNeighboursDescription')}</p>
                </div>
              ) : (
                detail.neighbours.map((neighbour) => {
                  const tools =
                    neighbour.components.find((c) => c.family === 'technologies')?.evidence ?? [];
                  const topics =
                    neighbour.components.find((c) => c.family === 'keywords')?.evidence ?? [];
                  return (
                    <div
                      key={neighbour.id}
                      className="flex flex-col gap-2 border-b border-[var(--border-subtle)] pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/ecosystem/accounts/${neighbour.id}`}
                          className="text-ink text-sm font-semibold hover:underline"
                        >
                          {neighbour.name}
                        </Link>
                        <span className="text-muted-body text-xs tabular-nums">
                          {t('match', { score: Math.round(neighbour.score * 100) })}
                        </span>
                      </div>
                      {tools.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <p className="text-muted-caption text-[11px]">{t('tools')}</p>
                          <Chips values={tools} />
                        </div>
                      )}
                      {topics.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <p className="text-muted-caption text-[11px]">{t('topics')}</p>
                          <Chips values={topics} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{a('partnersTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.partners.length === 0 ? (
                <p className="text-muted-body text-sm">{a('partnersEmpty')}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {detail.partners.map((partner) => (
                    <li key={partner.partnerId} className="flex flex-col gap-1">
                      <p className="text-ink text-sm font-medium">{partner.name}</p>
                      <p className="text-muted-body text-xs">
                        {partner.stage ? partnershipT(`stage.${partner.stage}`) : a('notSet')}
                        {partner.health ? ` · ${partnershipT(`health.${partner.health}`)}` : ''}
                        {partner.relationship ? ` · ${partner.relationship}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{a('dataQualityTitle')}</CardTitle>
              <p className="text-muted-body text-sm">{a('dataQualityDescription')}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Chips values={account.technologies} />
              {account.technologies.length === 0 && (
                <p className="text-muted-body text-xs">{a('missingTechnologies')}</p>
              )}
              <Chips values={account.keywords} />
              {account.keywords.length === 0 && (
                <p className="text-muted-body text-xs">{a('missingKeywords')}</p>
              )}
              <Chips values={account.industryCodes} />
              {account.industryCodes.length === 0 && (
                <p className="text-muted-body text-xs">{a('missingIndustries')}</p>
              )}
            </CardContent>
          </Card>

          <p className="text-muted-caption text-xs">{t('note')}</p>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, empty }: { label: string; value: string; empty: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-muted-caption text-[11px] font-medium">{label}</p>
      <p className="text-ink text-sm">{value || empty}</p>
    </div>
  );
}
