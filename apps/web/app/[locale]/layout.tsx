import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ToastProvider } from '@revn/ui';
import { routing } from '@/src/i18n/routing';
import { localeDirection, type Locale } from '@/src/i18n/config';
import { fontVariables } from '@/src/lib/fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Reven',
  description: 'The operating system for revenue shared between companies.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const direction = localeDirection[locale as Locale];

  return (
    <html lang={locale} dir={direction} className={fontVariables}>
      <body>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
