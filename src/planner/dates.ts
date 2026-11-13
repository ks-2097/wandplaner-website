// Calendar dates as plain UTC day numbers, so no time zone can shift a day.

export type Ymd = { y: number; m: number; d: number };

const DAY = 86_400_000;

export const toDayNumber = (y: number, m: number, d: number): number => Math.floor(Date.UTC(y, m - 1, d) / DAY);

export const fromDayNumber = (n: number): Ymd => {
  const dt = new Date(n * DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};

/** 0 = Sunday … 6 = Saturday */
export const weekday = (n: number): number => (((n + 4) % 7) + 7) % 7;

export const iso = ({ y, m, d }: Ymd): string => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const parseIso = (s: string): number => {
  const [y, m, d] = s.split('-').map(Number);
  return toDayNumber(y, m, d);
};

export const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Easter Sunday (Gregorian), anonymous algorithm. */
export const easterSunday = (year: number): number => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDayNumber(year, month, day);
};

export const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const WEEKDAYS_DE = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
