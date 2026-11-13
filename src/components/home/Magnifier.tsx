'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Lens scale in screen pixels per millimetre of paper: the 2 mm holiday labels read at about 7 px, two to three days fit. */
const PX_PER_MM = 3.4;

/**
 * A reading lens over the planner. With a mouse it follows the pointer; on touch it follows a
 * sideways drag (vertical drags still scroll the page, the lens just closes). It works on every
 * element marked data-magnify that is shown large enough: the flat sheet, or the hero's planner
 * once the camera has pushed in. The lens draws the same SVG with a moving viewBox, so it is
 * sharp at any zoom and only the visible part is rendered.
 *
 * Keyboard and no-hover alternative: "Details vergrößern" opens the sheet at full print scale in
 * a scrollable box (arrow keys scroll it once focused).
 */
export function Magnifier({ svg, label, sheet }: { svg: string; label: string; sheet: { width: number; height: number } }) {
  const lens = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = lens.current;
    const svgEl = el?.querySelector('svg');
    if (!el || !svgEl) return;
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svgEl.removeAttribute('class');
    const targets = [...document.querySelectorAll<HTMLElement>('[data-magnify]')];
    let current: { t: HTMLElement; touch: boolean } | undefined;
    let raf = 0;
    let pending: PointerEvent | undefined;

    const hide = () => {
      current = undefined;
      el.dataset.on = 'false';
    };
    const draw = () => {
      raf = 0;
      const e = pending;
      if (!e || !current) return;
      const r = current.t.getBoundingClientRect();
      // Below this the sheet is a small picture on the wall; a lens there would only confuse.
      if (r.width < Math.min(innerWidth * 0.45, 420)) return hide();
      const u = (e.clientX - r.left) / r.width;
      const v = (e.clientY - r.top) / r.height;
      if (u < 0 || u > 1 || v < 0 || v > 1) return hide();
      const d = el.offsetWidth;
      const mm = d / PX_PER_MM;
      svgEl.setAttribute('viewBox', `${(u * sheet.width - mm / 2).toFixed(2)} ${(v * sheet.height - mm / 2).toFixed(2)} ${mm.toFixed(2)} ${mm.toFixed(2)}`);
      // On touch the lens sits above the finger, otherwise centred on the pointer.
      const y = current.touch ? e.clientY - d * 0.5 - 56 : e.clientY;
      el.style.transform = `translate3d(${Math.round(e.clientX - d / 2)}px, ${Math.round(y - d / 2)}px, 0)`;
      el.dataset.on = 'true';
    };
    const move = (e: PointerEvent) => {
      if (!current && e.pointerType === 'mouse') current = { t: e.currentTarget as HTMLElement, touch: false };
      if (!current) return;
      pending = e;
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && e.type === 'pointerenter') return;
      current = { t: e.currentTarget as HTMLElement, touch: e.pointerType !== 'mouse' };
      move(e);
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.type !== 'pointerleave') hide();
    };
    const offs: (() => void)[] = [];
    for (const t of targets) {
      const on = <K extends keyof HTMLElementEventMap>(k: K, fn: (e: HTMLElementEventMap[K]) => void) => {
        t.addEventListener(k, fn as EventListener, { passive: true });
        offs.push(() => t.removeEventListener(k, fn as EventListener));
      };
      on('pointerenter', enter);
      on('pointerdown', enter);
      on('pointermove', move);
      on('pointerleave', leave);
      on('pointerup', (e) => e.pointerType !== 'mouse' && hide());
      on('pointercancel', hide);
    }
    // The lens is position: fixed; a scroll under a resting mouse would leave it behind.
    addEventListener('scroll', hide, { passive: true });
    return () => {
      offs.forEach((f) => f());
      removeEventListener('scroll', hide);
      cancelAnimationFrame(raf);
    };
  }, [mounted, sheet.width, sheet.height]);

  return (
    <div className="magnifier stack">
      <p className="small">
        <span className="hint-hover">Fahr mit der Maus über das Blatt, dann siehst du jeden Tag in Druckgröße. </span>
        <span className="hint-touch">Wisch seitlich über das Blatt, dann siehst du jeden Tag in Druckgröße. </span>
        <button type="button" className="linkbtn" aria-expanded={zoom} aria-controls="sheet-zoom" onClick={() => setZoom((z) => !z)}>
          {zoom ? 'Ganzes Blatt zeigen' : 'Details vergrößern'}
        </button>
      </p>
      {zoom && (
        <div className="zoom-view" id="sheet-zoom" role="region" aria-label={`${label}, vergrößert. Mit den Pfeiltasten verschieben.`} tabIndex={0}>
          <div className="sheet" style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      )}
      {mounted && createPortal(<div className="lens" ref={lens} data-on="false" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />, document.body)}
    </div>
  );
}
