import { describe, expect, it } from 'vitest';
import reference from '../data/public-holidays-reference.json';
import {
  EDITIONS, LAYOUTS, STATE_CODES, buildScene, contrast, defaultSpec, fromDayNumber, iso, parseIso, plannerRange,
  publicHolidays, renderSvg, sanitizeSpec, schoolHolidays, toDayNumber, weekday, type StateCode,
} from '../src/planner';
import { renderPdf } from '../src/planner/pdf';

describe('dates', () => {
  it('knows weekdays', () => {
    expect(weekday(toDayNumber(2026, 11, 1))).toBe(0); // Sunday
    expect(weekday(toDayNumber(2027, 1, 1))).toBe(5); // Friday
    expect(iso(fromDayNumber(parseIso('2028-02-29')))).toBe('2028-02-29');
  });
  it('covers 364 days in the weeks layout and 12 full months otherwise', () => {
    const w = plannerRange({ layout: 'wochen', start: { year: 2026, month: 11 } });
    expect(w.to - w.from + 1).toBe(364);
    expect(iso(fromDayNumber(w.to))).toBe('2027-10-30');
    const z = plannerRange({ layout: 'zeilen', start: { year: 2027, month: 1 } });
    expect(iso(fromDayNumber(z.to))).toBe('2027-12-31');
    const s = plannerRange({ layout: 'spalten', start: { year: 2027, month: 8 } });
    expect(s.to - s.from + 1).toBe(366); // includes 29 Feb 2028
  });
});

describe('public holidays', () => {
  // Every state, every date in the OpenHolidays snapshot (Oct 2026 – Mar 2028)
  const ref = (reference as { holidays: { date: string; name: string; states: string[] }[] }).holidays;
  for (const state of STATE_CODES) {
    it(`match the OpenHolidays reference for ${state}`, () => {
      const expected = ref.filter((h) => h.states.includes(state)).map((h) => h.date).sort();
      const from = parseIso('2026-10-01');
      const to = parseIso('2028-03-31');
      const ours: string[] = [];
      for (const y of [2026, 2027, 2028])
        for (const [day, mark] of publicHolidays(y, state)) if (mark.dayOff && day >= from && day <= to) ours.push(iso(fromDayNumber(day)));
      expect(ours.sort()).toEqual(expected);
    });
  }
  it('lets the customer decide on holidays that apply in only part of a state', () => {
    const aug15 = parseIso('2027-08-15');
    expect(publicHolidays(2027, 'BY').get(aug15)?.name).toBe('Mariä Himmelfahrt'); // on by default
    expect(publicHolidays(2027, 'BY', []).get(aug15)).toBeUndefined();
    expect(publicHolidays(2027, 'SL', []).get(aug15)?.dayOff).toBe(true); // statewide in Saarland
    expect(publicHolidays(2027, 'BY', ['friedensfest']).get(parseIso('2027-08-08'))?.name).toBe('Augsburger Friedensfest');
    expect(publicHolidays(2027, 'SN').get(parseIso('2027-05-27'))).toBeUndefined();
    expect(publicHolidays(2027, 'TH', ['fronleichnam']).get(parseIso('2027-05-27'))?.dayOff).toBe(true);
    // An option of another state is ignored, and the planner follows the choice.
    const spec = defaultSpec({ state: 'BY', layout: 'zeilen' });
    expect(spec.calendars.regional).toEqual(['mariae-himmelfahrt']);
    const labels = (s: typeof spec) => buildScene(sanitizeSpec(s)).prims.flatMap((p) => (p.k === 'text' ? [p.s] : []));
    expect(labels(spec)).toContain('MARIÄ HIMMELFAHRT');
    expect(labels({ ...spec, calendars: { ...spec.calendars, regional: ['fronleichnam'] } })).not.toContain('MARIÄ HIMMELFAHRT');
    // A draft saved before the option existed keeps the default.
    const old = structuredClone(spec);
    delete old.calendars.regional;
    expect(labels(old)).toContain('MARIÄ HIMMELFAHRT');
  });

  it('computes movable feasts for three years', () => {
    const name = (y: number, s: StateCode, d: string) => publicHolidays(y, s).get(parseIso(d))?.name;
    expect(name(2026, 'BE', '2026-04-03')).toBe('Karfreitag');
    expect(name(2027, 'BE', '2027-03-29')).toBe('Ostermontag');
    expect(name(2028, 'BY', '2028-06-15')).toBe('Fronleichnam');
    expect(name(2028, 'SN', '2028-11-22')).toBe('Buß- und Bettag');
    expect(name(2027, 'BE', '2027-03-08')).toBe('Internationaler Frauentag');
    expect(name(2027, 'HH', '2027-03-08')).toBeUndefined();
  });
});

describe('school holidays', () => {
  for (const state of STATE_CODES) {
    it(`has summer and Christmas holidays for ${state} in 2027`, () => {
      const all = schoolHolidays(state, parseIso('2027-01-01'), parseIso('2027-12-31'));
      expect(all.some((p) => p.label === 'SOMMERFERIEN' && p.end - p.start >= 35)).toBe(true);
      expect(all.filter((p) => p.label === 'WEIHNACHTSFERIEN').length).toBeGreaterThanOrEqual(1);
      for (const p of all) expect(p.end).toBeGreaterThanOrEqual(p.start);
    });
  }
  it('uses the dates of the first edition for Berlin', () => {
    const be = schoolHolidays('BE', parseIso('2026-11-01'), parseIso('2027-10-30')).map((p) => `${iso(fromDayNumber(p.start))}/${iso(fromDayNumber(p.end))}`);
    expect(be).toContain('2026-12-23/2027-01-02');
    expect(be).toContain('2027-07-01/2027-08-14');
  });
});

describe('layout engine', () => {
  for (const layout of LAYOUTS)
    for (const state of ['BE', 'BY', 'MV'] as StateCode[])
      it(`draws every day once: ${layout.id} / ${state}`, () => {
        const spec = defaultSpec({ layout: layout.id, state, start: { year: 2027, month: 1 } });
        const scene = buildScene(spec);
        const numbers = scene.prims.filter((p) => p.k === 'text' && /^\d\d$/.test(p.s) && p.size > 5);
        const days = scene.to - scene.from + 1;
        // "wochen" writes the month name instead of "01"
        expect(numbers.length).toBe(layout.id === 'wochen' ? days - 12 : days);
        for (const p of scene.prims)
          if (p.k === 'text') {
            expect(p.x).toBeGreaterThan(20);
            expect(p.x).toBeLessThan(scene.width - 20);
            expect(p.y).toBeGreaterThan(20);
            expect(p.y).toBeLessThan(scene.height - 20);
          }
        expect(scene.notes).toEqual([]);
      });

  it('keeps one weekday per column in the weeks layout', () => {
    const scene = buildScene(defaultSpec({ start: { year: 2026, month: 12 } }));
    const header = scene.prims.filter((p) => p.k === 'text' && p.size === 2.6).map((p) => (p.k === 'text' ? p.s : ''));
    expect(header.length).toBe(28);
    expect(header.slice(0, 7)).toEqual(['DI', 'MI', 'DO', 'FR', 'SA', 'SO', 'MO']);
    expect(header.slice(7, 14)).toEqual(header.slice(0, 7));
  });

  it('keeps month lines inside the cells: below the top edge, right of the left edge', () => {
    const spec = defaultSpec({ start: { year: 2027, month: 1 } });
    const scene = buildScene(spec);
    const w = spec.design.lines.month;
    const bars = scene.prims.filter((p) => p.k === 'rect' && p.fill === spec.design.colors.accent && p.o === undefined);
    const [gx, gy, cw, rh] = [32.5, 75.6, 935 / 28, 590 / 13];
    // 1 February 2027 is day 31: row 1, column 3
    const [x, y] = [gx + 3 * cw, gy + rh];
    const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
    // the vertical bar starts exactly at the cell's left edge, the horizontal one at its top edge
    expect(bars.some((b) => b.k === 'rect' && near(b.x, x) && near(b.y, y) && near(b.w, w) && near(b.h, rh))).toBe(true);
    expect(bars.some((b) => b.k === 'rect' && near(b.x, x) && near(b.y, y) && near(b.h, w) && b.w > cw)).toBe(true);
    // nothing sticks out of the grid
    for (const layout of LAYOUTS) {
      const s2 = buildScene(defaultSpec({ layout: layout.id }));
      for (const b of s2.prims)
        if (b.k === 'rect' && b.o === undefined) {
          expect(b.x).toBeGreaterThanOrEqual(32.5 - 0.01);
          expect(b.x + b.w).toBeLessThanOrEqual(s2.width - 32.5 + 0.01);
          expect(b.y + b.h).toBeLessThanOrEqual(s2.height - 34.3);
        }
    }
  });

  it('draws thick lines only where a month starts, with no frame around the sheet', () => {
    const rects = (spec: ReturnType<typeof defaultSpec>) =>
      buildScene(spec).prims.flatMap((p) => (p.k === 'rect' && p.fill === spec.design.colors.accent && p.o === undefined ? [p] : []));
    const lw = defaultSpec().design.lines.month;
    const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
    const [gx, gy, rh] = [32.5, 75.6, 590 / 13];

    // wochen: no bar on the sheet's right edge, none along the top, and none on the left
    // edge of a row that does not begin with a month (row 1 starts with 29 Nov).
    const w = rects(defaultSpec({ start: { year: 2026, month: 11 } }));
    expect(w.some((b) => near(b.x + b.w, 32.5 + 935) && b.h > 20)).toBe(false);
    expect(w.some((b) => near(b.y, gy) && b.w > 100)).toBe(false);
    expect(w.some((b) => near(b.x, gx) && near(b.y, gy + rh) && b.h > b.w)).toBe(false);
    expect(w.some((b) => near(b.x, gx + 28 * 0 + (935 / 28) * 2) && near(b.y, gy + rh) && b.h > b.w)).toBe(true); // 1 Dec

    // The inward corner of the stair: January starts at row 2, column 5, so the bar along the top
    // of row 3 (cols 0-4) ends at the foot of the vertical bar. It sits above the grid line, and
    // nothing pokes into the cell below.
    const [cw, y3, x5] = [935 / 28, gy + 3 * rh, gx + 5 * (935 / 28)];
    expect(w.some((b) => b.w > b.h && near(b.y + b.h, y3) && near(b.x + b.w, x5) && near(b.x, gx))).toBe(true);
    expect(w.some((b) => near(b.y, y3) && b.x < x5 && near(b.x + b.w, x5 + lw))).toBe(false);
    // the outward corner of the stair (1 December, row 1, column 2) stays inside the cells below
    expect(w.some((b) => b.w > b.h && near(b.y, gy + rh) && near(b.x, gx + 2 * cw))).toBe(true);

    // zeilen: one vertical bar per month at the left, a top bar for months 2-12, nothing at the bottom
    const z = rects(defaultSpec({ layout: 'zeilen' }));
    expect(z.filter((b) => b.h > b.w && near(b.x, gx)).length).toBe(12);
    expect(z.filter((b) => b.w > b.h).length).toBe(11);
    expect(z.some((b) => b.w > b.h && near(b.y + b.h, 72 + 593.6))).toBe(false); // no line closing the bottom

    // spalten: one vertical bar per month, nothing horizontal, nothing on the right edge
    const s = rects(defaultSpec({ layout: 'spalten' }));
    expect(s.length).toBe(12);
    expect(s.every((b) => b.h > b.w && near(b.w, lw))).toBe(true);
    expect(s.some((b) => near(b.x + b.w, 32.5 + 635))).toBe(false);
  });

  it('places birthdays, events and a second state', () => {
    const spec = defaultSpec({ start: { year: 2027, month: 1 } });
    spec.birthdays = [{ name: 'Oma Inge', day: 14, month: 3 }, { name: 'Schalttag', day: 29, month: 2 }];
    spec.events = [{ start: '2027-06-05', end: '2027-06-19', label: 'Costa Rica' }, { start: '2027-02-13', label: 'Heimspiel' }];
    spec.calendars.school = ['BE', 'BY'];
    const texts = buildScene(sanitizeSpec(spec)).prims.flatMap((p) => (p.k === 'text' ? [p.s] : []));
    expect(texts).toContain('OMA INGE');
    expect(texts).toContain('SCHALTTAG');
    expect(texts).toContain('HEIMSPIEL');
    expect(texts).toContain('COSTA RICA');
    expect(texts).toContain('SOMMERFERIEN BY');
  });

  it('reports what does not fit', () => {
    const spec = defaultSpec();
    spec.birthdays = ['A', 'B', 'C', 'D'].map((name) => ({ name, day: 5, month: 5 }));
    expect(buildScene(spec).notes.join(' ')).toContain('Nicht gedruckt: D');
  });

  it('renders SVG without unescaped text', () => {
    const spec = defaultSpec();
    spec.design.title.text = 'müller & <söhne>';
    const svg = renderSvg(buildScene(spec));
    expect(svg).toContain('müller &amp; &lt;söhne&gt;');
    expect(svg.startsWith('<svg')).toBe(true);
  });
});

describe('guardrails', () => {
  it('repairs illegible colours', () => {
    const spec = defaultSpec();
    spec.design.colors = { paper: '#ffffff', ink: '#dddddd', accent: '#ffee88' };
    const fixed = sanitizeSpec(spec).design.colors;
    expect(contrast(fixed.ink, fixed.paper)).toBeGreaterThanOrEqual(7);
    expect(contrast(fixed.accent, fixed.paper)).toBeGreaterThanOrEqual(4.5);
  });
  it('rejects a malformed spec', () => {
    expect(() => sanitizeSpec({ ...defaultSpec(), state: 'XX' })).toThrow();
    expect(() => sanitizeSpec({ ...defaultSpec(), layout: 'kreis' })).toThrow();
  });
  it('ships editions that pass the contrast check', () => {
    for (const e of EDITIONS) {
      expect(contrast(e.ink, e.paper)).toBeGreaterThanOrEqual(7);
      expect(contrast(e.accent, e.paper)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('print file', () => {
  it('is a PDF at trim size plus 3 mm bleed with embedded fonts', async () => {
    for (const layout of LAYOUTS) {
      const scene = buildScene(defaultSpec({ layout: layout.id }));
      const pdf = await renderPdf(scene);
      const text = pdf.toString('latin1');
      expect(text.startsWith('%PDF-')).toBe(true);
      const mm = 72 / 25.4;
      const media = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text)!;
      expect(Number(media[1])).toBeCloseTo((scene.width + 6) * mm, 1);
      expect(Number(media[2])).toBeCloseTo((scene.height + 6) * mm, 1);
      expect(text).toMatch(/\/TrimBox \[/);
      expect(text).toMatch(/\/BleedBox \[/);
      expect(text).toMatch(/\/FontFile2/);
      expect(text).toMatch(/Poppins/);
    }
  });
});
