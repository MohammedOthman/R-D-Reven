'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import type { createMotionWorld, WorldVariant } from './create-motion-world';

type World = ReturnType<typeof createMotionWorld>;

export function MotionWorld({
  variant,
  paused,
  focus = -1,
}: {
  variant: WorldVariant;
  paused: boolean;
  focus?: number;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const pausedRef = useRef(paused);
  const focusRef = useRef(focus);
  const syncRef = useRef(() => {});
  useEffect(() => {
    pausedRef.current = paused;
    syncRef.current();
  }, [paused]);
  useEffect(() => {
    focusRef.current = focus;
    worldRef.current?.setFocus(focus);
  }, [focus]);
  useEffect(() => {
    const shell = shellRef.current,
      canvas = canvasRef.current;
    if (
      !shell ||
      !canvas ||
      typeof window.matchMedia !== 'function' ||
      typeof WebGLRenderingContext === 'undefined'
    )
      return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let focused = true;
    let disposed = false,
      visible = false,
      loading = false,
      failed = false;
    const setPoster = () => {
      shell.dataset.sceneState = 'poster';
      canvas.dataset.animationActive = 'false';
    };
    const destroy = () => {
      const world = worldRef.current;
      worldRef.current = null;
      world?.dispose();
      setPoster();
    };
    const resize = () => {
      const { width, height } = shell.getBoundingClientRect();
      worldRef.current?.resize(width, height);
    };
    const sync = () => {
      const active =
        visible && focused && !pausedRef.current && !media.matches && !document.hidden && !failed;
      worldRef.current?.setActive(active);
      if (active && !worldRef.current && !loading) void start();
    };
    syncRef.current = sync;
    async function start() {
      if (
        disposed ||
        pausedRef.current ||
        media.matches ||
        failed ||
        loading ||
        worldRef.current ||
        !visible
      )
        return;
      loading = true;
      try {
        const { createMotionWorld } = await import('./create-motion-world');
        if (disposed || media.matches || !visible) return;
        worldRef.current = createMotionWorld(canvas!, variant);
        worldRef.current.setFocus(focusRef.current);
        resize();
        shell!.dataset.sceneState = 'ready';
        sync();
      } catch {
        failed = true;
        destroy();
      } finally {
        loading = false;
      }
    }
    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
        if (visible) void start();
        sync();
      },
      { threshold: 0.01 },
    );
    intersection.observe(shell);
    const sizing = new ResizeObserver(resize);
    sizing.observe(shell);
    const onMedia = () => {
      if (media.matches) destroy();
      else void start();
      sync();
    };
    const onVisibility = () => {
      if (!document.hidden) void start();
      sync();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || media.matches || pausedRef.current || !visible) return;
      worldRef.current?.setPointer(
        (event.clientX / window.innerWidth - 0.5) * 2,
        (event.clientY / window.innerHeight - 0.5) * 2,
      );
    };
    const onLeave = () => {
      focused = false;
      worldRef.current?.setPointer(0, 0);
      sync();
    };
    const onFocus = () => {
      focused = true;
      sync();
    };
    const onLoss = (event: Event) => {
      if (disposed || !worldRef.current) return;
      event.preventDefault();
      failed = true;
      destroy();
    };
    media.addEventListener('change', onMedia);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('blur', onLeave);
    window.addEventListener('focus', onFocus);
    canvas.addEventListener('webglcontextlost', onLoss);
    return () => {
      disposed = true;
      syncRef.current = () => {};
      intersection.disconnect();
      sizing.disconnect();
      media.removeEventListener('change', onMedia);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('focus', onFocus);
      canvas.removeEventListener('webglcontextlost', onLoss);
      destroy();
    };
  }, [variant]);
  return (
    <div
      ref={shellRef}
      className={`hm-motion-world hm-motion-world--${variant}`}
      data-scene-state="poster"
      aria-hidden="true"
    >
      <Image
        className="hm-world-poster"
        src={`/brand/home/partnership-city-${variant === 'film' ? 'dark' : 'light'}.webp`}
        alt=""
        fill
        sizes="(max-width: 800px) 100vw, 1100px"
        priority={variant === 'hero'}
      />
      <canvas ref={canvasRef} data-animation-active="false" />
    </div>
  );
}
