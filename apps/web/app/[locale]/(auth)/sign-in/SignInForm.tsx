'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, FormField, Input, Button } from '@revn/ui';
import { Link, useRouter } from '@/src/i18n/navigation';
import { signIn } from '@/src/lib/auth/client';

export function SignInForm() {
  const t = useTranslations('auth.signIn');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn({ email, password });
      router.replace('/');
      router.refresh();
    } catch {
      // Deliberately generic — the API already avoids disclosing whether the
      // email exists (PRD §7.1); the UI shouldn't narrow that back down.
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
          <p className="font-body text-muted-body text-sm">{t('description')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <FormField id="signin-email" label={t('emailLabel')}>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField id="signin-password" label={t('passwordLabel')} error={error ?? undefined}>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              invalid={!!error}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <div className="text-end">
            <Link
              href="/forgot-password"
              className="text-accent text-sm font-medium hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </form>

        <p className="font-body text-muted-body text-center text-sm">
          {t('noAccount')}{' '}
          <Link href="/sign-up" className="text-accent font-medium hover:underline">
            {t('signUpLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
