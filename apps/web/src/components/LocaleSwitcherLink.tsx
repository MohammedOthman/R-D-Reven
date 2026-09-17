'use client';

import { Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/src/i18n/navigation';
import { locales, localeLabel, type Locale } from '@/src/i18n/config';
import { cn } from '@revn/ui';

export function LocaleSwitcherLink({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations('common');
  const otherLocale = locales.find((candidate) => candidate !== locale)!;

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      aria-label={t('language')}
      className={cn('inline-flex items-center gap-1.5 text-sm', className)}
    >
      <Globe className="size-4" aria-hidden="true" />
      {localeLabel[otherLocale]}
    </Link>
  );
}
