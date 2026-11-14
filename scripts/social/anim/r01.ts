// R01 "Der Planer lebt": handwritten notes appear on the printed planner while the camera
// drifts through the year, then pulls out to the whole sheet. 15 s, no audio.
//
//   npx tsx scripts/social/anim/r01.ts [--out <dir>] [--check]   (--check: layout + camera checks only, no frames)
//
// The print is the engine's own SVG (buildScene + renderSvg from a validated spec). The
// handwriting is an SVG overlay in Gloria Hallelujah, placed in day cells that are read from
// the scene's grid lines and verified against the printed day numbers; every note is checked
// against the printed text, lines and marks of its cell using ink boxes measured in Chromium.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { FONT_FAMILIES, MONTHS_DE, defaultSpec, fromDayNumber, toDayNumber, type Prim, type Scene } from '../../../src/planner';
import { BRAND, FPS, H, SAFE, W, args, cover, encode, framePath, htmlPage, openStage, outDirs, planner, strip, svgInner } from './lib';

const { arg, has } = args();
const { out, work, frames } = outDirs('R01', arg('--out'));
const CHECK_ONLY = has('--check');

// ------------------------------------------------------------------ the print
const base = defaultSpec({ layout: 'wochen', edition: 'aubergine', state: 'BE', start: { year: 2027, month: 1 } });
base.birthdays = [
  { name: 'Oma Inge', day: 14, month: 3 },
  { name: 'Jonas', day: 1, month: 5 },
  { name: 'Mila', day: 22, month: 9 },
];
const { scene, svg } = planner(base, 'R01');

// ------------------------------------------------------------------ cells from the scene
type Box = { x: number; y: number; w: number; h: number };
type Text = Extract<Prim, { k: 'text' }>;
const texts = scene.prims.filter((p): p is Text => p.k === 'text');

function gridOf(s: Scene) {
  const grid = s.prims.find((p): p is Extract<Prim, { k: 'lines' }> => p.k === 'lines' && p.o !== undefined && p.w === base.design.lines.grid)!;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const xs = [...new Set(grid.segs.filter((g) => g[0] === g[2]).map((g) => r2(g[0])))].sort((a, b) => a - b);
  const vert = grid.segs.filter((g) => g[0] === g[2]);
  const top = Math.min(...vert.map((g) => g[1]));
  const bottom = Math.max(...vert.map((g) => g[3]));
  const ys = [top, ...new Set(grid.segs.filter((g) => g[1] === g[3]).map((g) => r2(g[1])))].concat(bottom).sort((a, b) => a - b);
  return { xs: [...new Set(xs)], ys: [...new Set(ys.map(r2))] };
}
const { xs, ys } = gridOf(scene);
const COLS = xs.length - 1;
if (COLS !== 28 || ys.length !== 14) throw new Error(`unexpected grid ${xs.length} × ${ys.length}`);

const dayNo = (d: number, m: number) => toDayNumber(2027, m, d);
function cellOf(n: number): Box {
  const i = n - scene.from;
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  const box = { x: xs[c], y: ys[r], w: xs[c + 1] - xs[c], h: ys[r + 1] - ys[r] };
  // Verify against the print: the cell holds this day's number (or the month name on the 1st).
  const { d, m } = fromDayNumber(n);
  const inside = (t: Text) => t.x >= box.x && t.x < box.x + box.w && t.y > box.y && t.y < box.y + box.h;
  const ok = d === 1 ? texts.some((t) => inside(t) && t.s === MONTHS_DE[m - 1].toUpperCase()[0]) : texts.some((t) => inside(t) && t.s === String(d).padStart(2, '0') && t.size > 6);
  if (!ok) throw new Error(`cell for ${d}.${m}. does not hold its printed number`);
  return box;
}

// ------------------------------------------------------------------ the notes
const PEN = {
  blue: { c: '#1f3570', o: 0.94 },
  graphite: { c: '#4f4f56', o: 0.8 },
  red: { c: '#a23a33', o: 0.9 },
};
type PenId = keyof typeof PEN;
type Item =
  | { kind: 'text'; id: string; t: number; date: [number, number]; lines: string[]; pen: PenId; size?: number; prefer?: 'top' | 'low' | 'right' }
  | { kind: 'mark'; id: string; t: number; date: [number, number]; mark: 'circle' | 'heart' | 'sun' | 'tick'; pen: PenId; prefer?: 'top' | 'low' | 'right' }
  | { kind: 'arrow'; id: string; t: number; date: [number, number]; to: string; pen: PenId }
  | { kind: 'strike'; id: string; t: number; of: string; pen: PenId };

const S = (id: string, t: number, d: number, m: number, lines: string[], pen: PenId, prefer?: 'top' | 'low' | 'right'): Item => ({ kind: 'text', id, t, date: [d, m], lines, pen, prefer });
const M = (id: string, t: number, d: number, m: number, mark: 'circle' | 'heart' | 'sun' | 'tick', pen: PenId, prefer?: 'top' | 'low' | 'right'): Item => ({ kind: 'mark', id, t, date: [d, m], mark, pen, prefer });

// Times in seconds. The pace accelerates: ~0.6 s apart at first, ~0.12 s at the end.
const ITEMS: Item[] = [
  // January to March, close
  S('zahnarzt', 1.0, 4, 1, ['Zahnarzt', '9:30'], 'blue'),
  S('oma', 1.6, 30, 1, ['Oma kommt'], 'blue'),
  S('schwimm1', 2.2, 2, 3, ['Schwimm-', 'kurs'], 'graphite'),
  M('tick-zahnarzt', 2.75, 4, 1, 'tick', 'graphite', 'right'),
  S('paul', 3.0, 6, 1, ['Paul', 'wird 7'], 'red'),
  M('heart-paul', 3.45, 6, 1, 'heart', 'red', 'right'),
  S('joggen', 3.95, 3, 3, ['Joggen 7:00'], 'blue', 'top'),
  { kind: 'strike', id: 'strike-joggen', t: 4.36, of: 'joggen', pen: 'blue' },
  S('spazieren', 4.56, 3, 3, ['Spazieren'], 'blue'),
  S('kinderarzt', 3.42, 4, 2, ['Kinderarzt', '10:15'], 'graphite'),
  S('schwimm2', 5.45, 9, 3, ['Schwimm-', 'kurs'], 'graphite'),
  M('circle-lea', 5.75, 10, 3, 'circle', 'blue'),
  S('lea', 5.9, 10, 3, ['Lea 40'], 'blue'),
  S('kuchen', 6.4, 14, 3, ['Kuchen'], 'red', 'low'),
  { kind: 'arrow', id: 'arrow-kuchen', t: 6.68, date: [14, 3], to: 'OMA INGE', pen: 'red' },
  // spring to summer
  S('kita', 6.85, 7, 5, ['Kita zu'], 'red'),
  S('muttertag', 7.05, 9, 5, ['Muttertag'], 'red'),
  M('heart-mutter', 7.3, 9, 5, 'heart', 'red', 'low'),
  S('hochzeit', 7.4, 5, 6, ['Hochzeit', 'Tim & Ana'], 'blue'),
  S('sommerfest', 7.6, 4, 6, ['Sommerfest', '15:00'], 'graphite'),
  S('zeugnisse', 7.8, 30, 6, ['Zeugnisse'], 'blue'),
  S('flug', 7.95, 3, 7, ['Flug 6:40'], 'red'),
  M('circle-flug', 8.15, 3, 7, 'circle', 'red'),
  M('sun', 8.3, 4, 7, 'sun', 'red', 'top'),
  S('ostsee', 8.45, 5, 7, ['Ostsee'], 'blue'),
  S('rueckflug', 8.65, 29, 7, ['Rückflug'], 'blue'),
  // autumn
  S('elternabend', 8.85, 21, 9, ['Elternabend', '19:30'], 'blue'),
  S('geschenk', 9.05, 22, 9, ['Geschenk?'], 'graphite', 'low'),
  { kind: 'arrow', id: 'arrow-mila', t: 9.25, date: [22, 9], to: 'MILA', pen: 'graphite' },
  S('umzug', 9.35, 25, 9, ['Umzug', 'Jan'], 'graphite'),
  S('reiterhof', 9.5, 20, 10, ['Reiterhof'], 'blue'),
  S('reifen', 9.65, 19, 10, ['Reifen', 'wechseln'], 'graphite'),
  S('laterne', 9.8, 11, 11, ['Laternen-', 'fest'], 'red'),
  S('markt', 9.95, 11, 12, ['Weihnachts-', 'markt'], 'red'),
  S('feier', 10.1, 17, 12, ['Weihnachts-', 'feier'], 'graphite'),
  // the pull-out: the whole year fills up
  S('schulstart', -1, 16, 8, ['Schulstart'], 'blue'),
  M('circle-schule', -1, 16, 8, 'circle', 'red'),
  S('uhr', -1, 31, 10, ['Uhr', 'umstellen'], 'graphite'),
  S('elternabend2', -1, 15, 9, ['Elternabend'], 'blue'),
  S('ostereier', -1, 27, 3, ['Ostereier'], 'red'),
  S('kino', -1, 15, 1, ['Kino'], 'blue'),
  S('fasching', -1, 13, 2, ['Fasching'], 'red'),
  S('fussball', -1, 23, 1, ['Fußball', '10:00'], 'graphite'),
  S('opa', -1, 20, 2, ['Opa 70'], 'blue'),
  M('circle-opa', -1, 20, 2, 'circle', 'blue'),
  S('friseur', -1, 22, 4, ['Friseur', '16:00'], 'graphite'),
  M('heart-jonas', -1, 1, 5, 'heart', 'red', 'low'),
  S('grillen', -1, 26, 6, ['Grillen'], 'blue'),
  S('flohmarkt', -1, 4, 9, ['Flohmarkt'], 'graphite'),
  S('apfel', -1, 2, 10, ['Apfelernte'], 'red'),
  S('advent', -1, 27, 11, ['Advents-', 'kranz'], 'graphite'),
  S('stiefel', -1, 5, 12, ['Stiefel', 'putzen'], 'blue'),
  M('heart-xmas', -1, 24, 12, 'heart', 'red', 'top'),
  S('raclette', -1, 29, 12, ['Raclette'], 'blue'),
  S('steuer', -1, 9, 4, ['Steuer'], 'graphite'),
  M('tick-steuer', -1, 9, 4, 'tick', 'red', 'right'),
  S('impfen', -1, 26, 5, ['Impfen', '8:15'], 'blue'),
  S('schwimm4', -1, 23, 2, ['Schwimm-', 'kurs'], 'graphite'),
  S('oma2', -1, 18, 9, ['Oma kommt'], 'blue'),
  S('zahnarzt2', -1, 10, 11, ['Zahnarzt', '9:30'], 'blue'),
  S('schwimm3', -1, 16, 3, ['Schwimm-', 'kurs'], 'graphite'),
  S('ostsee2', -1, 22, 7, ['Ostsee'], 'blue'),
  S('fussball2', -1, 6, 2, ['Fußball'], 'graphite'),
  M('heart-valentin', -1, 14, 2, 'heart', 'red', 'top'),
  S('klavier', -1, 18, 2, ['Klavier', '16:00'], 'blue'),
  S('garten', -1, 24, 4, ['Garten'], 'graphite'),
  S('laufen', -1, 25, 4, ['Laufen'], 'blue'),
  S('laufen2', -1, 30, 5, ['Laufen'], 'blue'),
  S('oma75', -1, 2, 6, ['Oma 75'], 'red'),
  M('circle-oma75', -1, 2, 6, 'circle', 'red'),
  S('pass', -1, 8, 6, ['Pass', 'abholen'], 'graphite'),
  S('zoo', -1, 13, 6, ['Zoo'], 'blue'),
  S('packen', -1, 2, 7, ['Packen'], 'blue'),
  S('mama', -1, 3, 8, ['Mama 45'], 'red'),
  M('circle-mama', -1, 3, 8, 'circle', 'red'),
  S('zelten', -1, 14, 8, ['Zelten'], 'graphite'),
  S('fussball3', -1, 11, 9, ['Fußball'], 'graphite'),
  S('brunch', -1, 12, 9, ['Brunch'], 'red'),
  S('kino2', -1, 8, 10, ['Kino'], 'blue'),
  S('tierarzt', -1, 12, 10, ['Tierarzt'], 'graphite'),
  S('spiele', -1, 22, 10, ['Spiele-', 'abend'], 'blue'),
  S('konzert', -1, 19, 11, ['Konzert'], 'red'),
  S('klavier2', -1, 25, 11, ['Klavier', '16:00'], 'blue'),
  S('plaetzchen', -1, 4, 12, ['Plätzchen'], 'red'),
  S('baum', -1, 18, 12, ['Tannen-', 'baum'], 'graphite'),
  M('tick-pass', -1, 8, 6, 'tick', 'red', 'right'),
];

// ------------------------------------------------------------------ stage
const WALL = BRAND.surface;
const stageHtml = htmlPage(
  `<svg id="cam" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 1000 700" preserveAspectRatio="none" style="position:absolute;left:0;top:0;display:block" text-rendering="geometricPrecision">
     <rect x="-2000" y="-2000" width="5000" height="5000" fill="${WALL}"/>
     <g opacity="0.07">${[6, 4, 2.5, 1.2].map((s) => `<rect x="${-s * 0.3}" y="${s * 0.6}" width="1000" height="700" rx="${s}" fill="#2a1630" opacity="0.35"/>`).join('')}</g>
     <g id="sheet">${svgInner(svg)}</g>
     <g id="ink"></g>
   </svg>
   <div id="chip"></div>
   <div id="end"><p class="line">Genau dafür ist er da.</p><p class="wordmark"><b>plana</b> <span>studio</span></p></div>
   <canvas id="m" width="10" height="10" style="display:none"></canvas>`,
  `body{background:${WALL}}
   #chip{position:absolute;left:${SAFE.left}px;top:${SAFE.top + 6}px;padding:9px 18px;border-radius:999px;background:rgba(247,244,249,.9);color:${BRAND.aubergine};font:500 26px/1 Poppins;letter-spacing:.01em;opacity:0}
   #end{position:absolute;left:0;right:0;top:0;bottom:0;opacity:0}
   #end .line{position:absolute;left:0;right:0;top:410px;margin:0;text-align:center;font:600 62px/1.15 Poppins;letter-spacing:-0.02em;color:${BRAND.ink}}
   #end .wordmark{position:absolute;left:0;right:0;top:1390px;margin:0;text-align:center;font-size:46px;letter-spacing:-0.03em;line-height:1;color:${BRAND.aubergine}}
   .wordmark b{font-weight:700}.wordmark span{font-weight:400}`,
);

type Ink = { l: number; r: number; a: number; d: number; adv: number };
const GLORIA = FONT_FAMILIES.gloria.css;

(async () => {
  const { page, close } = await openStage(work, stageHtml);
  // Ink boxes at 100 px, scaled to mm later.
  const measure = async (reqs: { font: string; s: string; ls: number }[]): Promise<Ink[]> =>
    page.evaluate((rs: { font: string; s: string; ls: number }[]) => {
      const ctx = (document.getElementById('m') as HTMLCanvasElement).getContext('2d')!;
      return rs.map((q) => {
        ctx.font = q.font;
        (ctx as unknown as { letterSpacing: string }).letterSpacing = `${q.ls}px`;
        const m = ctx.measureText(q.s);
        return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, adv: m.width };
      });
    }, reqs);

  // ---- obstacles: everything printed, as ink boxes in mm
  const printed = await measure(texts.map((t) => ({ font: `${t.face.weight} 100px "${FONT_FAMILIES[t.face.family].css}"`, s: t.s, ls: (t.ls ?? 0) * 100 })));
  type Ob = Box & { what: string };
  const obstacles: Ob[] = [];
  texts.forEach((t, i) => {
    const m = printed[i];
    const k = t.size / 100;
    const x0 = t.anchor === 'middle' ? t.x - (m.adv * k) / 2 : t.anchor === 'end' ? t.x - m.adv * k : t.x;
    obstacles.push({ x: x0 - m.l * k, y: t.y - m.a * k, w: (m.l + m.r) * k, h: (m.a + m.d) * k, what: t.s });
  });
  for (const p of scene.prims) {
    if (p.k === 'rect' && (p.o === undefined || p.o >= 1)) obstacles.push({ x: p.x, y: p.y, w: p.w, h: p.h, what: 'bar' });
    if (p.k === 'tri') { const xs_ = [p.pts[0], p.pts[2], p.pts[4]]; const ys_ = [p.pts[1], p.pts[3], p.pts[5]]; obstacles.push({ x: Math.min(...xs_), y: Math.min(...ys_), w: Math.max(...xs_) - Math.min(...xs_), h: Math.max(...ys_) - Math.min(...ys_), what: 'arrowhead' }); }
    if (p.k === 'lines' && p.o === undefined) for (const s of p.segs) obstacles.push({ x: Math.min(s[0], s[2]), y: Math.min(s[1], s[3]) - p.w / 2, w: Math.abs(s[2] - s[0]), h: Math.abs(s[3] - s[1]) + p.w, what: 'period line' });
  }
  const hit = (a: Box, b: Box, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
  const within = (a: Box, c: Box, inset: number) => a.x >= c.x + inset && a.y >= c.y + inset && a.x + a.w <= c.x + c.w - inset && a.y + a.h <= c.y + c.h - inset;
  const obsIn = (c: Box) => obstacles.filter((o) => hit(o, c, -0.01));
  const numberBox = (c: Box) => {
    const n = texts.findIndex((t) => t.size > 6 && t.x >= c.x && t.x < c.x + c.w && t.y > c.y && t.y < c.y + c.h);
    return n >= 0 ? obstacles[n] : undefined;
  };

  // ---- note ink measured in Gloria Hallelujah
  const allLines = ITEMS.flatMap((it) => (it.kind === 'text' ? it.lines : []));
  const inkM = await measure(allLines.map((s) => ({ font: `400 100px "${GLORIA}"`, s, ls: 0 })));
  const ink = new Map(allLines.map((s, i) => [s, inkM[i]]));

  // ---- placement
  type Placed = {
    it: Item; cell: Box; box: Box; rot: number; cx: number; cy: number;
    // text
    size?: number; lines?: { s: string; x: number; y: number; w: number; l: number }[];
    // path marks
    d?: string; sw?: number; pen: PenId;
  };
  const placed: Placed[] = [];
  const byId = new Map<string, Placed>();
  const rand = (k: number) => { const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const INSET = 0.9;
  const PAD = 0.7;

  /** Free spot for a w × h box in a cell, rotated by rot degrees (AABB), avoiding print and earlier notes. */
  function findSpot(cell: Box, w: number, h: number, rot: number, prefer: 'top' | 'low' | 'right' | undefined, k: number) {
    const rad = (Math.abs(rot) * Math.PI) / 180;
    const bw = w * Math.cos(rad) + h * Math.sin(rad);
    const bh = h * Math.cos(rad) + w * Math.sin(rad);
    const obs = [...obsIn(cell), ...placed.filter((p) => p.cell.x === cell.x && p.cell.y === cell.y).map((p) => p.box)];
    const cands: { x: number; y: number; score: number }[] = [];
    for (let y = cell.y + INSET; y + bh <= cell.y + cell.h - INSET + 1e-9; y += 0.25)
      for (let x = cell.x + INSET; x + bw <= cell.x + cell.w - INSET + 1e-9; x += 0.25) {
        const b = { x, y, w: bw, h: bh };
        if (obs.some((o) => hit(b, o, PAD))) continue;
        const fx = (x - cell.x) / cell.w;
        const fy = (y - cell.y) / cell.h;
        const jitter = rand(k) * 0.08;
        const score = prefer === 'right' ? -fx + Math.abs(fy - 0.15) : prefer === 'low' ? Math.abs(fy - 0.5 - jitter) + fx * 0.6 : prefer === 'top' ? fy + fx * 0.6 : fy * 1.0 + Math.abs(fx - 0.04 - jitter) * 0.8;
        cands.push({ x, y, score });
      }
    cands.sort((a, b) => a.score - b.score);
    return cands[0] ? { x: cands[0].x, y: cands[0].y, w: bw, h: bh } : undefined;
  }

  ITEMS.forEach((it, k) => {
    if (it.kind === 'strike') {
      const p = byId.get(it.of)!;
      const ln = p.lines![0];
      const y = ln.y - ink.get(ln.s)!.a * (p.size! / 100) * 0.42;
      const d = `M${(ln.x - 0.6).toFixed(2)} ${(y + 0.25).toFixed(2)} C ${(ln.x + ln.w * 0.3).toFixed(2)} ${(y - 0.5).toFixed(2)}, ${(ln.x + ln.w * 0.65).toFixed(2)} ${(y + 0.6).toFixed(2)}, ${(ln.x + ln.w + 0.5).toFixed(2)} ${(y - 0.2).toFixed(2)}`;
      const q: Placed = { it, cell: p.cell, box: p.box, rot: p.rot, cx: p.cx, cy: p.cy, d, sw: 0.42, pen: it.pen };
      placed.push(q);
      byId.set(it.id, q);
      return;
    }
    const cell = cellOf(dayNo(it.date[0], it.date[1]));
    const rot = (rand(k + 3) * 2 - 1) * 2;
    if (it.kind === 'text') {
      for (let size = it.size ?? 5.2 - rand(k) * 0.5; size >= 3.6; size -= 0.2) {
        const s = size / 100;
        const pitch = size * 1.12;
        const m = it.lines.map((ln) => ink.get(ln)!);
        const w = Math.max(...m.map((q) => (q.l + q.r) * s));
        const top = m[0].a * s;
        const h = top + (it.lines.length - 1) * pitch + m[m.length - 1].d * s;
        const spot = findSpot(cell, w, h, rot, it.prefer, k);
        if (!spot) continue;
        // the rotated block sits centred in its AABB
        const cx = spot.x + spot.w / 2;
        const cy = spot.y + spot.h / 2;
        const lx = cx - w / 2;
        const ly = cy - h / 2 + top;
        const lines = it.lines.map((ln, j) => ({ s: ln, x: lx + m[j].l * s, y: ly + j * pitch, w: (m[j].l + m[j].r) * s, l: m[j].l * s }));
        const q: Placed = { it, cell, box: spot, rot, cx, cy, size, lines, pen: it.pen };
        placed.push(q);
        byId.set(it.id, q);
        return;
      }
      throw new Error(`note "${it.lines.join(' ')}" does not fit on ${it.date.join('.')}.`);
    }
    if (it.kind === 'mark' && it.mark === 'circle') {
      // A hand-drawn loop (superellipse, exponent 4) around the printed number. Checked point by
      // point: every point of the stroke stays clear of the number, of other print, and in the cell.
      const nb = numberBox(cell)!;
      const hw = nb.w / 2, hh = nb.h / 2;
      const rx = hw + 1.35, ry = hh + 1.25;
      const cx = nb.x + hw, cy = nb.y + hh;
      const sw = 0.4;
      const pts: [number, number][] = [];
      const a0 = -2.3 + rand(k) * 0.3;
      for (let j = 0; j <= 64; j++) {
        const a = a0 + (j / 64) * (Math.PI * 2 + 0.5);
        const wob = 1 + 0.025 * Math.sin(a * 3 + k) + (j / 64) * 0.06;
        const c = Math.cos(a), sn = Math.sin(a);
        pts.push([cx + rx * wob * Math.sign(c) * Math.abs(c) ** 0.5, cy + ry * wob * Math.sign(sn) * Math.abs(sn) ** 0.5]);
      }
      // A pen loop may run over a printed month bar (as it would on paper), never over text.
      const others = obsIn(cell).filter((o) => o !== nb && o.what !== 'bar');
      for (const [x, y] of pts) {
        const dot = { x: x - sw / 2, y: y - sw / 2, w: sw, h: sw };
        if (!within(dot, cell, 0.25)) throw new Error(`circle on ${it.date.join('.')}. leaves its cell`);
        if (hit(dot, nb, 0.35)) throw new Error(`circle on ${it.date.join('.')}. touches the number`);
        const bad = others.find((o) => hit(dot, o, 0.25));
        if (bad) throw new Error(`circle on ${it.date.join('.')}. touches ${bad.what}`);
      }
      const xsP = pts.map((q) => q[0]), ysP = pts.map((q) => q[1]);
      const gbox = { x: Math.min(...xsP) - sw / 2, y: Math.min(...ysP) - sw / 2, w: Math.max(...xsP) - Math.min(...xsP) + sw, h: Math.max(...ysP) - Math.min(...ysP) + sw };
      const q: Placed = { it, cell, box: gbox, rot: 0, cx, cy, d: 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L'), sw, pen: it.pen };
      placed.push(q);
      byId.set(it.id, q);
      return;
    }
    // small marks: heart, sun, tick, arrow
    const dims = it.kind === 'arrow' ? [7.5, 4.2] : it.mark === 'sun' ? [8.4, 8.4] : it.mark === 'heart' ? [4.6, 4.2] : [4.4, 3.8];
    const spot = findSpot(cell, dims[0], dims[1], rot, it.kind === 'arrow' ? 'low' : it.prefer, k);
    if (!spot) throw new Error(`${it.id} does not fit`);
    const cx = spot.x + spot.w / 2, cy = spot.y + spot.h / 2;
    let d = '';
    if (it.kind === 'arrow') {
      const target = obstacles.find((o) => o.what === it.to && hit(o, cell, 0))!;
      if (!target) throw new Error(`arrow target ${it.to} not in cell`);
      const tx = target.x + target.w / 2, ty = target.y + target.h / 2;
      const ang = Math.atan2(ty - cy, tx - cx);
      const L = 3.4;
      const [x0, y0, x1, y1] = [cx - L * Math.cos(ang), cy - L * Math.sin(ang), cx + L * Math.cos(ang), cy + L * Math.sin(ang)];
      const nx = -Math.sin(ang) * 0.6, ny = Math.cos(ang) * 0.6;
      const hd = (s: number) => `${(x1 - 1.6 * Math.cos(ang + s * 0.5)).toFixed(2)} ${(y1 - 1.6 * Math.sin(ang + s * 0.5)).toFixed(2)}`;
      d = `M${x0.toFixed(2)} ${y0.toFixed(2)} Q ${(cx + nx).toFixed(2)} ${(cy + ny).toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)} M${hd(1)} L${x1.toFixed(2)} ${y1.toFixed(2)} L${hd(-1)}`;
    } else if (it.mark === 'heart') {
      d = `M${cx} ${cy + 1.8} C ${cx - 2.6} ${cy + 0.1}, ${cx - 2.4} ${cy - 2.2}, ${cx - 1.1} ${cy - 1.9} C ${cx - 0.3} ${cy - 1.7}, ${cx} ${cy - 1.0}, ${cx} ${cy - 0.6} C ${cx + 0.1} ${cy - 1.2}, ${cx + 0.6} ${cy - 2.0}, ${cx + 1.3} ${cy - 1.9} C ${cx + 2.5} ${cy - 1.7}, ${cx + 2.4} ${cy + 0.2}, ${cx + 0.1} ${cy + 1.9}`;
    } else if (it.mark === 'tick') {
      d = `M${cx - 1.9} ${cy + 0.1} L${cx - 0.6} ${cy + 1.6} L${cx + 2.0} ${cy - 1.7}`;
    } else {
      const r = 1.7;
      const rays = Array.from({ length: 8 }, (_, j) => { const a = (j / 8) * Math.PI * 2 + 0.2; return `M${(cx + (r + 0.9) * Math.cos(a)).toFixed(2)} ${(cy + (r + 0.9) * Math.sin(a)).toFixed(2)} L${(cx + (r + 2.2) * Math.cos(a)).toFixed(2)} ${(cy + (r + 2.2) * Math.sin(a)).toFixed(2)}`; }).join(' ');
      const circ = Array.from({ length: 25 }, (_, j) => { const a = (j / 24) * Math.PI * 2.08; return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`; });
      d = `M${circ.join(' L')} ${rays}`;
    }
    const q: Placed = { it, cell, box: spot, rot: it.kind === 'arrow' ? 0 : rot, cx, cy, d, sw: 0.4, pen: it.pen };
    placed.push(q);
    byId.set(it.id, q);
  });

  // ---- verify every note: inside its cell, clear of the printed number and all print, no overlaps
  const report: string[] = [];
  for (const p of placed) {
    if (p.it.kind === 'strike') continue;
    if (!within(p.box, p.cell, 0.1)) throw new Error(`${p.it.id} leaves its cell`);
    const nb = numberBox(p.cell);
    if (p.it.kind !== 'mark' || p.it.mark !== 'circle') {
      if (nb && hit(p.box, nb, 0.3)) throw new Error(`${p.it.id} covers the date number`);
      const bad = obsIn(p.cell).filter((o) => hit(p.box, o, 0.3));
      if (bad.length) throw new Error(`${p.it.id} touches print: ${bad.map((b) => b.what)}`);
    }
    const clash = placed.filter((o) => o !== p && o.it.kind !== 'strike' && o.cell === p.cell && hit(o.box, p.box, 0) && !(o.it.kind === 'mark' && o.it.mark === 'circle'));
    if (clash.length && !(p.it.kind === 'mark' && p.it.mark === 'circle')) throw new Error(`${p.it.id} overlaps ${clash.map((c) => c.it.id)}`);

  }

  // ---- timing
  const durOf = (p: Placed) => (p.it.kind === 'text' ? Math.min(0.6, Math.max(0.3, p.it.lines.join('').length * 0.04)) : p.it.kind === 'strike' ? 0.25 : p.it.kind === 'mark' && p.it.mark === 'circle' ? 0.4 : 0.32);

  // ---- camera: follows the writing, then pulls out to the whole sheet
  const T_END = 15.0;
  const T_CARD = 13.5;
  const ASPECT = W / H;
  const FULL = { cx: 500, cy: 350, w: 1060 };
  // Keyframes [t, centre x, centre y, width] in mm; Catmull-Rom through them (log width).
  const KF: [number, number, number, number][] = [
    [0, 116, 179, 168],
    [1.2, 124, 181, 170],
    [4.6, 252, 198, 208],
    [6.3, 482, 256, 258],
    [8.3, 545, 360, 310],
    [10.1, 430, 445, 470],
    [12.7, FULL.cx, FULL.cy, FULL.w],
    [T_END, FULL.cx, FULL.cy, FULL.w],
  ];
  const spline = (t: number, get: (k: [number, number, number, number]) => number) => {
    if (t <= KF[0][0]) return get(KF[0]);
    let i = 0;
    while (i < KF.length - 2 && t > KF[i + 1][0]) i++;
    const [k0, k1] = [KF[i], KF[i + 1]];
    const prev = KF[Math.max(0, i - 1)], next = KF[Math.min(KF.length - 1, i + 2)];
    const u = Math.min(1, (t - k0[0]) / (k1[0] - k0[0]));
    const dt = k1[0] - k0[0];
    // tangents scaled to the segment; zero at the ends and at the final hold
    const m0 = i === 0 ? 0 : ((get(k1) - get(prev)) / (k1[0] - prev[0])) * dt;
    const m1 = i + 2 >= KF.length - 1 ? 0 : ((get(next) - get(k0)) / (next[0] - k0[0])) * dt;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    return h00 * get(k0) + h10 * m0 + h01 * get(k1) + h11 * m1;
  };
  const widthAt = (t: number) => Math.exp(spline(t, (k) => Math.log(k[3])));
  const camAt = (t: number) => {
    const w = widthAt(t);
    const h = w / ASPECT;
    const cx = spline(t, (k) => k[1]);
    const cy = spline(t, (k) => k[2]);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };

  // ---- pull-out notes: each starts once its cell is inside the safe band, at least 80 ms apart
  const toPx0 = (b: Box, cam: Box) => ({ x: ((b.x - cam.x) / cam.w) * W, y: ((b.y - cam.y) / cam.h) * H, w: (b.w / cam.w) * W, h: (b.h / cam.h) * H });
  const visible = (b: Box, t: number) => { const c = toPx0(b, camAt(t)); return c.x >= 20 && c.x + c.w <= W - 20 && c.y >= SAFE.top && c.y + c.h <= SAFE.bottom; };
  const autos = placed.filter((p) => p.it.t < 0).map((p) => {
    let e = 10.0;
    while (e < 12.7 && !(visible(p.cell, e) && visible(p.cell, e + 0.4))) e += 1 / FPS;
    return { p, e };
  });
  autos.sort((a, b) => a.e - b.e);
  let last = Math.max(...placed.filter((p) => p.it.t >= 0).map((p) => p.it.t));
  for (const a of autos) {
    const gap = last < 10.7 ? 0.09 : last < 11.4 ? 0.055 : 0.04;
    a.p.it.t = Math.max(a.e, last + gap);
    last = a.p.it.t;
  }
  if (last > 12.95) throw new Error(`pull-out notes run until ${last.toFixed(2)} s`);

  // ---- visibility: each note is inside the frame's safe band while it is written
  const toPx = (b: Box, cam: Box) => ({ x: ((b.x - cam.x) / cam.w) * W, y: ((b.y - cam.y) / cam.h) * H, w: (b.w / cam.w) * W, h: (b.h / cam.h) * H });
  const issues: string[] = [];
  for (const p of placed) {
    for (const t of [p.it.t, p.it.t + durOf(p)]) {
      const c = toPx(p.cell, camAt(t));
      if (c.x < 20 || c.x + c.w > W - 20 || c.y < SAFE.top || c.y + c.h > SAFE.bottom) issues.push(`${p.it.id} at ${t.toFixed(2)}s: cell at px ${c.x.toFixed(0)},${c.y.toFixed(0)} ${c.w.toFixed(0)}×${c.h.toFixed(0)}`);
    }
  }
  // camera speed in px/s (relative to frame)
  let maxSpeed = 0;
  for (let f = 1; f < T_CARD * FPS; f++) {
    const a = camAt((f - 1) / FPS), b = camAt(f / FPS);
    const v = Math.hypot((b.x + b.w / 2 - a.x - a.w / 2) / b.w * W, (b.y + b.h / 2 - a.y - a.h / 2) / b.h * H) * FPS;
    maxSpeed = Math.max(maxSpeed, v);
  }
  for (const p of [...placed].sort((x, y) => x.it.t - y.it.t)) {
    if (p.it.kind === 'strike') { report.push(`${p.it.t.toFixed(2).padStart(5)}s  [strike-through of "${(byId.get(p.it.of)!.it as { lines: string[] }).lines.join(' ')}", rewritten below]`); continue; }
    const date = 'date' in p.it ? `${String(p.it.date[0]).padStart(2, '0')}.${String(p.it.date[1]).padStart(2, '0')}.2027` : '';
    const wd = 'date' in p.it ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(Date.UTC(2027, p.it.date[1] - 1, p.it.date[0])).getUTCDay()] : '';
    report.push(`${p.it.t.toFixed(2).padStart(5)}s  ${wd} ${date}  ${p.it.kind === 'text' ? `"${p.it.lines.join(' ')}" (${p.pen}, ${p.size!.toFixed(1)} mm, ${p.rot.toFixed(1)}°)` : p.it.kind === 'mark' ? `[${p.it.mark}] (${p.pen})` : `[arrow to ${(p.it as { to: string }).to}]`}`);
  }
  writeFileSync(path.join(out, 'notes.txt'), report.join('\n') + '\n');
  console.log(report.join('\n'));
  console.log(`camera: max pan ${maxSpeed.toFixed(0)} px/s; px per mm at start ${(W / widthAt(0)).toFixed(2)}`);
  if (issues.length) { console.log('VISIBILITY ISSUES\n' + issues.join('\n')); if (!has('--force')) { await close(); process.exit(1); } }
  if (CHECK_ONLY) { await close(); return; }

  // ---- overlay markup for a moment in time
  const ease = (u: number) => 1 - (1 - u) ** 1.6;
  const overlay = (t: number) => {
    const parts: string[] = [];
    for (const p of placed) {
      const u = (t - p.it.t) / durOf(p);
      if (u <= 0) continue;
      const pr = Math.min(1, ease(Math.min(1, u)));
      const pen = PEN[p.pen];
      const rotate = p.rot ? ` transform="rotate(${p.rot.toFixed(2)} ${p.cx.toFixed(2)} ${p.cy.toFixed(2)})"` : '';
      if (p.lines) {
        // reveal left to right, line after line
        const total = p.lines.reduce((s, l) => s + l.w, 0);
        let left = pr * total;
        const clips: string[] = [];
        const tx: string[] = [];
        p.lines.forEach((l, j) => {
          const shown = Math.max(0, Math.min(l.w, left));
          left -= l.w;
          if (shown <= 0) return;
          const top = l.y - p.size! * 1.2;
          clips.push(`<rect x="${(l.x - l.l - 0.6).toFixed(2)}" y="${top.toFixed(2)}" width="${(shown + (shown >= l.w ? 1.2 : 0.6)).toFixed(3)}" height="${(p.size! * 1.6).toFixed(2)}"/>`);
          tx.push(`<text x="${(l.x - l.l).toFixed(2)}" y="${l.y.toFixed(2)}">${l.s.replace(/&/g, '&amp;')}</text>`);
          void j;
        });
        const id = `c-${p.it.id}`;
        parts.push(`<g${rotate}><clipPath id="${id}">${clips.join('')}</clipPath><g clip-path="url(#${id})" font-family="'${GLORIA}'" font-size="${p.size!.toFixed(2)}" fill="${pen.c}" fill-opacity="${pen.o}">${tx.join('')}</g></g>`);
      } else if (p.d) {
        parts.push(`<path${rotate} d="${p.d}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - pr).toFixed(4)}" fill="none" stroke="${pen.c}" stroke-opacity="${pen.o}" stroke-width="${p.sw}" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }
    return parts.join('');
  };

  // month chip: latest month written so far, shown while the camera is close
  const monthAt = (t: number) => {
    const done = placed.filter((p) => 'date' in p.it && p.it.t <= t);
    return done.length ? Math.max(...done.map((p) => (p.it as { date: [number, number] }).date[1])) : 1;
  };

  const N = Math.round(T_END * FPS);
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    const cam = camAt(Math.min(t, T_CARD));
    const chipO = t < 0.4 ? t / 0.4 : t < 9.6 ? 1 : Math.max(0, 1 - (t - 9.6) / 0.5);
    const endO = Math.min(1, Math.max(0, (t - T_CARD) / 0.45));
    await page.evaluate(
      ([vb, ink, chip, chipO, endO]: [string, string, string, number, number]) => {
        document.getElementById('cam')!.setAttribute('viewBox', vb);
        document.getElementById('ink')!.innerHTML = ink;
        const c = document.getElementById('chip')!;
        c.textContent = chip;
        c.style.opacity = String(chipO);
        document.getElementById('end')!.style.opacity = String(endO);
      },
      [`${cam.x.toFixed(4)} ${cam.y.toFixed(4)} ${cam.w.toFixed(4)} ${cam.h.toFixed(4)}`, overlay(t), MONTHS_DE[monthAt(t) - 1], chipO, endO],
    );
    await page.screenshot({ path: framePath(frames, f) });
    if (f % 60 === 0) console.log(`frame ${f}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }

  // cover: close on the busiest part of the filled sheet, with the end line
  await page.evaluate(([vb, ink]: [string, string]) => {
    document.getElementById('cam')!.setAttribute('viewBox', vb);
    document.getElementById('ink')!.innerHTML = ink;
    document.getElementById('chip')!.style.opacity = '0';
    const e = document.getElementById('end')!;
    e.style.opacity = '1';
    (e.querySelector('.line') as HTMLElement).style.cssText = 'top:330px;';
    (e.querySelector('.wordmark') as HTMLElement).style.cssText = 'top:1420px;';
    e.insertAdjacentHTML('afterbegin', '<div style="position:absolute;left:90px;right:90px;top:300px;height:132px;border-radius:28px;background:rgba(247,244,249,.94)"></div><div style="position:absolute;left:300px;right:300px;top:1394px;height:96px;border-radius:999px;background:rgba(247,244,249,.94)"></div>');
  }, [`${(470 - 160).toFixed(2)} ${(395 - 284).toFixed(2)} 320 ${(320 / ASPECT).toFixed(2)}`, overlay(99)]);
  const coverPng = path.join(work, 'cover.png');
  await page.screenshot({ path: coverPng });
  await close();

  const video = path.join(out, 'R01-der-planer-lebt.mp4');
  const mb = encode(frames, video);
  cover(coverPng, path.join(out, 'R01-cover.jpg'));
  strip(video, path.join(out, 'R01-strip.png'));
  console.log(`${video} ${mb.toFixed(2)} MB, ${N} frames`);
})().catch((e) => { console.error(e); process.exit(1); });
