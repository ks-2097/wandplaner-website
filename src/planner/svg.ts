import { FONT_FAMILIES, type Face } from './fonts';
import type { Prim, Scene } from './layout';

const n = (v: number) => String(Math.round(v * 100) / 100);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const family = (f: Face) => `'${FONT_FAMILIES[f.family].css}', 'Helvetica Neue', Arial, sans-serif`;

export type SvgOptions = {
  /** Bleed in mm drawn around the trim size (print). 0 for the on-screen preview. */
  bleed?: number;
  /** Accessible name; when absent the SVG is hidden from assistive tech */
  title?: string;
  className?: string;
};

/** Renders a scene as an SVG string. Units are mm; the viewBox is the sheet. */
export function renderSvg(scene: Scene, opts: SvgOptions = {}): string {
  const bleed = opts.bleed ?? 0;
  const W = scene.width + 2 * bleed;
  const H = scene.height + 2 * bleed;
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-bleed} ${-bleed} ${W} ${H}"${opts.className ? ` class="${opts.className}"` : ''}` +
      (opts.title ? ` role="img" aria-label="${esc(opts.title).replace(/"/g, '&quot;')}"` : ' aria-hidden="true"') +
      ` text-rendering="geometricPrecision">`,
  );
  out.push(`<rect x="${-bleed}" y="${-bleed}" width="${W}" height="${H}" fill="${scene.paper}"/>`);

  // Texts that share a style are grouped, which keeps the markup small.
  const groups = new Map<string, { attrs: string; items: string[] }>();
  const order: (string | { group: string })[] = [];

  for (const p of scene.prims) {
    if (p.k === 'rect') {
      order.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="${p.fill}"${op(p.o, 'fill-opacity')}/>`);
    } else if (p.k === 'lines') {
      const d = p.segs.map(([x1, y1, x2, y2]) => `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`).join('');
      order.push(`<path d="${d}" fill="none" stroke="${p.stroke}" stroke-width="${n(p.w)}" stroke-linecap="${p.cap}"${op(p.o, 'stroke-opacity')}/>`);
    } else if (p.k === 'tri') {
      order.push(`<path d="M${n(p.pts[0])} ${n(p.pts[1])}L${n(p.pts[2])} ${n(p.pts[3])}L${n(p.pts[4])} ${n(p.pts[5])}Z" fill="${p.fill}"/>`);
    } else {
      const key = textKey(p);
      let g = groups.get(key);
      if (!g) {
        g = {
          attrs:
            `font-family="${family(p.face)}" font-weight="${p.face.weight}" font-size="${n(p.size)}" fill="${p.fill}"${op(p.o, 'fill-opacity')}` +
            (p.anchor && p.anchor !== 'start' ? ` text-anchor="${p.anchor}"` : '') +
            (p.ls ? ` letter-spacing="${n(p.ls * p.size)}"` : ''),
          items: [],
        };
        groups.set(key, g);
        order.push({ group: key });
      }
      g.items.push(`<text x="${n(p.x)}" y="${n(p.y)}">${esc(p.s)}</text>`);
    }
  }
  for (const item of order) {
    if (typeof item === 'string') out.push(item);
    else {
      const g = groups.get(item.group)!;
      out.push(`<g ${g.attrs}>${g.items.join('')}</g>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}

const op = (o: number | undefined, attr: string) => (o !== undefined && o < 1 ? ` ${attr}="${n(o)}"` : '');
const textKey = (p: Extract<Prim, { k: 'text' }>) => [p.face.family, p.face.weight, p.size, p.fill, p.o ?? 1, p.anchor ?? 'start', p.ls ?? 0].join('|');
