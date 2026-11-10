import families from './fonts.json';
import metricsData from './metrics.json';

export type FontFamilyId = keyof typeof families;
export type FontFamily = { css: string; label: string; kind: string; roles: string[]; files: Record<string, string> };

export const FONT_FAMILIES = families as Record<FontFamilyId, FontFamily>;
export const FONT_IDS = Object.keys(families) as FontFamilyId[];
export const TITLE_FONTS = FONT_IDS.filter((id) => FONT_FAMILIES[id].roles.includes('title'));
export const BODY_FONTS = FONT_IDS.filter((id) => FONT_FAMILIES[id].roles.includes('body'));

/** A concrete font file: family + the nearest weight that family ships. */
export type Face = { family: FontFamilyId; weight: number };

export const face = (family: FontFamilyId, wanted: number): Face => {
  const weights = Object.keys(FONT_FAMILIES[family].files).map(Number);
  const weight = weights.reduce((best, w) => (Math.abs(w - wanted) < Math.abs(best - wanted) || (Math.abs(w - wanted) === Math.abs(best - wanted) && w > best) ? w : best));
  return { family, weight };
};

export const faceKey = (f: Face): string => `${f.family}-${f.weight}`;
export const faceFile = (f: Face): string => FONT_FAMILIES[f.family].files[String(f.weight)];

type Metrics = Record<string, { cap: number; adv: Record<string, number> }>;
const metrics = metricsData as Metrics;

/** Cap height as a fraction of the font size. */
export const capHeight = (f: Face): number => (metrics[faceKey(f)]?.cap ?? 700) / 1000;

/** Width of a string in the same unit as `size`. `ls` is letter-spacing in em. */
export function measure(text: string, f: Face, size: number, ls = 0): number {
  const adv = metrics[faceKey(f)]?.adv ?? {};
  let em = 0;
  let n = 0;
  for (const ch of text) {
    em += (adv[ch] ?? 600) / 1000 + ls;
    n++;
  }
  return n ? (em - ls) * size : 0;
}

/** True if every character has a glyph in this face (otherwise the PDF would show a gap). */
export function supports(text: string, f: Face): boolean {
  const adv = metrics[faceKey(f)]?.adv ?? {};
  for (const ch of text) if (!(ch in adv)) return false;
  return true;
}

export function truncate(text: string, f: Face, size: number, ls: number, maxWidth: number): string {
  if (measure(text, f, size, ls) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 1 && measure(chars.join('').trimEnd() + '…', f, size, ls) > maxWidth) chars.pop();
  return chars.join('').trimEnd() + '…';
}
