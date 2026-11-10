import schoolData from '../../data/school-holidays.json';
import { easterSunday, parseIso, toDayNumber, weekday } from './dates';

export const STATES = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
} as const;

export type StateCode = keyof typeof STATES;
export const STATE_CODES = Object.keys(STATES) as StateCode[];

export type DayMark = {
  /** Official name, e.g. "Christi Himmelfahrt" */
  name: string;
  /** Short uppercase label printed in the cell */
  label: string;
  /** true = public holiday in this state (shaded like a weekend); false = label only */
  dayOff: boolean;
};

const ALL = STATE_CODES;
const only = (...s: StateCode[]) => s;

/**
 * Public holidays by rule, per Bundesland. Regional holidays that apply to only part of a
 * state (Fronleichnam in parts of SN/TH, Friedensfest in Augsburg) are left out.
 * Mariä Himmelfahrt is included for Bayern, where it applies in most municipalities.
 * Checked in tests against the OpenHolidays snapshot in data/public-holidays-reference.json.
 */
export function publicHolidays(year: number, state: StateCode): Map<number, DayMark> {
  const out = new Map<number, DayMark>();
  const add = (day: number, name: string, label: string, states: readonly StateCode[], dayOff = true) => {
    if (states.includes(state)) out.set(day, { name, label, dayOff });
  };
  const fixed = (m: number, d: number) => toDayNumber(year, m, d);
  const easter = easterSunday(year);

  add(fixed(1, 1), 'Neujahr', 'NEUJAHR', ALL);
  add(fixed(1, 6), 'Heilige Drei Könige', 'HL. DREI KÖNIGE', only('BW', 'BY', 'ST'));
  add(fixed(3, 8), 'Internationaler Frauentag', 'FRAUENTAG', only('BE', 'MV'));
  add(easter - 2, 'Karfreitag', 'KARFREITAG', ALL);
  add(easter, 'Ostersonntag', 'OSTERSONNTAG', ALL, state === 'BB');
  add(easter + 1, 'Ostermontag', 'OSTERMONTAG', ALL);
  add(fixed(5, 1), 'Tag der Arbeit', 'TAG DER ARBEIT', ALL);
  add(easter + 39, 'Christi Himmelfahrt', 'HIMMELFAHRT', ALL);
  add(easter + 49, 'Pfingstsonntag', 'PFINGSTSONNTAG', ALL, state === 'BB');
  add(easter + 50, 'Pfingstmontag', 'PFINGSTMONTAG', ALL);
  add(easter + 60, 'Fronleichnam', 'FRONLEICHNAM', only('BW', 'BY', 'HE', 'NW', 'RP', 'SL'));
  add(fixed(8, 15), 'Mariä Himmelfahrt', 'MARIÄ HIMMELFAHRT', only('BY', 'SL'));
  add(fixed(9, 20), 'Weltkindertag', 'WELTKINDERTAG', only('TH'));
  add(fixed(10, 3), 'Tag der Deutschen Einheit', 'TAG DER EINHEIT', ALL);
  add(fixed(10, 31), 'Reformationstag', 'REFORMATIONSTAG', only('BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'));
  add(fixed(11, 1), 'Allerheiligen', 'ALLERHEILIGEN', only('BW', 'BY', 'NW', 'RP', 'SL'));
  // Buß- und Bettag: the Wednesday before 23 November
  const nov23 = fixed(11, 23);
  add(nov23 - (((weekday(nov23) + 3) % 7) + 1) + 0, 'Buß- und Bettag', 'BUSS- UND BETTAG', only('SN'));
  add(fixed(12, 24), 'Heiligabend', 'HEILIGABEND', ALL, false);
  add(fixed(12, 25), '1. Weihnachtsfeiertag', '1. WEIHNACHTEN', ALL);
  add(fixed(12, 26), '2. Weihnachtsfeiertag', '2. WEIHNACHTEN', ALL);
  add(fixed(12, 31), 'Silvester', 'SILVESTER', ALL, false);
  return out;
}

export type SchoolHoliday = { start: number; end: number; name: string; label: string };

const GENERIC_DAY = /ferientag|unterrichtsfrei|schulfrei|tag nach|^himmelfahrt$/i;

const schoolLabel = (name: string): string => {
  if (GENERIC_DAY.test(name)) return 'FERIENTAG';
  return name.toLocaleUpperCase('de-DE').replace('ẞ', 'SS');
};

type RawPeriod = { start: string; end: string; name: string };
const school = (schoolData as { states: Record<string, RawPeriod[]> }).states;
export const schoolHolidayMeta = (schoolData as unknown as { meta: { source: string; fetchedAt: string; from: string; to: string } }).meta;

/** School holidays of a state that overlap the day range [from, to]. */
export function schoolHolidays(state: StateCode, from: number, to: number): SchoolHoliday[] {
  return (school[state] ?? [])
    .map((p) => ({ start: parseIso(p.start), end: parseIso(p.end), name: p.name, label: schoolLabel(p.name) }))
    .filter((p) => p.end >= from && p.start <= to);
}

/** Last day for which school-holiday data is on file. */
export const schoolDataCoversUntil = (): number => parseIso(schoolHolidayMeta.to);
