import { readFileSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { faceFile, faceKey, type Face } from './fonts';
import type { Scene } from './layout';

/**
 * Print file: the same scene as the preview, drawn as a vector PDF with embedded fonts.
 * The page is the trim size plus bleed on every side; TrimBox marks the final size and
 * BleedBox the full page. Colours are RGB (the first edition was printed that way).
 */

const MM = 72 / 25.4;
export const BLEED_MM = 3;

const FONT_DIR = path.join(process.cwd(), 'src', 'planner', 'fonts');
const fontCache = new Map<string, Buffer>();
const fontBuffer = (f: Face): Buffer => {
  const key = faceKey(f);
  let buf = fontCache.get(key);
  if (!buf) {
    buf = readFileSync(path.join(FONT_DIR, faceFile(f)));
    fontCache.set(key, buf);
  }
  return buf;
};

export type PdfOptions = { bleed?: number; title?: string };

export function renderPdf(scene: Scene, opts: PdfOptions = {}): Promise<Buffer> {
  const bleed = opts.bleed ?? BLEED_MM;
  const W = (scene.width + 2 * bleed) * MM;
  const H = (scene.height + 2 * bleed) * MM;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [W, H],
      margin: 0,
      autoFirstPage: false,
      compress: true,
      info: { Title: opts.title ?? 'plana studio Wandplaner', Creator: 'plana studio', Producer: 'plana studio layout engine' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.addPage({ size: [W, H], margin: 0 });
    const box = [bleed * MM, bleed * MM, (bleed + scene.width) * MM, (bleed + scene.height) * MM];
    const dict = doc.page.dictionary.data as Record<string, unknown>;
    dict.TrimBox = box;
    dict.BleedBox = [0, 0, W, H];

    const registered = new Set<string>();
    const useFont = (f: Face) => {
      const key = faceKey(f);
      if (!registered.has(key)) {
        doc.registerFont(key, fontBuffer(f));
        registered.add(key);
      }
      doc.font(key);
    };

    doc.rect(0, 0, W, H).fill(scene.paper);
    doc.save();
    doc.scale(MM).translate(bleed, bleed);

    for (const p of scene.prims) {
      if (p.k === 'rect') {
        doc.fillOpacity(p.o ?? 1).rect(p.x, p.y, p.w, p.h).fill(p.fill);
      } else if (p.k === 'lines') {
        doc.lineWidth(p.w).lineCap(p.cap).strokeOpacity(p.o ?? 1);
        for (const [x1, y1, x2, y2] of p.segs) doc.moveTo(x1, y1).lineTo(x2, y2);
        doc.stroke(p.stroke);
      } else if (p.k === 'tri') {
        doc.fillOpacity(1).moveTo(p.pts[0], p.pts[1]).lineTo(p.pts[2], p.pts[3]).lineTo(p.pts[4], p.pts[5]).closePath().fill(p.fill);
      } else {
        useFont(p.face);
        doc.fontSize(p.size).fillOpacity(p.o ?? 1).fillColor(p.fill);
        const characterSpacing = (p.ls ?? 0) * p.size;
        const options = { lineBreak: false, characterSpacing, baseline: 'alphabetic' as const };
        let x = p.x;
        if (p.anchor === 'middle' || p.anchor === 'end') {
          // SVG anchors on the text including the spacing after each letter but the last
          const w = doc.widthOfString(p.s, options) - characterSpacing;
          x -= p.anchor === 'middle' ? w / 2 : w;
        }
        doc.text(p.s, x, p.y, options);
      }
    }
    doc.restore();
    doc.end();
  });
}
