import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/src/i18n/navigation';
import { getCurrentUser } from '@/src/lib/auth/session';
import { ResetPasswordForm } from './ResetPasswordForm';

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user) {
    redirect({ href: '/', locale });
  }

  return <ResetPasswordForm token={token} />;
}
