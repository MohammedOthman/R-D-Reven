'use client';

import { PasswordInput } from '@/src/components/PasswordInput';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { XCircle } from 'lucide-react';
import { Card, CardContent, FormField, Input, Button } from '@revn/ui';
import { Link, useRouter } from '@/src/i18n/navigation';
import { acceptInvite } from '@/src/lib/auth/client';
import { roleLabelKey } from '@/src/lib/tenant/roleLabels';
import type { MembershipRole } from '@/src/lib/tenant/types';

interface InvitationPreview {
  email: string;
  tenantName: string;
  role: string;
}

export function AcceptInviteForm({
  token,
  preview,
}: {
  token?: string;
  preview: InvitationPreview | null;
}) {
  const t = useTranslations('auth.acceptInvite');
  const tRole = useTranslations();
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || !preview) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="bg-status-alert/10 text-status-alert flex size-12 items-center justify-center rounded-full">
            <XCircle className="size-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-ink text-xl font-extrabold">{t('invalidTitle')}</h1>
          <p className="font-body text-muted-body text-sm">{t('invalidDescription')}</p>
          <Link href="/sign-in" className="text-accent text-sm font-medium hover:underline">
            {t('goToSignIn')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await acceptInvite({ token, name, password });
      router.replace('/workspace');
      router.refresh();
    } catch {
      setError(t('genericError'));
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5 text-start">
          <span className="font-label text-accent-deep text-xs font-medium tracking-[var(--tracking-label-wide)] uppercase">
            {t('eyebrow')}
          </span>
          <h1 className="font-display text-ink text-xl font-extrabold">{t('title')}</h1>
          <p className="font-body text-muted-body text-sm">
            {t('description', {
              tenant: preview.tenantName,
              role: tRole(roleLabelKey(preview.role as MembershipRole)),
            })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <FormField id="invite-email" label={t('emailLabel')}>
            <Input id="invite-email" type="email" value={preview.email} disabled readOnly />
          </FormField>

          <FormField id="invite-name" label={t('nameLabel')}>
            <Input
              id="invite-name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField
            id="invite-password"
            label={t('passwordLabel')}
            hint={t('passwordHint')}
            error={error ?? undefined}
          >
            <PasswordInput
              id="invite-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              invalid={!!error}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
