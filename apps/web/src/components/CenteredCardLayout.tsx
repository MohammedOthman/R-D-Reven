import type { ReactNode } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Handshake, ListChecks, CalendarCheck, ShieldCheck } from 'lucide-react';
import { LocaleSwitcherLink } from './LocaleSwitcherLink';

/** Shared account journey, using the same brand and language as the workspace. */
export async function CenteredCardLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth.layout');
  const steps = [
    { key: 'partners', icon: Handshake },
    { key: 'actions', icon: ListChecks },
    { key: 'reviews', icon: CalendarCheck },
    { key: 'outcomes', icon: ShieldCheck },
  ] as const;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <a href="#account-content" className="skip-link">
        {t('skipToContent')}
      </a>
      <aside className="bg-navy hidden flex-col justify-between gap-12 p-12 text-white lg:flex xl:p-16">
        <Image
          src="/brand/reven-mark-white.svg"
          alt="Reven"
          width={928}
          height={239}
          className="h-8 w-auto self-start"
          priority
        />
        <div className="max-w-lg">
          <p className="mb-5 text-sm font-medium text-white/70">{t('category')}</p>
          <p className="font-display text-4xl leading-tight font-bold tracking-[var(--tracking-display)] xl:text-5xl">
            {t('title')}
          </p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/75">
            {t('description')}
          </p>
          <ol className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/15 pt-8">
            {steps.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-center gap-3 text-sm">
                <Icon className="text-accent-pale-2 size-5 shrink-0" aria-hidden="true" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-[13px] text-white/60">{t('footer')}</p>
      </aside>
      <div className="relative flex min-w-0 flex-col">
        <header className="flex min-h-20 items-center justify-between gap-4 px-6 sm:px-10">
          <Image
            src="/brand/reven-mark.svg"
            alt="Reven"
            width={928}
            height={239}
            className="h-7 w-auto lg:invisible"
            priority
          />
          <LocaleSwitcherLink className="text-muted-body hover:bg-card inline-flex min-h-11 items-center rounded-md px-3 text-sm" />
        </header>
        <main
          id="account-content"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center px-4 pt-4 pb-12 focus:outline-none sm:px-10"
        >
          <div className="w-full max-w-[440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
