import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/src/i18n/navigation';
import { getCurrentUser } from '@/src/lib/auth/session';
import { AcceptInviteForm } from './AcceptInviteForm';
import { SERVER_API_URL } from '@/src/lib/api/server-url';

interface InvitationPreview {
  email: string;
  tenantName: string;
  role: string;
}

async function fetchPreview(token: string): Promise<InvitationPreview | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/auth/invitations/${token}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as InvitationPreview;
  } catch {
    return null;
  }
}

export default async function AcceptInvitePage({
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
    redirect({ href: '/workspace', locale });
  }

  const preview = token ? await fetchPreview(token) : null;

  return <AcceptInviteForm token={token} preview={preview} />;
}
