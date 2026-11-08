'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { MailCheck } from 'lucide-react';
import { Card, CardContent, FormField, Input, Button } from '@revn/ui';
import { Link } from '@/src/i18n/navigation';
import { requestPasswordReset } from '@/src/lib/auth/client';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordReset({ email });
    } finally {
      // Always show the same success state — the API deliberately doesn't
      // reveal whether the address is registered (PRD §7.1).
      setSent(true);
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="bg-status-positive/10 text-status-positive flex size-12 items-center justify-center rounded-full">
            <MailCheck className="size-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-ink text-xl font-extrabold">{t('successTitle')}</h1>
          <p className="font-body text-muted-body text-sm">{t('successDescription')}</p>
          <Link href="/sign-in" className="text-accent text-sm font-medium hover:underline">
            {t('backToSignIn')}
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
          <FormField id="forgot-email" label={t('emailLabel')}>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </form>

        <p className="text-center">
          <Link href="/sign-in" className="text-accent text-sm font-medium hover:underline">
            {t('backToSignIn')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
