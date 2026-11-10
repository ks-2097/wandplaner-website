import { NextResponse } from 'next/server';
import { sanitizeSpec } from '@/planner';
import { AiError, aiReady, designFromPrompt } from '@/lib/ai';
import { config } from '@/lib/config';
import { countUsage } from '@/lib/db';
import { UploadError, clientIp, fail, rateLimit, readImage } from '@/lib/http';

export const maxDuration = 120;

/** Design assistant: free text (+ optional reference photo) + current spec → new spec. */
export async function POST(req: Request) {
  if (!aiReady()) return fail('Der Design-Assistent ist noch nicht eingerichtet.', 503);
  if (!rateLimit(`ai:${clientIp(req)}`, 12, 10 * 60_000)) return fail('Das waren viele Anfragen in kurzer Zeit. Versuch es bitte in ein paar Minuten noch einmal.', 429);
  try {
    const form = await req.formData();
    const prompt = String(form.get('prompt') ?? '').trim().slice(0, 1500);
    const image = await readImage(form);
    if (!prompt && !image) return fail('Beschreib kurz, was sich ändern soll, oder lade ein Foto hoch.');
    const spec = sanitizeSpec(JSON.parse(String(form.get('spec') ?? 'null')));
    if (!countUsage('ai', config.aiDailyLimit)) return fail('Der Assistent macht für heute Pause. Morgen ist er wieder da; alle Einstellungen kannst du auch von Hand ändern.', 429);
    const result = await designFromPrompt({ prompt: prompt || 'Gestalte den Planer passend zur Stimmung dieses Fotos.', image, spec });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiError || error instanceof UploadError) return fail(error.message, 422);
    console.error('assistant', error);
    return fail('Das hat nicht geklappt. Versuch es bitte noch einmal.', 500);
  }
}
