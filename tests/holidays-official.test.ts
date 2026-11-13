// Official school-holiday dates as fixtures, asserted against what the planner code returns.
// Every date below was read in the audit session of 2026-11-13 from a page or PDF that was
// actually fetched; sources and conventions are written up in docs/holiday-check.md.
//
// Primary source for all 16 states: KMK "Ferien im Schuljahr 2026/2027" (FER2026_27.pdf) and
// "2027/2028" (FER2027_28.pdf), Stand 09.10.2025, https://www.kmk.org/service/ferienregelung.html
// KMK lists the first and last holiday day. Where a state ministry page was reachable it was used
// to confirm the KMK table and to add the school-free bridge days the KMK table prints in italics
// (the PDF text extraction cannot show italics, so those days are taken from the ministry pages).
//
// Test names starting with "[DATA GAP]" or "[CODE BUG]" fail on purpose until the data or the
// code is fixed. They are not flaky; do not delete them to get a green run.
import { describe, expect, it } from 'vitest';
import {
  STATE_CODES, fromDayNumber, iso, parseIso, publicHolidays, schoolDataCoversUntil, schoolHolidays, type StateCode,
} from '../src/planner';

/** [first day, last day] inclusive, ISO. A single day is [d, d]. */
type P = [string, string];

const WINDOW_FROM = '2026-11-01';
const WINDOW_TO = '2028-07-31';
/** Last day the snapshot in data/school-holidays.json claims to cover (meta.to). */
const SNAPSHOT_TO = '2028-03-31';

/**
 * Official periods that overlap WINDOW_FROM..WINDOW_TO.
 * Sources per state are listed above each entry.
 */
const OFFICIAL: Record<StateCode, P[]> = {
  // KMK; https://km.baden-wuerttemberg.de/de/service/ferien (Gründonnerstag 25.03.2027 and 13.04.2028 schulfrei)
  BW: [
    ['2026-12-23', '2027-01-09'], ['2027-03-25', '2027-03-25'], ['2027-03-30', '2027-04-03'], ['2027-05-18', '2027-05-29'],
    ['2027-07-29', '2027-09-11'], ['2027-11-02', '2027-11-06'], ['2027-12-23', '2028-01-08'],
    ['2028-04-13', '2028-04-13'], ['2028-04-18', '2028-04-22'], ['2028-06-06', '2028-06-17'], ['2028-07-27', '2028-09-09'],
  ],
  // KMK; https://www.gesetze-bayern.de/Content/Document/BayVV_2230_1_1_0_K_13479/true (BayMBl. 2022 Nr. 747);
  // Buß- und Bettag: Art. 4 Nr. 3 BayFTG, "An den Schulen aller Gattungen entfällt der Unterricht" (not a public holiday).
  BY: [
    ['2026-11-02', '2026-11-06'], ['2026-11-18', '2026-11-18'], ['2026-12-24', '2027-01-08'], ['2027-02-08', '2027-02-12'],
    ['2027-03-22', '2027-04-02'], ['2027-05-18', '2027-05-28'], ['2027-08-02', '2027-09-13'], ['2027-11-02', '2027-11-05'],
    ['2027-11-17', '2027-11-17'], ['2027-12-24', '2028-01-07'], ['2028-02-28', '2028-03-03'], ['2028-04-10', '2028-04-21'],
    ['2028-06-06', '2028-06-16'], ['2028-07-31', '2028-09-11'],
  ],
  // KMK; official ICS https://berlin.de/sen/bjf/service/kalender/ferien/schulferien_berlin.ics (Stand Nov 2026)
  BE: [
    ['2026-12-23', '2027-01-02'], ['2027-02-01', '2027-02-06'], ['2027-03-22', '2027-04-02'], ['2027-05-07', '2027-05-07'],
    ['2027-05-18', '2027-05-19'], ['2027-07-01', '2027-08-14'], ['2027-10-11', '2027-10-23'], ['2027-12-22', '2027-12-31'],
    ['2028-01-31', '2028-02-05'], ['2028-04-10', '2028-04-22'], ['2028-05-26', '2028-05-26'], ['2028-06-01', '2028-06-02'],
    ['2028-07-01', '2028-08-12'],
  ],
  // KMK; VV Schulbetrieb Anlage 1 https://bravors.brandenburg.de/sixcms/media.php/66/VV-Schulbetrieb-Anlage-1-2025.pdf
  // (variable Ferientage 07.05.2027 and 26.05.2028 apply unless the Schulkonferenz decides otherwise; Pfingsten 18.05.2027)
  BB: [
    ['2026-12-23', '2027-01-02'], ['2027-02-01', '2027-02-06'], ['2027-03-22', '2027-04-03'], ['2027-05-07', '2027-05-07'],
    ['2027-05-18', '2027-05-18'], ['2027-07-01', '2027-08-14'], ['2027-10-11', '2027-10-23'], ['2027-12-23', '2027-12-31'],
    ['2028-01-31', '2028-02-05'], ['2028-04-10', '2028-04-22'], ['2028-05-26', '2028-05-26'], ['2028-06-29', '2028-08-12'],
  ],
  // KMK; https://www.bildung.bremen.de/ferientermine-3404
  HB: [
    ['2026-12-23', '2027-01-09'], ['2027-02-01', '2027-02-02'], ['2027-03-22', '2027-04-03'], ['2027-05-07', '2027-05-07'],
    ['2027-05-18', '2027-05-18'], ['2027-07-08', '2027-08-18'], ['2027-10-18', '2027-10-30'], ['2027-12-23', '2028-01-08'],
    ['2028-01-31', '2028-02-01'], ['2028-04-10', '2028-04-22'], ['2028-05-26', '2028-05-26'], ['2028-06-06', '2028-06-06'],
    ['2028-07-20', '2028-08-30'],
  ],
  // KMK; Ferienordnung https://www.hamburg.de/resource/blob/134372/5bc131bdd36a604f67b361d21f7df37e/ferienordnung-hamburg-2024-2030-data.pdf
  HH: [
    ['2026-12-21', '2027-01-01'], ['2027-01-29', '2027-01-29'], ['2027-03-01', '2027-03-12'], ['2027-05-07', '2027-05-14'],
    ['2027-07-01', '2027-08-11'], ['2027-10-11', '2027-10-22'], ['2027-12-20', '2027-12-31'], ['2028-01-28', '2028-01-28'],
    ['2028-03-06', '2028-03-17'], ['2028-05-22', '2028-05-26'], ['2028-07-03', '2028-08-11'],
  ],
  // KMK; https://kultus.hessen.de/schulsystem/ferien/ferientermine
  HE: [
    ['2026-12-23', '2027-01-12'], ['2027-03-22', '2027-04-02'], ['2027-06-28', '2027-08-06'], ['2027-10-04', '2027-10-16'],
    ['2027-12-23', '2028-01-11'], ['2028-04-03', '2028-04-14'], ['2028-07-03', '2028-08-11'],
  ],
  // KMK; https://land-mv.de/seite/ferientermine (general schools). The "Zusätzliche Ferientage" 26./27.11.2026 and
  // 25./26.11.2027 are for berufliche Schulen only and are NOT in this list. 18.02.2028 is a Brückentag (footnote 1).
  MV: [
    ['2026-12-21', '2027-01-02'], ['2027-02-08', '2027-02-19'], ['2027-03-24', '2027-04-02'], ['2027-05-07', '2027-05-07'],
    ['2027-05-14', '2027-05-18'], ['2027-07-05', '2027-08-14'], ['2027-10-14', '2027-10-23'], ['2027-12-22', '2028-01-04'],
    ['2028-02-05', '2028-02-18'], ['2028-04-12', '2028-04-21'], ['2028-05-26', '2028-05-26'], ['2028-06-02', '2028-06-06'],
    ['2028-06-26', '2028-08-05'],
  ],
  // KMK; https://www.mk.niedersachsen.de/download/98088 (islands have separate Sommer/Herbst dates, not covered here)
  NI: [
    ['2026-12-23', '2027-01-09'], ['2027-02-01', '2027-02-02'], ['2027-03-22', '2027-04-03'], ['2027-05-07', '2027-05-07'],
    ['2027-05-18', '2027-05-18'], ['2027-07-08', '2027-08-18'], ['2027-10-16', '2027-10-30'], ['2027-12-23', '2028-01-08'],
    ['2028-01-31', '2028-02-01'], ['2028-04-10', '2028-04-22'], ['2028-05-26', '2028-05-26'], ['2028-06-06', '2028-06-06'],
    ['2028-07-20', '2028-08-30'],
  ],
  // KMK; https://www.schulministerium.nrw/service/ferienordnung-nrw-bis-2029-30 (no Pfingstferien 2028)
  NW: [
    ['2026-12-23', '2027-01-06'], ['2027-03-22', '2027-04-03'], ['2027-05-18', '2027-05-18'], ['2027-07-19', '2027-08-31'],
    ['2027-10-23', '2027-11-06'], ['2027-12-24', '2028-01-08'], ['2028-04-10', '2028-04-22'], ['2028-07-10', '2028-08-22'],
  ],
  // KMK; https://bm.rlp.de/service/ferientermine
  RP: [
    ['2026-12-23', '2027-01-08'], ['2027-03-22', '2027-04-02'], ['2027-06-28', '2027-08-06'], ['2027-10-04', '2027-10-15'],
    ['2027-12-23', '2028-01-07'], ['2028-04-10', '2028-04-21'], ['2028-07-03', '2028-08-11'],
  ],
  // KMK only: saarland.de answered HTTP 403 for every URL tried, so the ministry page could not be read.
  SL: [
    ['2026-12-21', '2026-12-31'], ['2027-02-08', '2027-02-12'], ['2027-03-30', '2027-04-09'], ['2027-06-28', '2027-08-06'],
    ['2027-10-04', '2027-10-15'], ['2027-12-20', '2027-12-31'], ['2028-02-21', '2028-02-29'], ['2028-04-12', '2028-04-21'],
    ['2028-07-03', '2028-08-11'],
  ],
  // KMK; https://www.schule.sachsen.de/schuljahrestermine-4793.html (unterrichtsfreie Tage 07.05.2027 and 26.05.2028)
  SN: [
    ['2026-12-23', '2027-01-02'], ['2027-02-08', '2027-02-19'], ['2027-03-26', '2027-04-02'], ['2027-05-07', '2027-05-07'],
    ['2027-05-15', '2027-05-18'], ['2027-07-10', '2027-08-20'], ['2027-10-11', '2027-10-23'], ['2027-12-23', '2028-01-01'],
    ['2028-02-14', '2028-02-26'], ['2028-04-14', '2028-04-22'], ['2028-05-26', '2028-05-26'], ['2028-07-22', '2028-09-01'],
  ],
  // KMK; https://mb.sachsen-anhalt.de/api/media/Ferientermine_2024_bis_2030.pdf?collection=document
  ST: [
    ['2026-12-21', '2027-01-02'], ['2027-02-01', '2027-02-06'], ['2027-03-22', '2027-03-27'], ['2027-05-15', '2027-05-22'],
    ['2027-07-10', '2027-08-20'], ['2027-10-18', '2027-10-23'], ['2027-12-20', '2027-12-31'], ['2028-02-07', '2028-02-12'],
    ['2028-04-10', '2028-04-22'], ['2028-06-03', '2028-06-10'], ['2028-07-22', '2028-09-01'],
  ],
  // KMK only: schleswig-holstein.de did not answer (connection reset);
  // islands (Sylt, Föhr, Amrum, Helgoland, Halligen) have separate Sommer/Herbst dates, not covered here.
  SH: [
    ['2026-12-21', '2027-01-06'], ['2027-03-30', '2027-04-10'], ['2027-05-07', '2027-05-07'], ['2027-07-03', '2027-08-14'],
    ['2027-10-11', '2027-10-23'], ['2027-12-23', '2028-01-08'], ['2028-04-03', '2028-04-15'], ['2028-05-26', '2028-05-26'],
    ['2028-06-24', '2028-08-04'],
  ],
  // KMK only: bildung.thueringen.de is behind a CAPTCHA (Link11) and could not be read.
  TH: [
    ['2026-12-23', '2027-01-02'], ['2027-02-01', '2027-02-06'], ['2027-03-22', '2027-04-03'], ['2027-05-07', '2027-05-07'],
    ['2027-07-10', '2027-08-20'], ['2027-10-09', '2027-10-23'], ['2027-12-23', '2027-12-31'], ['2028-02-07', '2028-02-12'],
    ['2028-04-03', '2028-04-15'], ['2028-05-26', '2028-05-26'], ['2028-07-22', '2028-09-01'],
  ],
};

const days = (a: string, b: string): string[] => {
  const out: string[] = [];
  for (let d = parseIso(a); d <= parseIso(b); d++) out.push(iso(fromDayNumber(d)));
  return out;
};

/** Official school-free days of a state inside [from, to]. */
const officialDays = (state: StateCode, from: string, to: string): Set<string> => {
  const set = new Set<string>();
  for (const [a, b] of OFFICIAL[state]) for (const d of days(a, b)) if (d >= from && d <= to) set.add(d);
  return set;
};

/** School-free days the planner would print for a state inside [from, to]. */
const ourDays = (state: StateCode, from: string, to: string): Set<string> => {
  const set = new Set<string>();
  for (const p of schoolHolidays(state, parseIso(from), parseIso(to)))
    for (const d of days(iso(fromDayNumber(p.start)), iso(fromDayNumber(p.end)))) if (d >= from && d <= to) set.add(d);
  return set;
};

const missing = (want: Set<string>, have: Set<string>) => [...want].filter((d) => !have.has(d)).sort();
const extra = (want: Set<string>, have: Set<string>) => [...have].filter((d) => !want.has(d)).sort();

describe('official school holidays (KMK + state ministries)', () => {
  it('has fixtures for all 16 states', () => {
    expect(Object.keys(OFFICIAL).sort()).toEqual([...STATE_CODES].sort());
  });

  for (const state of STATE_CODES) {
    it(`${state}: every official day up to ${SNAPSHOT_TO} is in the planner data`, () => {
      const want = officialDays(state, WINDOW_FROM, SNAPSHOT_TO);
      expect(missing(want, ourDays(state, WINDOW_FROM, SNAPSHOT_TO))).toEqual([]);
    });

    it(`${state}: the planner data has no school-free day that is not official (${WINDOW_FROM} to ${WINDOW_TO})`, () => {
      const want = officialDays(state, WINDOW_FROM, WINDOW_TO);
      expect(extra(want, ourDays(state, WINDOW_FROM, WINDOW_TO))).toEqual([]);
    });

    it(`${state}: official days from 2028-04-01 to ${WINDOW_TO} are missing from the snapshot`, () => {
      const want = officialDays(state, '2028-04-01', WINDOW_TO);
      expect(missing(want, ourDays(state, '2028-04-01', WINDOW_TO))).toEqual([]);
    });
  }

  it(`the snapshot covers the whole range up to ${WINDOW_TO}`, () => {
    expect(schoolDataCoversUntil()).toBeGreaterThanOrEqual(parseIso(WINDOW_TO));
  });
});

describe('official public holidays that the planner has to get right', () => {
  const name = (y: number, s: StateCode, d: string, regional?: string[]) => publicHolidays(y, s, regional).get(parseIso(d));

  it('Berlin has a one-off public holiday on Saturday 17 June 2028 (75th anniversary of 17 June 1953)', () => {
    // Source: https://www.berlin.de/sen/bjf/service/kalender/ferien/termine/ ("einmaliger gesetzlicher Feiertag").
    // src/planner/holidays.ts has no rule for it, so the planner prints a plain Saturday.
    expect(name(2028, 'BE', '2028-06-17')?.dayOff).toBe(true);
    expect(name(2028, 'HH', '2028-06-17')).toBeUndefined();
  });

  it('Buß- und Bettag is a public holiday in Sachsen only, on the Wednesday before 23 November', () => {
    expect(name(2026, 'SN', '2026-11-18')?.dayOff).toBe(true);
    expect(name(2027, 'SN', '2027-11-17')?.dayOff).toBe(true);
    expect(name(2028, 'SN', '2028-11-22')?.dayOff).toBe(true);
    // Bayern: school-free (see BY fixtures) but not a public holiday.
    expect(name(2026, 'BY', '2026-11-18')).toBeUndefined();
    expect(name(2027, 'BY', '2027-11-17')).toBeUndefined();
  });

  it('Bayern: Fronleichnam statewide, Mariä Himmelfahrt on by default, Friedensfest only when chosen (BayFTG Art. 1)', () => {
    expect(name(2027, 'BY', '2027-05-27')?.dayOff).toBe(true);
    expect(name(2027, 'BY', '2027-08-15')?.dayOff).toBe(true);
    expect(name(2027, 'BY', '2027-08-08')).toBeUndefined();
    expect(name(2027, 'BY', '2027-08-08', ['friedensfest'])?.dayOff).toBe(true);
    expect(name(2027, 'BY', '2027-08-15', [])).toBeUndefined();
  });

  it('Sachsen: Fronleichnam only in the listed communes (FronleichnamsVO), so it is opt-in', () => {
    expect(name(2027, 'SN', '2027-05-27')).toBeUndefined();
    expect(name(2027, 'SN', '2027-05-27', ['fronleichnam'])?.dayOff).toBe(true);
  });
});
