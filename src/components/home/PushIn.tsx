'use client';

import { useEffect, useRef, type ReactNode } from 'react';

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The hero's camera move: while the visitor scrolls through the track, the pinned room is pushed
 * in until the planner on the wall fills most of the view; then the room fades to the lilac of
 * the next section and the pin lets go. Native scrolling throughout (position: sticky, nothing is
 * captured); one rAF-throttled scroll handler writes transform and opacity only.
 *
 * Whether the track is tall and pinned is decided by CSS (html.js + prefers-reduced-motion), so
 * the first paint already has the final layout. Without JavaScript or with reduced motion the
 * scene stays a static, cropped picture and the next section shows the flat sheet instead.
 */
export function PushIn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    const q = <T extends HTMLElement>(sel: string) => track.querySelector(sel) as T;
    const pin = q('.push-pin');
    const pos = q('.push-pos');
    const cam = q('.push-cam');
    const sheet = q('.room-sheet');
    const photo = q('.room-photo');
    const paper = q('.room-paper');
    const wash = q('.push-wash');
    const caption = q('.push-caption');
    if (!pin || !pos || !cam || !sheet) return;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let geo = { camX: 0, camY: 0, cx: 0, cy: 0, S: 1, D: 1, tx: 0, ty: 0 };
    let raf = 0;
    let idle = 0;
    let last = -1;

    const measure = () => {
      const pr = pin.getBoundingClientRect();
      const cr = pos.getBoundingClientRect();
      const PW = pr.width;
      const PH = pr.height;
      const sw = sheet.offsetWidth;
      const sh = sheet.offsetHeight;
      // Room for the caption at the bottom; the sheet ends as wide as the view allows.
      const cap = PW < 720 ? 64 : 72;
      const target = Math.min(PW * (PW < 720 ? 0.92 : 0.86), (PH - 2 * cap) * (sw / sh));
      geo = {
        camX: cr.left - pr.left,
        camY: cr.top - pr.top,
        cx: sheet.offsetLeft + sw / 2,
        cy: sheet.offsetTop + sh / 2,
        S: Math.max(1, target / sw),
        D: Math.max(1, track.offsetHeight - PH),
        tx: PW / 2,
        // Upright phones: the sheet comes to rest just above the caption, so the text of the next
        // section follows it closely instead of after half a screen of empty lilac.
        ty: PW / PH < 0.8 ? Math.max((PH - cap) / 2, PH - cap - 24 - (target * sh) / sw / 2) : (PH - cap) / 2 + 8,
      };
      last = -1;
    };

    const apply = () => {
      raf = 0;
      const p = clamp(-track.getBoundingClientRect().top / geo.D);
      if (p === last) return;
      last = p;
      // 0 → 0.78: push in. 0.55 → 0.85: the room gives way to the flat sheet. Then a short hold.
      const z = ease(clamp(p / 0.78));
      const f = ease(clamp((p - 0.55) / 0.3));
      const s = Math.pow(geo.S, z);
      const x = lerp(geo.camX + geo.cx, geo.tx, z);
      const y = lerp(geo.camY + geo.cy, geo.ty, z);
      cam.style.transform = `translate3d(${(x - geo.camX - s * geo.cx).toFixed(2)}px, ${(y - geo.camY - s * geo.cy).toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
      if (photo) photo.style.opacity = String(1 - f);
      if (paper) paper.style.opacity = String(f);
      if (wash) wash.style.opacity = String(f);
      // "Visualisierung" describes the room; once only the print file is left, the caption goes with it.
      if (caption) caption.style.opacity = String(1 - f);
      track.dataset.end = p > 0.9 ? 'true' : 'false';
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
      // Composite while moving; drop the layer hint when scrolling stops so the planner is
      // re-rastered at its current size and stays sharp.
      if (!idle) cam.style.willChange = 'transform';
      clearTimeout(idle);
      idle = window.setTimeout(() => {
        idle = 0;
        cam.style.willChange = '';
      }, 180);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    const reset = () => {
      cam.style.transform = '';
      cam.style.willChange = '';
      for (const el of [photo, paper, wash, caption]) if (el) el.style.opacity = '';
      delete track.dataset.end;
    };

    let active = false;
    const setup = () => {
      // CSS turns the pin on only when motion is welcome; mirror that here.
      const want = !reduce.matches && getComputedStyle(pin).position === 'sticky';
      if (want === active) return;
      active = want;
      if (want) {
        measure();
        apply();
        addEventListener('scroll', onScroll, { passive: true });
        addEventListener('resize', onResize);
      } else {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onResize);
        reset();
      }
    };
    setup();
    reduce.addEventListener('change', setup);
    // Fonts and the image do not change the geometry, but a late layout change (e.g. the header
    // wrapping) can: measure again once everything has loaded.
    const onLoad = () => active && onResize();
    addEventListener('load', onLoad);

    return () => {
      reduce.removeEventListener('change', setup);
      removeEventListener('load', onLoad);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      reset();
    };
  }, []);

  return (
    <div className="push" ref={ref}>
      {children}
    </div>
  );
}
