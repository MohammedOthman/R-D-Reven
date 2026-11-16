import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RevenHome } from '@/src/components/home/RevenHome';
import '@/src/components/home/home.css';

// One image serves both authenticated and pilot apps; read the runtime flag
// on each request rather than baking the build environment into public CTAs.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return { title: t('pageTitle'), description: t('positioning') };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RevenHome pilotMode={process.env.PILOT_AUTO_LOGIN === 'true'} />;
}
