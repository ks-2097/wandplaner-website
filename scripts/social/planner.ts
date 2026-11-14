// The planner side of the social assets: demo specs, summer-holiday dates and the
// zoom regions, all taken from the engine itself (never redrawn).
import { MONTHS_DE, STATES, buildScene, measure, defaultSpec, fromDayNumber, iso, parseIso, plannerRange, renderSvg, schoolHolidays, toDayNumber, type LayoutId, type PlannerSpec, type Prim, type Scene, type StateCode } from '../../src/planner';

export type Key = { layout: LayoutId; edition: string; state: StateCode };
export const keyId = (k: Key) => `${k.layout}-${k.edition}-${k.state}`;

/** 2027 summer school holidays of a state, straight from data/school-holidays.json. */
export function summer2027(state: StateCode): { start: number; end: number } {
  const from = toDayNumber(2027, 1, 1);
  const to = toDayNumber(2027, 12, 31);
  const p = schoolHolidays(state, from, to).filter((h) => /^sommer/i.test(h.name));
  if (p.length !== 1) throw new Error(`expected one Sommerferien period for ${state} in 2027, got ${p.length}`);
  return { start: p[0].start, end: p[0].end };
}

const fmt = (n: number) => {
  const d = fromDayNumber(n);
  return `${d.d}.\u00a0${MONTHS_DE[d.m - 1]}`;
};

/** "Sommerferien 2027: 29. Juli bis 9. September" */
export const summerLine = (state: StateCode) => {
  const s = summer2027(state);
  return `Sommerferien 2027: ${fmt(s.start)} bis ${fmt(s.end)}`;
};

/**
 * The trip "Sommerurlaub": two weeks inside the state's 2027 summer holidays. In "wochen" a row
 * holds 28 days; the trip starts three days before a row ends, so its first run (with the arrow
 * head and the full label) is short enough for a readable zoom.
 */
export function tripFor(state: StateCode) {
  const s = summer2027(state);
  const from = toDayNumber(2027, 1, 1);
  let start = s.start + 10;
  for (let d = s.start + 3; d + 13 <= s.end; d++) if ((d - from) % 28 === 25) { start = d; break; }
  const end = start + 13;
  if (start < s.start || end > s.end) throw new Error(`trip for ${state} outside the summer holidays`);
  return { start: iso(fromDayNumber(start)), end: iso(fromDayNumber(end)), label: 'Sommerurlaub' };
}

export function demoSpec(k: Key): PlannerSpec {
  const spec = defaultSpec({ layout: k.layout, edition: k.edition, state: k.state, start: { year: 2027, month: 1 } });
  spec.birthdays = [
    { name: 'Oma Inge', day: 14, month: 3 },
    { name: 'Jonas', day: 1, month: 5 },
    { name: 'Mila', day: 22, month: 9 },
  ];
  spec.events = [tripFor(k.state)];
  return spec;
}

const cache = new Map<string, { scene: Scene; svg: string }>();
export function plannerFor(k: Key) {
  const id = keyId(k);
  if (!cache.has(id)) {
    const scene = buildScene(demoSpec(k));
    if (scene.notes.length) console.warn(id, scene.notes);
    cache.set(id, { scene, svg: renderSvg(scene) });
  }
  return cache.get(id)!;
}

export type Box = { x: number; y: number; w: number; h: number };
type Text = Extract<Prim, { k: 'text' }>;
const texts = (s: Scene) => s.prims.filter((p): p is Text => p.k === 'text');

/** Grow a box to a given aspect ratio (w/h) around its centre, then keep it on the sheet. */
function fit(b: Box, aspect: number, scene: Scene, minW: number): Box {
  let w = Math.max(b.w, minW);
  let h = Math.max(b.h, w / aspect);
  w = h * aspect;
  let x = b.x + b.w / 2 - w / 2;
  let y = b.y + b.h / 2 - h / 2;
  x = Math.min(Math.max(x, 0), scene.width - w);
  y = Math.min(Math.max(y, 0), scene.height - h);
  return { x, y, w, h };
}

/**
 * Zoom regions in mm, found from the scene primitives. `aspect` is the w/h of the window the
 * crop fills; `width` the crop width in mm (smaller = closer).
 */
export function region(k: Key, name: string, aspect: number, focus?: number): Box {
  const { scene } = plannerFor(k);
  const t = texts(scene);
  const spec = demoSpec(k);
  if (k.layout !== 'wochen') throw new Error('zoom regions are defined for "wochen"');
  // wochen geometry (from the engine's frame): grid at x 32.5, y 75.6, 935 × 590, 28 × 13
  const g = { x: 32.5, y: 75.6, w: 935, h: 590 };
  const cw = g.w / 28;
  const rh = g.h / 13;
  const { from } = plannerRange(spec);
  const cellOf = (n: number): Box => {
    const i = n - from;
    return { x: g.x + (i % 28) * cw, y: g.y + Math.floor(i / 28) * rh, w: cw, h: rh };
  };
  const accent = spec.design.colors.accent;
  const tris = scene.prims.filter((p): p is Extract<Prim, { k: 'tri' }> => p.k === 'tri' && p.fill === accent);
  const periodLines = scene.prims.filter((p): p is Extract<Prim, { k: 'lines' }> => p.k === 'lines' && p.stroke === accent && p.w === 0.3);
  /** Crop of exactly three cells (plus a hairline of the neighbours) around [x0, x1], vertically around row r. */
  const around = (x0: number, x1: number, r: number, _w?: number): Box => {
    const c0 = Math.min(Math.max(Math.round(((x0 + x1) / 2 - g.x) / cw - 1.5), 0), 25);
    const w = 3 * cw + 3;
    const h = w / aspect;
    const top = g.y + r * rh - (h - rh) * 0.4;
    return fit({ x: g.x + c0 * cw - 1.5, y: top, w, h }, aspect, scene, w);
  };
  const rowOf = (y: number) => Math.floor((y - g.y) / rh);
  /** A labelled period run: its label, line and the arrow heads on that line. */
  const runs = (re: RegExp) =>
    t.filter((p) => p.fill === accent && p.anchor === 'middle' && p.size < 3 && re.test(p.s)).map((l) => {
      const ly = l.y + 1.4;
      const line = periodLines.find((q) => q.segs.some((sg) => Math.abs(sg[1] - ly) < 0.01 && sg[0] <= l.x && sg[2] >= l.x));
      const seg = line?.segs.find((sg) => Math.abs(sg[1] - ly) < 0.01 && sg[0] <= l.x && sg[2] >= l.x);
      const heads = seg ? tris.filter((tr) => Math.abs(tr.pts[1] - ly) < 0.01 && tr.pts[0] >= seg[0] - 3 && tr.pts[0] <= seg[2] + 3) : [];
      return { l, seg, heads, x0: Math.min(seg?.[0] ?? l.x, ...heads.map((h) => h.pts[0])), x1: Math.max(seg?.[2] ?? l.x, ...heads.map((h) => h.pts[0])) };
    }).filter((r) => r.seg);
  switch (name) {
    case 'titel': {
      // The title's first word up to the "&", the weekday header and the first rows. The crop ends
      // in the gap after the "&" (measured with the engine's own font metrics), never mid-letter.
      const title = t.find((p) => p.size > 20)!;
      const amp = title.s.indexOf('&');
      const end = title.x + measure(title.s.slice(0, amp + 1), title.face, title.size, title.ls ?? 0);
      const x0 = title.x - 14;
      const w = end + 3 - x0;
      return fit({ x: x0, y: 10, w, h: w / aspect }, aspect, scene, w);
    }
    case 'monatswechsel': {
      // February and March both start mid-row in column 3: two stair steps above each other.
      const c = cellOf(toDayNumber(2027, 3, 1));
      const bar = scene.prims.find((p) => p.k === 'rect' && p.fill === accent && Math.abs(p.x - c.x) < 0.5 && Math.abs(p.y - c.y) < 0.5 && p.h > rh * 0.9);
      if (!bar) throw new Error('no stair bar at 1 March');
      const w = 3 * cw + 3;
      const h = w / aspect;
      // the crop ends just below the closing month line, so no digits of the next row peek in
      return fit({ x: c.x - cw - 1.5, y: c.y + rh + 1.6 - h, w, h }, aspect, scene, w);
    }
    case 'ferien': {
      if (focus !== undefined) {
        // A slide that names a date ("Am 2. August"): the holiday whose start arrow sits on that day.
        const c = cellOf(focus);
        const head = tris.find((tr) => tr.pts[2] > tr.pts[0] && tr.pts[0] >= c.x && tr.pts[0] < c.x + c.w && tr.pts[1] > c.y && tr.pts[1] < c.y + c.h);
        if (!head) throw new Error('no school holiday starts on the named day');
        return around(c.x - cw, c.x + 2 * cw, rowOf(c.y + 1));
      }
      // The shortest school-holiday run with both arrow heads and a real name (not a single Ferientag).
      const r = runs(/FERIEN/).filter((r) => r.heads.length === 2 && !/^FERIENTAG$/.test(r.l.s) && r.x1 - r.x0 < cw * 2.6).sort((a, b) => a.x1 - a.x0 - (b.x1 - b.x0))[0];
      if (!r) throw new Error('no short school-holiday run ' + JSON.stringify(runs(/FERIEN/).map((r) => [r.l.s, r.heads.length, r.x1 - r.x0])) + ' tris ' + tris.length + ' lines ' + periodLines.length);
      return around(r.x0, r.x1, rowOf(r.l.y), 100);
    }
    case 'geburtstag': {
      const label = t.find((p) => p.s === 'OMA INGE')!;
      const c = cellOf(toDayNumber(2027, 3, 14));
      if (!(label.x >= c.x && label.x < c.x + c.w)) throw new Error('birthday label not in its cell');
      return around(c.x, c.x + c.w, rowOf(c.y + 1), 84);
    }
    case 'reise': {
      const r = runs(/^SOMMERURLAUB$/).find((r) => r.heads.length >= 1 && r.heads.some((h) => h.pts[2] > h.pts[0]));
      if (!r) throw new Error('no trip start');
      return around(r.x0 - 2, r.x1 + 2, rowOf(r.l.y), 104);
    }
  }
  throw new Error(`unknown region ${name}`);
}

export const stateName = (s: StateCode) => STATES[s];
export { parseIso };
