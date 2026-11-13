import { MONTHS_DE, WEEKDAYS_DE, fromDayNumber, isLeapYear, parseIso, toDayNumber, weekday } from './dates';
import { capHeight, face, measure, truncate, type Face } from './fonts';
import { publicHolidays, schoolHolidays, type DayMark } from './holidays';
import type { LayoutId, PlannerSpec } from './spec';

/**
 * The layout engine: design spec + dates → a flat list of drawing primitives in mm.
 * The SVG preview and the print PDF are both rendered from this one list, so what the
 * customer signs off is what gets printed.
 *
 * Three base layouts share one renderer. A layout only decides where each day's cell
 * sits ("frame"); colours, type, labels, calendars and birthdays work the same in all.
 */

export type Prim =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string; o?: number }
  | { k: 'lines'; segs: Seg[]; stroke: string; w: number; o?: number; cap: 'butt' | 'square' }
  | { k: 'tri'; pts: [number, number, number, number, number, number]; fill: string }
  | { k: 'text'; x: number; y: number; s: string; face: Face; size: number; fill: string; o?: number; anchor?: 'start' | 'middle' | 'end'; ls?: number };

type Seg = [number, number, number, number];

export type Scene = {
  /** Trim size in mm */
  width: number;
  height: number;
  paper: string;
  prims: Prim[];
  /** First and last day shown, as day numbers */
  from: number;
  to: number;
  /** Things the customer should know about, e.g. a birthday that did not fit */
  notes: string[];
};

export const LAYOUTS: { id: LayoutId; name: string; summary: string; orientation: 'quer' | 'hoch' }[] = [
  { id: 'wochen', name: 'Vier Wochen', summary: '13 Reihen mit je vier Wochen. Jeder Wochentag steht immer in derselben Spalte, die Monate laufen als Treppe durch das Blatt.', orientation: 'quer' },
  { id: 'zeilen', name: 'Monatszeilen', summary: 'Zwölf Zeilen, eine pro Monat, die Tage von 1 bis 31 nebeneinander. Der klassische Jahresplaner im Querformat.', orientation: 'quer' },
  { id: 'spalten', name: 'Monatsspalten', summary: 'Zwölf Spalten, eine pro Monat, die Tage untereinander. Im Hochformat, mit Platz für Notizen neben jedem Tag.', orientation: 'hoch' },
];

export const MAX_BIRTHDAYS_PER_DAY = 3;
export const MAX_LANES = 4;

// Shared measures, in mm. The values of "wochen" come from the original edition.
const M = {
  margin: 32.5,
  titleBaseline: 58.75,
  titleSize: 31,
  padX: 2.4,
  numberSize: 6.4,
  numberBaseline: 6.75,
  monthSize: 4.8,
  monthPitch: 5.0,
  labelSize: 2.0,
  labelLs: 0.12,
  labelPitch: 3.1,
  yearSize: 3.4,
  tripInset: 3,
  tripWidth: 0.3,
  lanePitch: 4.6,
  arrowLen: 2.1,
  arrowHalf: 0.8,
};

type Day = { n: number; y: number; m: number; d: number; wd: number; mark?: DayMark; off: boolean };

type Cell = {
  /** Index into the days array */
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Days in the same group sit next to each other in reading order (a row or a column) */
  group: number;
};

type Frame = {
  sheet: { w: number; h: number };
  dayCount: number;
  /** Direction in which consecutive days of a group follow each other */
  dir: 'h' | 'v';
  cells: Cell[];
  thin: Seg[];
  /** Month-start lines as centre lines; drawn thin when the design has no month line. There is no frame. */
  thick: Seg[];
  /**
   * The same lines as bars [x, y, w, h] of the month line's width. A bar never straddles
   * a grid line: a horizontal one hangs below it, inside the top of the cells it opens,
   * and a vertical one stands to its right, inside the left edge of the month's first cell.
   * The closing edges of the sheet (bottom, right) sit inside the grid too.
   */
  bars: Seg[];
  /** Month names, weekday headers and other fixed lettering */
  extras: Prim[];
  /** Where things sit inside a cell, relative to its top-left corner */
  cell: {
    labelX: number;
    labelBaseline: number;
    maxLabels: number;
    labelRight: number;
    /** Weekday initial inside the cell, for layouts without a weekday header */
    weekday?: { x: number; y: number };
    /** "wochen" writes the month name into the cell of the 1st */
    monthInCell: boolean;
  };
};

type Ctx = { spec: PlannerSpec; days: Day[]; from: number; body: (w: number) => Face; labelFace: Face; labelSize: number; labelLs: number };

export function plannerRange(spec: Pick<PlannerSpec, 'layout' | 'start'>): { from: number; to: number } {
  const from = toDayNumber(spec.start.year, spec.start.month, 1);
  if (spec.layout === 'wochen') return { from, to: from + 363 };
  return { from, to: toDayNumber(spec.start.year + 1, spec.start.month, 1) - 1 };
}

export function buildScene(spec: PlannerSpec): Scene {
  const d = spec.design;
  const { paper, ink, accent } = d.colors;
  const prims: Prim[] = [];
  const notes: string[] = [];
  const { from, to } = plannerRange(spec);

  const body = (w: number) => face(d.bodyFont, w);
  const labelFace = body(500);
  const mono = d.bodyFont === 'spacemono';
  const labelLs = mono ? 0.02 : M.labelLs;
  const labelSize = mono ? M.labelSize * 0.92 : M.labelSize;

  // ---- Day data
  const marks = new Map<number, DayMark>();
  if (spec.calendars.publicHolidays)
    for (let y = fromDayNumber(from).y; y <= fromDayNumber(to).y; y++) for (const [day, m] of publicHolidays(y, spec.state, spec.calendars.regional)) marks.set(day, m);
  const days: Day[] = Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i;
    const wd = weekday(n);
    const mark = marks.get(n);
    return { n, ...fromDayNumber(n), wd, mark, off: wd === 0 || wd === 6 || !!mark?.dayOff };
  });

  const ctx: Ctx = { spec, days, from, body, labelFace, labelSize, labelLs };
  const frame = spec.layout === 'zeilen' ? frameZeilen(ctx) : spec.layout === 'spalten' ? frameSpalten(ctx) : frameWochen(ctx);
  const { sheet } = frame;
  const contentW = sheet.w - 2 * M.margin;

  // ---- Shading of weekends and public holidays
  if (d.shading > 0) for (const c of frame.cells) if (days[c.i].off) prims.push({ k: 'rect', x: c.x, y: c.y, w: c.w, h: c.h, fill: accent, o: d.shading });

  // ---- Grid and month lines
  prims.push({ k: 'lines', segs: frame.thin, stroke: ink, w: d.lines.grid, o: d.lines.gridOpacity, cap: 'butt' });
  if (d.lines.month > 0) for (const [x, y, w, h] of frame.bars) prims.push({ k: 'rect', x: round(x), y: round(y), w: round(w), h: round(h), fill: accent });
  else prims.push({ k: 'lines', segs: frame.thick, stroke: ink, w: d.lines.grid, o: d.lines.gridOpacity, cap: 'square' });

  // ---- Title
  const titleFace = face(d.title.font, 700);
  const raw = d.title.text;
  const titleText = d.title.case === 'lower' ? raw.toLocaleLowerCase('de-DE') : d.title.case === 'upper' ? raw.toLocaleUpperCase('de-DE') : raw;
  const titleLs = d.title.font === 'poppins' ? -0.01 : 0;
  // Keep the title between the top edge and the grid whatever the typeface.
  const maxByHeight = (M.titleBaseline - 22) / Math.max(capHeight(titleFace), 0.6);
  let titleSize = Math.min(M.titleSize * d.title.scale, maxByHeight);
  const titleWidth = measure(titleText, titleFace, 1, titleLs);
  if (titleWidth * titleSize > contentW) titleSize = contentW / titleWidth;
  const titleX = d.title.align === 'left' ? M.margin : d.title.align === 'center' ? sheet.w / 2 : sheet.w - M.margin;
  prims.push({
    k: 'text', x: titleX, y: M.titleBaseline, s: titleText, face: titleFace, size: round(titleSize), fill: accent,
    anchor: d.title.align === 'left' ? 'start' : d.title.align === 'center' ? 'middle' : 'end', ls: titleLs,
  });

  prims.push(...frame.extras);

  // ---- Birthdays by day
  const birthdays = new Map<number, string[]>();
  for (const b of spec.birthdays) {
    let placed = false;
    for (let y = fromDayNumber(from).y; y <= fromDayNumber(to).y; y++) {
      // 29 February moves to the 28th in a year without one
      const day = b.month === 2 && b.day === 29 && !isLeapYear(y) ? 28 : b.day;
      const n = toDayNumber(y, b.month, day);
      if (n < from || n > to) continue;
      birthdays.set(n, [...(birthdays.get(n) ?? []), b.name]);
      placed = true;
    }
    if (!placed) notes.push(`${b.name} (${b.day}.${b.month}.) liegt außerhalb dieses Planers.`);
  }

  // ---- Added calendars: single days become labels in the cell, longer entries become lines
  const dayEvents = new Map<number, string[]>();
  const ranges: { start: number; end: number; label: string }[] = [];
  for (const e of spec.events) {
    const start = parseIso(e.start);
    const end = e.end ? parseIso(e.end) : start;
    if (end < from || start > to) continue;
    if (end === start) dayEvents.set(start, [...(dayEvents.get(start) ?? []), e.label]);
    else ranges.push({ start, end, label: e.label.toLocaleUpperCase('de-DE') });
  }
  const school = spec.calendars.school.flatMap((st) =>
    schoolHolidays(st, from, to).map((p) => ({ start: p.start, end: p.end, label: spec.calendars.school.length > 1 ? `${p.label} ${st}` : p.label })),
  );
  const schoolDay = (n: number) => school.some((p) => p.start <= n && n <= p.end);
  const periods = (d.schoolHolidays === 'none' ? ranges : [...school, ...ranges]).sort((p, q) => p.start - q.start || q.end - p.end);

  // ---- Cells: number or month name, holiday label, calendar entries, birthdays
  const numberFace = body(d.numbers.weight);
  const numberSize = M.numberSize * d.numbers.scale;
  const grow = (numberSize - M.numberSize) * capHeight(numberFace);
  const numberBaseline = M.numberBaseline + grow;
  const monthFace = body(700);
  const numberText = (day: Day) => (d.numbers.zeroPad ? String(day.d).padStart(2, '0') : String(day.d));

  for (const c of frame.cells) {
    const day = days[c.i];
    const color = day.off ? accent : ink;
    const monthHere = frame.cell.monthInCell && day.d === 1;
    const vertical = monthHere && d.monthLabel === 'vertical';
    let labelX = c.x + frame.cell.labelX;
    let slot = 0;

    if (monthHere) {
      const name = MONTHS_DE[day.m - 1].toLocaleUpperCase('de-DE');
      const showYear = day.m === 1 || c.i === 0;
      if (vertical) {
        const pitch = Math.min(M.monthPitch, 37 / (name.length - 1));
        [...name].forEach((ch, j) => prims.push({ k: 'text', x: c.x + M.padX + 2.0, y: c.y + 6.25 + j * pitch, s: ch, face: monthFace, size: M.monthSize, fill: accent, anchor: 'middle' }));
        labelX = c.x + M.padX + 6.4;
        if (showYear) prims.push({ k: 'text', x: c.x + c.w - M.padX, y: c.y + 6.0, s: String(day.y), face: body(400), size: M.yearSize, fill: accent, anchor: 'end' });
      } else {
        prims.push({ k: 'text', x: c.x + M.padX, y: c.y + 6.25, s: truncate(name, monthFace, 3.6, 0.06, c.w - 2 * M.padX), face: monthFace, size: 3.6, fill: accent, ls: 0.06 });
        if (showYear) {
          prims.push({ k: 'text', x: c.x + M.padX, y: c.y + 10.6, s: String(day.y), face: body(400), size: M.yearSize, fill: accent });
          slot = 1;
        }
      }
    } else {
      prims.push({ k: 'text', x: c.x + M.padX, y: c.y + numberBaseline, s: numberText(day), face: numberFace, size: round(numberSize), fill: color });
      if (d.schoolHolidays === 'underline' && schoolDay(day.n)) {
        const w = measure(numberText(day), numberFace, numberSize);
        prims.push({ k: 'lines', segs: [[c.x + M.padX, c.y + numberBaseline + 1.3, c.x + M.padX + w, c.y + numberBaseline + 1.3]], stroke: accent, w: 0.45, cap: 'butt' });
      }
    }
    if (frame.cell.weekday)
      prims.push({ k: 'text', x: c.x + frame.cell.weekday.x, y: c.y + frame.cell.weekday.y + (frame.dir === 'v' ? grow : 0), s: WEEKDAYS_DE[day.wd], face: labelFace, size: labelSize, fill: color, o: day.off ? 1 : 0.65, ls: labelLs, anchor: frame.dir === 'h' ? 'end' : 'start' });

    const baseline = (s: number) => c.y + frame.cell.labelBaseline + (frame.dir === 'h' ? grow * 1.3 : 0) + s * M.labelPitch;
    const maxW = c.x + c.w - frame.cell.labelRight - labelX;
    const lines: { s: string; fill: string; o?: number }[] = [];
    if (day.mark) {
      if (vertical) {
        // Next to the vertical month name the label sits low in the cell, as on the original.
        prims.push({ k: 'text', x: c.x + c.w - M.padX, y: c.y + 37, s: day.mark.label, face: labelFace, size: labelSize, fill: day.mark.dayOff ? accent : ink, o: day.mark.dayOff ? 1 : 0.8, anchor: 'end', ls: labelLs });
      } else lines.push({ s: day.mark.label, fill: day.mark.dayOff ? accent : ink, o: day.mark.dayOff ? 1 : 0.8 });
    }
    for (const s of dayEvents.get(day.n) ?? []) lines.push({ s: s.toLocaleUpperCase('de-DE'), fill: accent });
    const names = birthdays.get(day.n) ?? [];
    for (const s of names.slice(0, MAX_BIRTHDAYS_PER_DAY)) lines.push({ s: s.toLocaleUpperCase('de-DE'), fill: ink });
    if (names.length > MAX_BIRTHDAYS_PER_DAY) notes.push(`Am ${day.d}.${day.m}. passen nur ${MAX_BIRTHDAYS_PER_DAY} Geburtstage in das Feld. Nicht gedruckt: ${names.slice(MAX_BIRTHDAYS_PER_DAY).join(', ')}.`);
    const room = frame.cell.maxLabels - slot;
    if (lines.length > room) notes.push(`Am ${day.d}.${day.m}. passen nicht alle Einträge in das Feld. Nicht gedruckt: ${lines.slice(room).map((l) => l.s).join(', ')}.`);
    lines.slice(0, room).forEach((line, j) =>
      prims.push({ k: 'text', x: labelX, y: baseline(slot + j), s: truncate(line.s, labelFace, labelSize, labelLs, maxW), face: labelFace, size: labelSize, fill: line.fill, o: line.o, ls: labelLs }),
    );
  }

  // ---- School holidays and other periods: one line per run of neighbouring cells
  const cellOf = new Map<number, Cell>(frame.cells.map((c) => [c.i, c]));
  const laneEnds = new Map<number, number[]>();
  const laneFor = (group: number, a: number, b: number): number => {
    const ends = laneEnds.get(group) ?? [];
    let lane = ends.findIndex((end) => end < a);
    if (lane < 0) lane = ends.length;
    ends[lane] = b;
    laneEnds.set(group, ends);
    return lane;
  };
  let dropped = 0;

  for (const p of periods) {
    const a = Math.max(p.start, from) - from;
    const b = Math.min(p.end, to) - from;
    let i = a;
    while (i <= b) {
      const first = cellOf.get(i)!;
      let j = i;
      while (j < b && cellOf.get(j + 1)!.group === first.group) j++;
      const last = cellOf.get(j)!;
      const startsHere = i === a && p.start >= from;
      const endsHere = j === b && p.end <= to;
      const lane = laneFor(first.group, i, j);
      i = j + 1;
      if (lane >= MAX_LANES) {
        dropped++;
        continue;
      }
      const off = lane * M.lanePitch;

      if (frame.dir === 'h') {
        const top = first.y - off;
        const h = first.h;
        const x0 = first.x + (startsHere ? M.tripInset : 0);
        const x1 = last.x + last.w - (endsHere ? M.tripInset : 0);
        const label = truncate(p.label, labelFace, labelSize, labelLs, Math.max(x1 - x0 - 1, first.w - 2 * M.padX));
        if (d.schoolHolidays === 'band') {
          // The band ends exactly on the grid line, so it meets the month line below without a gap.
          prims.push({ k: 'rect', x: first.x, y: top + h - 2.2, w: last.x + last.w - first.x, h: 2.2, fill: accent, o: 0.32 });
          prims.push({ k: 'text', x: (first.x + last.x + last.w) / 2, y: top + h - 3.4, s: label, face: labelFace, size: labelSize, fill: accent, anchor: 'middle', ls: labelLs });
        } else if (d.schoolHolidays === 'underline' && school.some((s) => s.start === p.start && s.end === p.end && s.label === p.label)) {
          prims.push({ k: 'text', x: first.x + M.padX, y: top + h - 5, s: truncate(p.label, labelFace, labelSize, labelLs, last.x + last.w - first.x - 2 * M.padX), face: labelFace, size: labelSize, fill: accent, ls: labelLs });
        } else {
          const ly = top + h - 5;
          prims.push({ k: 'lines', segs: [[x0 + (startsHere ? M.arrowLen * 0.6 : 0), ly, x1 - (endsHere ? M.arrowLen * 0.6 : 0), ly]], stroke: accent, w: M.tripWidth, cap: 'butt' });
          if (startsHere) prims.push({ k: 'tri', pts: [x0, ly, x0 + M.arrowLen, ly - M.arrowHalf, x0 + M.arrowLen, ly + M.arrowHalf], fill: accent });
          if (endsHere) prims.push({ k: 'tri', pts: [x1, ly, x1 - M.arrowLen, ly - M.arrowHalf, x1 - M.arrowLen, ly + M.arrowHalf], fill: accent });
          prims.push({ k: 'text', x: (x0 + x1) / 2, y: ly - 1.4, s: label, face: labelFace, size: labelSize, fill: accent, anchor: 'middle', ls: labelLs });
        }
      } else {
        // Days run downwards: the line runs down the right side of the cells.
        // The band stands flush against the right edge of its cells; the arrow line keeps its distance.
        const lx = first.x + first.w - (d.schoolHolidays === 'band' ? 1.1 : 3.2) - off;
        const y0 = first.y + (startsHere ? M.tripInset : 0);
        const y1 = last.y + last.h - (endsHere ? M.tripInset : 0);
        const label = truncate(p.label, labelFace, labelSize, labelLs, first.w - frame.cell.labelX - 6 - off);
        if (d.schoolHolidays === 'band') {
          prims.push({ k: 'rect', x: lx - 1.1, y: first.y, w: 2.2, h: last.y + last.h - first.y, fill: accent, o: 0.32 });
        } else if (d.schoolHolidays === 'underline' && school.some((s) => s.start === p.start && s.end === p.end && s.label === p.label)) {
          // the numbers are underlined; only the label is needed
        } else {
          prims.push({ k: 'lines', segs: [[lx, y0 + (startsHere ? M.arrowLen * 0.6 : 0), lx, y1 - (endsHere ? M.arrowLen * 0.6 : 0)]], stroke: accent, w: M.tripWidth, cap: 'butt' });
          if (startsHere) prims.push({ k: 'tri', pts: [lx, y0, lx - M.arrowHalf, y0 + M.arrowLen, lx + M.arrowHalf, y0 + M.arrowLen], fill: accent });
          if (endsHere) prims.push({ k: 'tri', pts: [lx, y1, lx - M.arrowHalf, y1 - M.arrowLen, lx + M.arrowHalf, y1 - M.arrowLen], fill: accent });
        }
        prims.push({ k: 'text', x: lx - 1.6, y: first.y + first.h - 2.4 - lane * M.labelPitch, s: label, face: labelFace, size: labelSize, fill: accent, anchor: 'end', ls: labelLs });
      }
    }
  }
  if (dropped) notes.push('An einigen Stellen überschneiden sich mehr als vier Zeiträume. Nicht alle Linien werden gedruckt.');

  return { width: sheet.w, height: sheet.h, paper, prims, from, to, notes: [...new Set(notes)] };
}

// ---------------------------------------------------------------------------------------
// Layout "wochen": 13 rows × 28 days, the original. Every column is one weekday.

function frameWochen({ spec, days, body, labelFace, labelLs }: Ctx): Frame {
  const sheet = { w: 1000, h: 700 };
  const COLS = 28;
  const ROWS = 13;
  const g = { x: M.margin, y: 75.6, w: 935, h: 590 };
  const cw = g.w / COLS;
  const rh = g.h / ROWS;
  const { ink } = spec.design.colors;

  const cells: Cell[] = days.map((_, i) => ({ i, x: g.x + (i % COLS) * cw, y: g.y + Math.floor(i / COLS) * rh, w: cw, h: rh, group: Math.floor(i / COLS) }));

  const thin: Seg[] = [];
  for (let c = 1; c < COLS; c++) thin.push([g.x + c * cw, g.y, g.x + c * cw, g.y + g.h]);
  for (let r = 1; r < ROWS; r++) thin.push([g.x, g.y + r * rh, g.x + g.w, g.y + r * rh]);

  // A thick edge wherever two neighbouring cells belong to different months. There is no
  // frame around the sheet: thick lines appear only where a month starts.
  const thick: Seg[] = [];
  const lw = spec.design.lines.month;
  const right = g.x + g.w;
  const bars: Seg[] = [];
  if (spec.design.lines.month > 0) {
    for (let r = 1; r < ROWS; r++) {
      let run = -1;
      for (let c = 0; c <= COLS; c++) {
        const differs = c < COLS && days[(r - 1) * COLS + c].m !== days[r * COLS + c].m;
        if (differs && run < 0) run = c;
        if (!differs && run >= 0) {
          thick.push([g.x + run * cw, g.y + r * rh, g.x + c * cw, g.y + r * rh]);
          // Normally the bar hangs below the grid line, inside the top of the month's cells. Where
          // the run ends at the foot of a vertical month-start bar (the inward corner of the stair),
          // it sits above the line instead, inside the bottom of the previous month's cells. Both
          // bars then end on the same grid line and the corner no longer pokes into a cell.
          const endsAtVertical = c < COLS && days[(r - 1) * COLS + c - 1].m !== days[(r - 1) * COLS + c].m;
          const x0 = g.x + run * cw;
          bars.push([x0, g.y + r * rh - (endsAtVertical ? lw : 0), g.x + c * cw - x0, lw]);
          run = -1;
        }
      }
    }
    for (let r = 0; r < ROWS; r++)
      for (let c = 1; c < COLS; c++)
        if (days[r * COLS + c - 1].m !== days[r * COLS + c].m) {
          thick.push([g.x + c * cw, g.y + r * rh, g.x + c * cw, g.y + (r + 1) * rh]);
          bars.push([g.x + c * cw, g.y + r * rh, lw, rh]);
        }
  }

  const extras: Prim[] = [];
  if (spec.design.weekdays)
    for (let c = 0; c < COLS; c++) extras.push({ k: 'text', x: g.x + c * cw + M.padX - 0.3, y: 72.9, s: WEEKDAYS_DE[days[c].wd], face: labelFace, size: 2.6, fill: ink, o: 0.65, ls: labelLs });
  void body;

  return { sheet, dayCount: 364, dir: 'h', cells, thin, thick, bars, extras, cell: { labelX: M.padX, labelBaseline: 11.5, maxLabels: 5, labelRight: M.padX, monthInCell: true } };
}

// ---------------------------------------------------------------------------------------
// Layout "zeilen": twelve rows, one month each, days 1–31 side by side. Landscape.

function frameZeilen({ spec, days, body, labelLs }: Ctx): Frame {
  const sheet = { w: 1000, h: 700 };
  const gutter = 27;
  const g = { x: M.margin, y: 72, w: 935, h: 593.6 };
  const cw = (g.w - gutter) / 31;
  const rh = g.h / 12;
  const { accent } = spec.design.colors;
  const x0 = g.x + gutter;

  const months = monthsOf(days);
  const cells: Cell[] = [];
  const thin: Seg[] = [];
  const thick: Seg[] = [];
  const lw = spec.design.lines.month;
  const bars: Seg[] = [];
  const extras: Prim[] = [];

  months.forEach((mo, r) => {
    const top = g.y + r * rh;
    const right = x0 + mo.len * cw;
    for (let k = 0; k < mo.len; k++) cells.push({ i: mo.first + k, x: x0 + k * cw, y: top, w: cw, h: rh, group: r });
    for (let k = 0; k < mo.len; k++) thin.push([x0 + k * cw, top, x0 + k * cw, top + rh]);
    // A month starts at the left of its row: a line stands inside the left edge of the first cell,
    // and a line runs inside the top of the row where it follows another month. Nothing closes
    // the row at its right end or at the bottom of the sheet.
    thick.push([g.x, top, g.x, top + rh]);
    bars.push([g.x, top, lw, rh]);
    if (r > 0) {
      thick.push([g.x, top, right, top]);
      bars.push([g.x, top, right - g.x, lw]);
    }
    extras.push({ k: 'text', x: g.x + M.padX, y: top + 6.4, s: MONTHS_DE[mo.m - 1].toLocaleUpperCase('de-DE'), face: body(700), size: 3.3, fill: accent, ls: 0.05 });
    if (mo.m === 1 || r === 0) extras.push({ k: 'text', x: g.x + M.padX, y: top + 11, s: String(mo.y), face: body(400), size: M.yearSize, fill: accent });
  });
  void labelLs;

  return {
    sheet, dayCount: days.length, dir: 'h', cells, thin, thick, bars, extras,
    cell: { labelX: M.padX, labelBaseline: 11.5, maxLabels: 6, labelRight: 1.6, weekday: spec.design.weekdays ? { x: cw - 1.8, y: 4.2 } : undefined, monthInCell: false },
  };
}

// ---------------------------------------------------------------------------------------
// Layout "spalten": twelve columns, one month each, days running down. Portrait.

function frameSpalten({ spec, days, body }: Ctx): Frame {
  const sheet = { w: 700, h: 1000 };
  const head = 10;
  const g = { x: M.margin, y: 72, w: 635, h: 893.6 };
  const cw = g.w / 12;
  const rh = (g.h - head) / 31;
  const { accent } = spec.design.colors;
  const y0 = g.y + head;

  const months = monthsOf(days);
  const cells: Cell[] = [];
  const thin: Seg[] = [];
  const thick: Seg[] = [];
  const lw = spec.design.lines.month;
  const bars: Seg[] = [];
  const extras: Prim[] = [];

  months.forEach((mo, c) => {
    const left = g.x + c * cw;
    const bottom = y0 + mo.len * rh;
    for (let k = 0; k < mo.len; k++) cells.push({ i: mo.first + k, x: left, y: y0 + k * rh, w: cw, h: rh, group: c });
    for (let k = 0; k < mo.len; k++) thin.push([left, y0 + k * rh, left + cw, y0 + k * rh]);
    // A month starts at the left of its column: one line stands inside the left edge, as long as
    // the column. No line closes the column at the bottom, the right or the top of the sheet.
    thick.push([left, g.y, left, bottom]);
    bars.push([left, g.y, lw, bottom - g.y]);
    const name = MONTHS_DE[mo.m - 1].toLocaleUpperCase('de-DE');
    const nameFace = body(700);
    extras.push({ k: 'text', x: left + M.padX, y: g.y + 6.6, s: name, face: nameFace, size: 3.3, fill: accent, ls: 0.05 });
    if (mo.m === 1 || c === 0) extras.push({ k: 'text', x: left + cw - M.padX, y: g.y + 6.6, s: String(mo.y), face: body(400), size: 3.0, fill: accent, anchor: 'end' });
  });

  return {
    sheet, dayCount: days.length, dir: 'v', cells, thin, thick, bars, extras,
    cell: { labelX: 14, labelBaseline: 4.6, maxLabels: 7, labelRight: 5, weekday: spec.design.weekdays ? { x: M.padX, y: 11.2 } : undefined, monthInCell: false },
  };
}

function monthsOf(days: Day[]): { m: number; y: number; first: number; len: number }[] {
  const out: { m: number; y: number; first: number; len: number }[] = [];
  days.forEach((day, i) => {
    if (day.d === 1) out.push({ m: day.m, y: day.y, first: i, len: 0 });
    out[out.length - 1].len++;
  });
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
