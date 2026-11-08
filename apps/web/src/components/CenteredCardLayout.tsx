import type { ReactNode } from 'react';
import Image from 'next/image';
import { LocaleSwitcherLink } from './LocaleSwitcherLink';

/** Shared shell for `(auth)` and `(onboarding)` — a page with no sidebar/nav, just a wordmark, one card, and a locale switcher. Each route group supplies its own auth-gate logic; this is presentation only. */
export function CenteredCardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-canvas flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Image
        src="/brand/reven-mark.svg"
        alt="Reven"
        width={928}
        height={238.5}
        className="h-8 w-auto"
        priority
      />
      <div className="w-full max-w-sm">{children}</div>
      <LocaleSwitcherLink className="text-muted-body hover:text-ink" />
    </div>
  );
}
