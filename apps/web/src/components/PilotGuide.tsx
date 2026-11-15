import { getTranslations } from 'next-intl/server';
import { Card, CardContent, buttonVariants } from '@revn/ui';
import { Link } from '@/src/i18n/navigation';
import type { MembershipRole } from '@/src/lib/tenant/types';

export async function PilotGuide({ role }: { role: MembershipRole }) {
  const t = await getTranslations('pilot');
  if (role === 'REVIEWER' || role === 'EXECUTIVE') {
    const reviewer = role === 'REVIEWER';
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:justify-between sm:p-8">
          <div className="max-w-xl">
            <h2 className="font-display text-ink text-xl font-bold">
              {t(reviewer ? 'reviewerGuideTitle' : 'executiveGuideTitle')}
            </h2>
            <p className="text-ink mt-2 text-sm leading-relaxed">
              {t(reviewer ? 'reviewerGuideDescription' : 'executiveGuideDescription')}
            </p>
          </div>
          <Link
            prefetch={false}
            href={reviewer ? '/evidence-outcomes' : '/reviews'}
            className={buttonVariants({ variant: 'primary' })}
          >
            {t(reviewer ? 'reviewerAction' : 'executiveAction')}
          </Link>
        </CardContent>
      </Card>
    );
  }
  const steps = [
    { key: 'partner', href: '/partnerships' },
    { key: 'initiative', href: '/initiatives' },
    { key: 'review', href: '/reviews' },
    { key: 'outcome', href: '/evidence-outcomes' },
  ] as const;

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-ink text-xl font-bold">{t('guideTitle')}</h2>
            <p className="text-ink mt-2 text-sm leading-relaxed">{t('guideDescription')}</p>
          </div>
          <Link
            prefetch={false}
            href="/partnerships?create=partner"
            className={buttonVariants({ variant: 'primary' })}
          >
            {t('startAction')}
          </Link>
        </div>
        <ol className="grid gap-4 border-t border-[var(--border-subtle)] pt-6 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map(({ key, href }, index) => (
            <li key={key}>
              <Link
                prefetch={false}
                href={href}
                className="hover:bg-canvas focus-visible:ring-accent flex h-full items-start gap-3 rounded-md p-2 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className="text-muted-body flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-sm font-semibold"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-ink text-sm font-semibold">{t(`${key}Title`)}</p>
                  <p className="text-muted-body mt-1 text-[13px] leading-relaxed">
                    {t(`${key}Description`)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
