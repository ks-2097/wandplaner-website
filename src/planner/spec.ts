import { z } from 'zod';
import { EDITIONS, editionById } from './editions';
import { BODY_FONTS, FONT_IDS, type FontFamilyId } from './fonts';
import { STATE_CODES, defaultRegional, regionalHolidaysFor } from './holidays';

/**
 * The design spec: everything that distinguishes one planner from another.
 * The layout engine turns a spec into the drawing; nothing else may draw the calendar.
 * A person edits it through the configurator, the design assistant through JSON.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/).transform((s) => s.toLowerCase());
const fontId = z.enum(FONT_IDS as [FontFamilyId, ...FontFamilyId[]]);
const bodyFontId = z.enum(BODY_FONTS as [FontFamilyId, ...FontFamilyId[]]);

export const birthdaySchema = z.object({
  name: z.string().trim().min(1).max(24),
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** An entry from an added calendar (a subscription feed, a fixture list, a typed date). */
export const eventSchema = z.object({
  start: isoDate,
  /** Last day, inclusive. Absent for a single day. */
  end: isoDate.optional(),
  label: z.string().trim().min(1).max(40),
  /** Id of the calendar it came from, so a calendar can be removed again */
  source: z.string().max(80).optional(),
});

export const designSchema = z.object({
  colors: z.object({ paper: hex, ink: hex, accent: hex }),
  title: z.object({
    text: z.string().trim().min(1).max(40),
    font: fontId,
    case: z.enum(['lower', 'upper', 'asis']),
    align: z.enum(['left', 'center', 'right']),
    /** 1 = the size of the original edition; long titles shrink to fit on their own */
    scale: z.number().min(0.4).max(1.25),
  }),
  bodyFont: bodyFontId,
  /** Opacity of the accent fill on weekends and public holidays; 0 turns it off */
  shading: z.number().min(0).max(0.3),
  lines: z.object({
    /** Thin grid, mm */
    grid: z.number().min(0.1).max(0.6),
    gridOpacity: z.number().min(0.15).max(1),
    /** Stepped month line and outer frame, mm; 0 = no month line */
    month: z.number().min(0).max(2.5),
  }),
  numbers: z.object({
    zeroPad: z.boolean(),
    weight: z.union([z.literal(400), z.literal(500), z.literal(700)]),
    scale: z.number().min(0.7).max(1.4),
  }),
  monthLabel: z.enum(['vertical', 'horizontal']),
  schoolHolidays: z.enum(['arrows', 'band', 'underline', 'none']),
  weekdays: z.boolean(),
});

export const LAYOUT_IDS = ['wochen', 'zeilen', 'spalten'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const specSchema = z.object({
  v: z.literal(1),
  /** The base layout: where the days sit on the sheet */
  layout: z.enum(LAYOUT_IDS),
  edition: z.string().max(40),
  state: z.enum(STATE_CODES as [string, ...string[]]),
  start: z.object({ year: z.number().int().min(2026).max(2028), month: z.number().int().min(1).max(12) }),
  design: designSchema,
  /** Which built-in calendars are drawn. Public holidays always follow `state`. */
  calendars: z.object({
    publicHolidays: z.boolean(),
    /** Bundesländer whose school holidays are shown; a second one helps commuters and patchwork families */
    school: z.array(z.enum(STATE_CODES as [string, ...string[]])).max(2),
    /** Holidays that apply in only part of the state and that the customer has ticked (ids from REGIONAL_HOLIDAYS). Absent = the defaults. */
    regional: z.array(z.string().max(40)).max(8).optional(),
  }),
  /** Entries from added calendars, resolved to fixed dates when they were added */
  events: z.array(eventSchema).max(600),
  birthdays: z.array(birthdaySchema).max(120),
});

export type Design = z.infer<typeof designSchema>;
export type Birthday = z.infer<typeof birthdaySchema>;
export type PlannerEvent = z.infer<typeof eventSchema>;
type RawSpec = z.infer<typeof specSchema>;
export type PlannerSpec = Omit<RawSpec, 'state' | 'calendars'> & {
  state: (typeof STATE_CODES)[number];
  calendars: { publicHolidays: boolean; school: (typeof STATE_CODES)[number][]; regional?: string[] };
};

const NUMBER_WORDS: Record<number, string> = {
  2026: 'zweitausend&sechsundzwanzig',
  2027: 'zweitausend&siebenundzwanzig',
  2028: 'zweitausend&achtundzwanzig',
};

/** The year most of the planner falls in, spelled out the way the first edition does. */
export const defaultTitle = (start: { year: number; month: number }): string => NUMBER_WORDS[start.month <= 6 ? start.year : start.year + 1] ?? String(start.year);

export function designForEdition(editionId: string, start = { year: 2027, month: 1 }): Design {
  const e = editionById(editionId);
  return {
    colors: { paper: e.paper, ink: e.ink, accent: e.accent },
    title: { text: defaultTitle(start), font: 'poppins', case: 'lower', align: 'left', scale: 1 },
    bodyFont: 'poppins',
    shading: 0.08,
    lines: { grid: 0.2, gridOpacity: 0.5, month: 1.12 },
    numbers: { zeroPad: true, weight: 400, scale: 1 },
    monthLabel: 'vertical',
    schoolHolidays: 'arrows',
    weekdays: true,
  };
}

export function defaultSpec(overrides: Partial<Pick<PlannerSpec, 'edition' | 'state' | 'start' | 'layout'>> = {}): PlannerSpec {
  const edition = overrides.edition ?? EDITIONS[0].id;
  const start = overrides.start ?? { year: 2027, month: 1 };
  const state = overrides.state ?? 'BE';
  return { v: 1, layout: overrides.layout ?? 'wochen', edition, state, start, design: designForEdition(edition, start), calendars: { publicHolidays: true, school: [state], regional: defaultRegional(state) }, events: [], birthdays: [] };
}

// ---- Guardrails: whatever a person or the assistant asks for, the planner stays legible.

const lum = (hexColor: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export const contrast = (a: string, b: string): number => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const mix = (a: string, b: string, t: number): string =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

/** Push `color` away from `ground` (towards black or white) until it reaches the ratio. */
export function ensureContrast(color: string, ground: string, ratio: number): string {
  if (contrast(color, ground) >= ratio) return color;
  const target = lum(ground) > 0.4 ? '#000000' : '#ffffff';
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(color, target, t);
    if (contrast(c, ground) >= ratio) return c;
  }
  return target;
}

export const MIN_INK_CONTRAST = 7;
export const MIN_ACCENT_CONTRAST = 4.5;

/** Validates a spec and repairs what would print badly. Throws on a malformed spec. */
export function sanitizeSpec(input: unknown): PlannerSpec {
  const spec = specSchema.parse(input) as PlannerSpec;
  const c = spec.design.colors;
  c.ink = ensureContrast(c.ink, c.paper, MIN_INK_CONTRAST);
  c.accent = ensureContrast(c.accent, c.paper, MIN_ACCENT_CONTRAST);
  // Hairlines thinner than this at low opacity vanish in print.
  if (spec.design.lines.grid < 0.15 && spec.design.lines.gridOpacity < 0.5) spec.design.lines.gridOpacity = 0.5;
  spec.calendars.school = [...new Set(spec.calendars.school)];
  const allowed = regionalHolidaysFor(spec.state).map((h) => h.id);
  spec.calendars.regional = (spec.calendars.regional ?? defaultRegional(spec.state)).filter((id, i, a) => allowed.includes(id) && a.indexOf(id) === i);
  spec.events = spec.events.filter((e) => !e.end || e.end >= e.start);
  spec.birthdays = spec.birthdays.filter((b) => b.day <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][b.month - 1]);
  return spec;
}
