import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Card, CardContent, buttonVariants } from '@revn/ui';
import { CenteredCardLayout } from '@/src/components/CenteredCardLayout';
import { Link } from '@/src/i18n/navigation';

export default async function PilotUnavailablePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Pilot mode is configured at container startup, after the image is built.
  await connection();
  if (process.env.PILOT_AUTO_LOGIN !== 'true') notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pilot');
  return (
    <CenteredCardLayout>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h1 className="font-display text-ink text-xl font-bold">{t('unavailableTitle')}</h1>
          <p role="status" className="text-muted-body text-sm leading-relaxed">
            {t('unavailableDescription')}
          </p>
          <Link prefetch={false} href="/workspace" className={buttonVariants({ variant: 'primary' })}>
            {t('retryAction')}
          </Link>
        </CardContent>
      </Card>
    </CenteredCardLayout>
  );
}
