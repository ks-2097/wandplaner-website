import { NextResponse } from 'next/server';

/** JSON error in the shape the client expects: { error: "German sentence" } */
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export const clientIp = (req: Request): string => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';

// Per-visitor rate limit, kept in memory: enough to stop one browser from hammering the
// paid endpoints. The daily cap across all visitors lives in the database (countUsage).
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const t = Date.now();
  const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(t);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
  return true;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** Reads an uploaded image from form data. Returns undefined when none was sent. */
export async function readImage(form: FormData, field = 'image'): Promise<{ mediaType: ImageType; data: string } | undefined> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (!IMAGE_TYPES.includes(file.type as ImageType)) throw new UploadError('Bitte lade ein Foto als JPG, PNG oder WebP hoch.');
  if (file.size > 5 * 1024 * 1024) throw new UploadError('Das Foto ist größer als 5 MB. Bitte verkleinere es.');
  return { mediaType: file.type as ImageType, data: Buffer.from(await file.arrayBuffer()).toString('base64') };
}

export class UploadError extends Error {}
