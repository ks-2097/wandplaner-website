import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CalendarError, LEAGUES, footballFixtures, footballTeams, importIcs, type League } from '@/lib/calendars';
import { clientIp, fail, rateLimit } from '@/lib/http';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const league = z.enum(Object.keys(LEAGUES) as [League, ...League[]]);
const body = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ics'), url: z.string().min(8).max(600), from: date, to: date }),
  z.object({ type: z.literal('football'), league, teamId: z.number().int(), from: date, to: date }),
]);

/** Teams of a league, for the picker. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const parsed = z.object({ league, from: date }).safeParse({ league: q.get('league'), from: q.get('from') });
  if (!parsed.success) return fail('Ungültige Anfrage.');
  try {
    return NextResponse.json({ teams: await footballTeams(parsed.data.league, parsed.data.from) });
  } catch (error) {
    return fail(error instanceof CalendarError ? error.message : 'Die Vereine konnten nicht geladen werden.', 502);
  }
}

/** Resolves an added calendar to dated entries for the planner's range. */
export async function POST(req: Request) {
  if (!rateLimit(`cal:${clientIp(req)}`, 20, 10 * 60_000)) return fail('Das waren viele Anfragen in kurzer Zeit. Versuch es bitte gleich noch einmal.', 429);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Ungültige Anfrage.');
  try {
    const b = parsed.data;
    const result = b.type === 'ics' ? await importIcs(b.url, b.from, b.to) : { ...(await footballFixtures(b.league, b.teamId, b.from, b.to)), skipped: 0 };
    if (!result.events.length) return fail('In diesem Kalender liegen keine Einträge im Zeitraum deines Planers.', 422);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CalendarError) return fail(error.message, 422);
    console.error('calendar import', error);
    return fail('Der Kalender konnte nicht geladen werden.', 500);
  }
}
