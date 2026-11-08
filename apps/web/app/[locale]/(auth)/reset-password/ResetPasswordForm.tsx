'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, FormField, Input, Button } from '@revn/ui';
import { Link } from '@/src/i18n/navigation';
import { resetPassword } from '@/src/lib/auth/client';

export function ResetPasswordForm({ token }: { token?: string }) {
  const t = useTranslations('auth.resetPassword');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="bg-status-alert/10 text-status-alert flex size-12 items-center justify-center rounded-full">
            <XCircle className="size-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-ink text-xl font-extrabold">{t('invalidTokenTitle')}</h1>
          <p className="font-body text-muted-body text-sm">{t('invalidTokenDescription')}</p>
          <Link href="/forgot-password" className="text-accent text-sm font-medium hover:underline">
            {t('requestNewLink')}
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
      await resetPassword({ token, newPassword });
      setDone(true);
    } catch {
      setError(t('genericError'));
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="bg-status-positive/10 text-status-positive flex size-12 items-center justify-center rounded-full">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-ink text-xl font-extrabold">{t('successTitle')}</h1>
          <p className="font-body text-muted-body text-sm">{t('successDescription')}</p>
          <Link href="/sign-in" className="text-accent text-sm font-medium hover:underline">
            {t('goToSignIn')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5 text-start">
          <span className="font-label text-accent-deep text-xs font-medium tracking-[var(--tracking-label-wide)] uppercase">
            {t('eyebrow')}
          </span>
          <h1 className="font-display text-ink text-xl font-extrabold">{t('title')}</h1>
          <p className="font-body text-muted-body text-sm">{t('description')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <FormField
            id="reset-password"
            label={t('newPasswordLabel')}
            hint={error ? undefined : t('passwordHint')}
            error={error ?? undefined}
          >
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              invalid={!!error}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
