import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { fromDayNumber, iso, parseIso, toDayNumber, type PlannerEvent } from '@/planner';

/**
 * Added calendars: a public subscription feed (ICS) or the fixtures of a football club.
 * Entries are resolved to fixed dates when the customer adds the calendar and stored in
 * the design, so the planner that prints is the planner they checked.
 */

export class CalendarError extends Error {}

const MAX_BYTES = 3_000_000;
const MAX_EVENTS = 300;

// ---- Fetching a feed the customer points us to. The server must not be usable to reach
// ---- internal addresses, so every hop is resolved and checked before it is requested.

const isPrivate = (ip: string): boolean => {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new CalendarError('Bitte gib eine Adresse an, die mit https:// oder webcal:// beginnt.');
  if (url.username || url.password) throw new CalendarError('Adressen mit Zugangsdaten können wir nicht abrufen.');
  if (url.port && !['80', '443'].includes(url.port)) throw new CalendarError('Diese Adresse können wir nicht abrufen.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivate)) throw new CalendarError('Diese Adresse können wir nicht abrufen.');
}

async function fetchText(input: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(input.trim().replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    throw new CalendarError('Das ist keine gültige Adresse.');
  }
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5', 'user-agent': 'calendar-import/1.0' } }).catch(() => {
      throw new CalendarError('Der Kalender ist gerade nicht erreichbar.');
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) throw new CalendarError(`Der Kalender antwortet mit einem Fehler (${res.status}). Ist die Adresse öffentlich?`);
    const reader = res.body?.getReader();
    if (!reader) throw new CalendarError('Der Kalender ist leer.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new CalendarError('Dieser Kalender ist zu groß (mehr als 3 MB).');
      }
      chunks.push(value);
    }
    return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
  }
  throw new CalendarError('Zu viele Weiterleitungen.');
}

// ---- iCalendar

const unescapeText = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim();

/** The calendar date a DTSTART/DTEND value falls on in Germany. */
function icsDate(value: string, params: string): { day: number; dateOnly: boolean } | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return;
  const [, y, mo, d, hh, mi, , z] = m;
  if (!hh) return { day: toDayNumber(+y, +mo, +d), dateOnly: true };
  if (z || /TZID=(UTC|Etc\/UTC|GMT)/i.test(params)) {
    // UTC time: find the date in Berlin
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi));
    const [by, bm, bd] = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(dt).split('-').map(Number);
    return { day: toDayNumber(by, bm, bd), dateOnly: false };
  }
  return { day: toDayNumber(+y, +mo, +d), dateOnly: false };
}

export function parseIcs(text: string, from: number, to: number, source: string): { events: PlannerEvent[]; skipped: number } {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new CalendarError('Unter dieser Adresse liegt kein Kalender im iCal-Format (.ics).');
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: PlannerEvent[] = [];
  let skipped = 0;
  let cur: Record<string, { value: string; params: string }> | undefined;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) cur = {};
    else if (/^END:VEVENT/i.test(line) && cur) {
      const ev = cur;
      cur = undefined;
      const start = ev.DTSTART && icsDate(ev.DTSTART.value, ev.DTSTART.params);
      const label = unescapeText(ev.SUMMARY?.value ?? '').slice(0, 40);
      if (!start || !label || /CANCELLED/i.test(ev.STATUS?.value ?? '')) continue;
      let end = start.day;
      const e = ev.DTEND && icsDate(ev.DTEND.value, ev.DTEND.params);
      // An all-day DTEND is the day after the last day.
      if (e) end = Math.max(start.day, e.dateOnly ? e.day - 1 : e.day);
      const rule = ev.RRULE?.value ?? '';
      if (rule) {
        // Yearly entries (birthdays, anniversaries) repeat onto the planner; anything more frequent would flood it.
        if (!/FREQ=YEARLY/i.test(rule) || /INTERVAL=(?!1\b)/i.test(rule)) {
          skipped++;
          continue;
        }
        const s = fromDayNumber(start.day);
        for (let y = fromDayNumber(from).y; y <= fromDayNumber(to).y; y++) {
          const day = toDayNumber(y, s.m, s.d);
          if (day >= from && day <= to && day >= start.day) events.push({ start: iso(fromDayNumber(day)), label, source });
        }
        continue;
      }
      if (end < from || start.day > to) continue;
      if (end - start.day > 120) {
        skipped++;
        continue;
      }
      events.push({ start: iso(fromDayNumber(start.day)), ...(end > start.day ? { end: iso(fromDayNumber(end)) } : {}), label, source });
    } else if (cur) {
      const m = /^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
      if (m && !(m[1].toUpperCase() in cur)) cur[m[1].toUpperCase()] = { value: m[3], params: m[2] };
    }
  }
  events.sort((a, b) => a.start.localeCompare(b.start));
  const seen = new Set<string>();
  const unique = events.filter((e) => !seen.has(`${e.start}|${e.end}|${e.label}`) && seen.add(`${e.start}|${e.end}|${e.label}`));
  return { events: unique.slice(0, MAX_EVENTS), skipped: skipped + Math.max(0, unique.length - MAX_EVENTS) };
}

export async function importIcs(url: string, from: string, to: string): Promise<{ events: PlannerEvent[]; skipped: number; name: string }> {
  const text = await fetchText(url);
  const name = unescapeText(/^X-WR-CALNAME[^:]*:(.*)$/im.exec(text)?.[1] ?? '').slice(0, 40) || 'Eigener Kalender';
  const source = `ics:${Date.now().toString(36)}`;
  return { ...parseIcs(text, parseIso(from), parseIso(to), source), name };
}

// ---- Football fixtures from OpenLigaDB (free, community-maintained, ODbL)

export const LEAGUES = { bl1: '1. Bundesliga', bl2: '2. Bundesliga', bl3: '3. Liga' } as const;
export type League = keyof typeof LEAGUES;

type OlTeam = { teamId: number; teamName: string; shortName: string };
type OlMatch = { matchDateTimeUTC: string; team1: OlTeam; team2: OlTeam };

const ol = async <T>(path: string): Promise<T> => {
  const res = await fetch(`https://api.openligadb.de/${path}`, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' }, next: { revalidate: 6 * 3600 } } as RequestInit).catch(() => undefined);
  if (!res?.ok) throw new CalendarError('Die Spielpläne sind gerade nicht erreichbar. Versuch es bitte später noch einmal.');
  return (await res.json()) as T;
};

/** The season a planner range touches: the season "2026" runs from summer 2026 to spring 2027. */
const seasons = (from: number, to: number): number[] => {
  const a = fromDayNumber(from);
  const b = fromDayNumber(to);
  const first = a.m >= 7 ? a.y : a.y - 1;
  const last = b.m >= 7 ? b.y : b.y - 1;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
};

export async function footballTeams(league: League, from: string): Promise<{ id: number; name: string }[]> {
  const season = seasons(parseIso(from), parseIso(from))[0];
  const teams = await ol<OlTeam[]>(`getavailableteams/${league}/${season}`);
  return teams.map((t) => ({ id: t.teamId, name: t.teamName })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function footballFixtures(league: League, teamId: number, from: string, to: string): Promise<{ events: PlannerEvent[]; name: string }> {
  const [a, b] = [parseIso(from), parseIso(to)];
  const events: PlannerEvent[] = [];
  let name = '';
  for (const season of seasons(a, b)) {
    const matches = await ol<OlMatch[]>(`getmatchdata/${league}/${season}`).catch(() => [] as OlMatch[]);
    for (const m of matches) {
      if (m.team1.teamId !== teamId && m.team2.teamId !== teamId) continue;
      const mine = m.team1.teamId === teamId ? m.team1 : m.team2;
      const other = m.team1.teamId === teamId ? m.team2 : m.team1;
      name ||= mine.teamName;
      const d = icsDate(m.matchDateTimeUTC.replace(/[-:]/g, '').replace(/\.\d+/, ''), '');
      if (!d || d.day < a || d.day > b) continue;
      const short = (t: OlTeam) => (t.shortName || t.teamName).slice(0, 14);
      // Home games name the guest, away games are marked "bei"
      events.push({ start: iso(fromDayNumber(d.day)), label: (m.team1.teamId === teamId ? `${short(mine)} – ${short(other)}` : `bei ${short(other)}`).slice(0, 40), source: `football:${league}:${teamId}` });
    }
  }
  if (!events.length) throw new CalendarError('Für diesen Verein sind in diesem Zeitraum noch keine Spiele angesetzt.');
  return { events, name: name || 'Spielplan' };
}
