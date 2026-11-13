import { NextResponse } from 'next/server';
import { AiError, aiReady, birthdaysFromImage } from '@/lib/ai';
import { config } from '@/lib/config';
import { countUsage } from '@/lib/db';
import { UploadError, clientIp, fail, rateLimit, readImage } from '@/lib/http';

export const maxDuration = 120;

/** Reads birthdays from a photographed calendar. The photo is processed in memory and never stored. */
export async function POST(req: Request) {
  if (!aiReady()) return fail('Das Einlesen per Foto ist noch nicht eingerichtet. Du kannst die Geburtstage von Hand eintragen.', 503);
  if (!rateLimit(`scan:${clientIp(req)}`, 8, 10 * 60_000)) return fail('Das waren viele Fotos in kurzer Zeit. Versuch es bitte in ein paar Minuten noch einmal.', 429);
  try {
    const image = await readImage(await req.formData());
    if (!image) return fail('Bitte wähle ein Foto aus.');
    if (!countUsage('ai', config.aiDailyLimit)) return fail('Das Einlesen macht für heute Pause. Du kannst die Geburtstage von Hand eintragen.', 429);
    return NextResponse.json(await birthdaysFromImage(image));
  } catch (error) {
    if (error instanceof AiError || error instanceof UploadError) return fail(error.message, 422);
    console.error('birthday scan', error);
    return fail('Das Foto konnte nicht gelesen werden. Versuch es bitte noch einmal.', 500);
  }
}
