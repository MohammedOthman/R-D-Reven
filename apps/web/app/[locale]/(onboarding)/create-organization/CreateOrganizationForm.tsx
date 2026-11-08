'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, FormField, Input, Button } from '@revn/ui';
import { useRouter } from '@/src/i18n/navigation';
import { createTenant } from '@/src/lib/tenant/client';

export function CreateOrganizationForm() {
  const t = useTranslations('onboarding.createOrganization');
  const router = useRouter();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createTenant({ name });
      router.replace('/');
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
          <p className="font-body text-muted-body text-sm">{t('description')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <FormField id="org-name" label={t('nameLabel')} error={error ?? undefined}>
            <Input
              id="org-name"
              autoComplete="organization"
              required
              invalid={!!error}
              value={name}
              onChange={(e) => setName(e.target.value)}
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
