// Fetches school and public holidays from the OpenHolidays API (ODbL) and writes
// compact snapshots into data/. Run once a year (npm run holidays), then check the
// result against each Kultusministerium / the KMK table before selling.
import { writeFileSync } from 'node:fs';

const FROM = process.argv[2] ?? '2026-10-01';
const TO = process.argv[3] ?? '2028-03-31';
const base = 'https://openholidaysapi.org';
const q = `countryIsoCode=DE&languageIsoCode=DE&validFrom=${FROM}&validTo=${TO}`;

const get = async (path) => {
  const res = await fetch(`${base}/${path}?${q}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

const [school, pub] = await Promise.all([get('SchoolHolidays'), get('PublicHolidays')]);

const STATES = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
const out = Object.fromEntries(STATES.map((s) => [s, []]));

for (const h of school) {
  // Skip local variants (e.g. the North Sea islands in SH) and vocational schools in MV.
  if (h.comment?.length) continue;
  const groups = (h.groups ?? []).map((g) => g.shortName);
  if (groups.length && !groups.includes('MV-ABS')) continue;
  for (const sd of h.subdivisions ?? []) {
    const code = sd.code.replace('DE-', '');
    if (!out[code]) continue;
    out[code].push({ start: h.startDate, end: h.endDate, name: h.name[0].text });
  }
}
// Manual corrections that survive `npm run holidays`. Each one is documented in
// docs/holiday-check.md with its official source. Re-check them after every refresh and
// delete an entry once the API itself is right.
const OVERRIDES = {
  // OpenHolidays lists these four "Zusätzlicher Ferientag" days for general schools too, but
  // the ministry (https://land-mv.de/seite/ferientermine) sets them for vocational schools
  // (berufliche Schulen) only. General schools have only 07.05.2027 and 26.05.2028.
  remove: [
    { state: 'MV', start: '2026-11-26', end: '2026-11-26' },
    { state: 'MV', start: '2026-11-27', end: '2026-11-27' },
    { state: 'MV', start: '2027-11-25', end: '2027-11-25' },
    { state: 'MV', start: '2027-11-26', end: '2027-11-26' },
  ],
  add: [],
};
for (const r of OVERRIDES.remove) out[r.state] = out[r.state].filter((p) => !(p.start === r.start && p.end === r.end));
for (const a of OVERRIDES.add) out[a.state].push({ start: a.start, end: a.end, name: a.name });

for (const s of STATES) {
  out[s].sort((a, b) => a.start.localeCompare(b.start));
  if (!out[s].length) throw new Error(`No school holidays for ${s}`);
}

const publicOut = pub
  .filter((h) => h.regionalScope !== 'Local')
  .map((h) => ({
    date: h.startDate,
    name: h.name[0].text,
    states: h.nationwide ? STATES : (h.subdivisions ?? []).map((s) => s.shortName).filter((s) => STATES.includes(s)),
  }))
  .sort((a, b) => a.date.localeCompare(b.date));

const meta = { source: 'OpenHolidays API (openholidaysapi.org), ODbL', fetchedAt: new Date().toISOString().slice(0, 10), from: FROM, to: TO };
writeFileSync('data/school-holidays.json', JSON.stringify({ meta, states: out }, null, 1) + '\n');
writeFileSync('data/public-holidays-reference.json', JSON.stringify({ meta, holidays: publicOut }, null, 1) + '\n');
console.log('school:', Object.values(out).reduce((n, a) => n + a.length, 0), 'periods · public:', publicOut.length);
