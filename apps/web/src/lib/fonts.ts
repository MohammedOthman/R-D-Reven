import { Sora, Manrope, IBM_Plex_Mono, Cairo, IBM_Plex_Sans_Arabic } from 'next/font/google';

export const sora = Sora({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

export const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

// Arabic pairings — a conservative addition not specified in the brand file.
// See docs/brand/DECISIONS.md.
export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});

export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans-arabic',
  display: 'swap',
});

export const fontVariables = [
  sora.variable,
  manrope.variable,
  ibmPlexMono.variable,
  cairo.variable,
  ibmPlexSansArabic.variable,
].join(' ');
