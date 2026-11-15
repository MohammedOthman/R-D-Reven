'use client';

import { PasswordInput } from '@/src/components/PasswordInput';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, FormField, Input, Button } from '@revn/ui';
import { Link, useRouter } from '@/src/i18n/navigation';
import { signUp } from '@/src/lib/auth/client';
import { ApiError } from '@/src/lib/api/error';

export function SignUpForm() {
  const t = useTranslations('auth.signUp');
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      await signUp({ name, email, password });
      router.replace('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.body.code === 'CONFLICT') {
          setErrors({ email: err.body.message });
        } else if (err.body.field_errors?.length) {
          setErrors({
            name: err.fieldError('name') ? t('nameLabel') : undefined,
            email: err.fieldError('email') ? t('emailLabel') : undefined,
            password: err.fieldError('password') ? t('passwordHint') : undefined,
          });
        } else {
          setErrors({ general: t('genericError') });
        }
      } else {
        setErrors({ general: t('genericError') });
      }
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
          <FormField id="signup-name" label={t('nameLabel')} error={errors.name}>
            <Input
              id="signup-name"
              autoComplete="name"
              required
              invalid={!!errors.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField id="signup-email" label={t('emailLabel')} error={errors.email}>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              invalid={!!errors.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField
            id="signup-password"
            label={t('passwordLabel')}
            hint={t('passwordHint')}
            error={errors.password}
          >
            <PasswordInput
              id="signup-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              invalid={!!errors.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          {errors.general && (
            <p role="alert" className="text-status-alert font-body text-sm">
              {errors.general}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </form>

        <p className="font-body text-muted-body text-center text-sm">
          {t('hasAccount')}{' '}
          <Link href="/sign-in" className="text-accent font-medium hover:underline">
            {t('signInLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
