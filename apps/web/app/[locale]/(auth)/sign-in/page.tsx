import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/src/i18n/navigation';
import { getCurrentUser } from '@/src/lib/auth/session';
import { SignInForm } from './SignInForm';

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user) {
    redirect({ href: '/workspace', locale });
  }

  return <SignInForm />;
}
