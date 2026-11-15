import { Sora, Manrope, IBM_Plex_Mono, Cairo, IBM_Plex_Sans_Arabic } from 'next/font/google';

export const sora = Sora({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-sora',
  display: 'swap',
  preload: false,
});

export const manrope = Manrope({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-manrope',
  display: 'swap',
  preload: false,
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
  preload: false,
});

// Arabic pairings — a conservative addition not specified in the brand file.
// See docs/brand/DECISIONS.md.
export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: 'variable',
  variable: '--font-cairo',
  display: 'swap',
  preload: false,
});

export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600'],
  variable: '--font-ibm-plex-sans-arabic',
  display: 'swap',
  preload: false,
});

/** Keep unused-language faces out of the active font stack; fetch only faces the page uses. */
export function fontVariablesForLocale(locale: string): string {
  return (
    locale === 'ar'
      ? [cairo.variable, ibmPlexSansArabic.variable]
      : [sora.variable, manrope.variable, ibmPlexMono.variable]
  ).join(' ');
}
