'use client';

import { PasswordInput } from '@/src/components/PasswordInput';

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
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = {
      ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? { email: t('emailError') } : {}),
      ...(!password ? { password: t('passwordError') } : {}),
    };
    setFieldErrors(errors);
    setError(null);
    if (errors.email || errors.password) {
      document.getElementById(errors.email ? 'signin-email' : 'signin-password')?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn({ email: email.trim(), password });
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

        <form
          aria-busy={submitting}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField id="signin-email" label={t('emailLabel')} error={fieldErrors.email}>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              invalid={!!fieldErrors.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField id="signin-password" label={t('passwordLabel')} error={fieldErrors.password}>
            <PasswordInput
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              invalid={!!fieldErrors.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <div className="text-end">
            <Link
              prefetch={false}
              href="/forgot-password"
              className="text-accent-deep inline-flex min-h-11 items-center text-sm font-medium hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>

          {error && (
            <p role="alert" className="text-status-alert text-sm">
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? t('submitting') : t('submit')}
          </Button>
          <p role="status" aria-live="polite" className="sr-only">
            {submitting ? t('submitting') : ''}
          </p>
        </form>

        <p className="font-body text-muted-body text-center text-sm">
          {t('noAccount')}{' '}
          <Link
            prefetch={false}
            href="/sign-up"
            className="text-accent font-medium hover:underline"
          >
            {t('signUpLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
