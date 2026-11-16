'use client';

import { useEffect, type RefObject } from 'react';

/** GSAP owns DOM choreography; Lenis is the only smooth-scroll engine. */
export function useHomeChoreography(rootRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false,
      stop: (() => void) | undefined,
      loading = false;
    async function start() {
      if (disposed || media.matches || loading || stop) return;
      loading = true;
      try {
        const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
          import('lenis'),
        ]);
        if (disposed || media.matches) return;
        gsap.registerPlugin(ScrollTrigger);
        const lenis = new Lenis({
          duration: 1.05,
          smoothWheel: true,
          autoRaf: false,
          anchors: { offset: -100 },
        });
        const update = (time: number) => lenis.raf(time * 1000);
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(update);
        const context = gsap.context(() => {
          gsap.from('.hm-nav-row', {
            y: -8,
            opacity: 0.6,
            duration: 0.65,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
          });
          gsap.from('.hm-hero .hm-word', {
            yPercent: 12,
            duration: 0.65,
            stagger: 0.04,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          });
          root!.querySelectorAll<HTMLElement>('h2[data-reveal]').forEach((heading) => {
            gsap.from(heading.querySelectorAll('.hm-word'), {
              yPercent: 65,
              opacity: 0.12,
              duration: 0.85,
              stagger: 0.045,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
              scrollTrigger: { trigger: heading, start: 'top 92%', once: true },
            });
          });
          root!
            .querySelectorAll<HTMLElement>('.hm-principle, .hm-team, .hm-workflow li')
            .forEach((card) => {
              gsap.from(card, {
                y: 28,
                opacity: 0.35,
                duration: 0.8,
                ease: 'power2.out',
                clearProps: 'transform,opacity',
                scrollTrigger: { trigger: card, start: 'top 95%', once: true },
              });
            });
        }, root!);
        const refresh = () => ScrollTrigger.refresh();
        const visibility = () => {
          if (document.hidden) lenis.stop();
          else lenis.start();
        };
        root!.addEventListener('load', refresh, true);
        document.addEventListener('visibilitychange', visibility);
        void document.fonts?.ready.then(() => {
          if (!disposed) refresh();
        });
        refresh();
        stop = () => {
          context.revert();
          root!.removeEventListener('load', refresh, true);
          document.removeEventListener('visibilitychange', visibility);
          gsap.ticker.remove(update);
          lenis.off('scroll', ScrollTrigger.update);
          lenis.destroy();
        };
      } catch {
        stop?.();
        stop = undefined;
      } finally {
        loading = false;
      }
    }
    const change = () => {
      stop?.();
      stop = undefined;
      if (!media.matches) void start();
    };
    media.addEventListener('change', change);
    void start();
    return () => {
      disposed = true;
      media.removeEventListener('change', change);
      stop?.();
    };
  }, [rootRef, enabled]);
}
