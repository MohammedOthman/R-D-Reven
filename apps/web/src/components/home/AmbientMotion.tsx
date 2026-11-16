'use client';

import { useEffect, useRef } from 'react';
import { createAmbientField, type AmbientVariant } from './create-ambient-field';

/** Decorative background motion. Runs only while on screen and motion is allowed. */
export function AmbientMotion({ variant }: { variant: AmbientVariant }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const shell = shellRef.current,
      canvas = canvasRef.current;
    if (
      !shell ||
      !canvas ||
      typeof window.matchMedia !== 'function' ||
      typeof IntersectionObserver === 'undefined' ||
      typeof ResizeObserver === 'undefined'
    )
      return;
    const field = createAmbientField(canvas, variant);
    if (!field) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false,
      focused = true;
    const sync = () => {
      const active = visible && focused && !media.matches && !document.hidden;
      field.setActive(active);
      if (!active) field.setPointer(0, 0, false);
    };
    const resize = () => {
      const { width, height } = shell.getBoundingClientRect();
      field.resize(width, height);
    };
    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.01 },
    );
    intersection.observe(shell);
    const sizing = new ResizeObserver(resize);
    sizing.observe(shell);
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !visible || media.matches) return;
      const box = shell.getBoundingClientRect();
      const x = event.clientX - box.left,
        y = event.clientY - box.top;
      field.setPointer(x, y, x >= 0 && y >= 0 && x <= box.width && y <= box.height);
    };
    const onBlur = () => {
      focused = false;
      sync();
    };
    const onFocus = () => {
      focused = true;
      sync();
    };
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    resize();
    return () => {
      intersection.disconnect();
      sizing.disconnect();
      media.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      field.dispose();
    };
  }, [variant]);
  return (
    <div ref={shellRef} className={`hm-ambient hm-ambient--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} data-animation-active="false" />
    </div>
  );
}
