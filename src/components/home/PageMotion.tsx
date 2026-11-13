'use client';

import { useEffect } from 'react';

/**
 * Quiet motion for the homepage: sections ease in once as they enter the view, and the numbers
 * count up once. Nothing happens under prefers-reduced-motion. Content is server-rendered in its
 * final state; only what is still below the fold is prepared, so nothing visible ever flickers.
 */
export function PageMotion() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const root = document.documentElement;
    const below = (el: Element) => el.getBoundingClientRect().top > innerHeight * 0.92;

    const reveal = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter(below);
    for (const el of reveal) el.dataset.in = 'false';
    root.classList.add('reveal-ready');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.in = 'true';
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    reveal.forEach((el) => io.observe(el));

    const counters = [...document.querySelectorAll<HTMLElement>('[data-count]')].filter(below);
    const frames: number[] = [];
    const count = (el: HTMLElement) => {
      const text = el.dataset.count ?? el.textContent ?? '';
      const to = Number(text);
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 1100);
        const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
        el.textContent = String(v).padStart(text.length, '0');
        if (k < 1) frames.push(requestAnimationFrame(step));
      };
      frames.push(requestAnimationFrame(step));
    };
    for (const el of counters) el.textContent = '0'.repeat(el.dataset.count?.length ?? 1);
    const cio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          count(e.target as HTMLElement);
          cio.unobserve(e.target);
        }
      },
      { threshold: 1 },
    );
    counters.forEach((el) => cio.observe(el));

    return () => {
      io.disconnect();
      cio.disconnect();
      frames.forEach(cancelAnimationFrame);
      for (const el of reveal) el.dataset.in = 'true';
      for (const el of counters) el.textContent = el.dataset.count ?? el.textContent;
      root.classList.remove('reveal-ready');
    };
  }, []);
  return null;
}
