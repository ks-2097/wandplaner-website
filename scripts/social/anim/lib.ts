// Shared helpers for the animated reels (R01, R02): a Playwright page that stays open while
// frames are rendered, ffmpeg encoding and review strips. Planner content always comes from
// the engine (buildScene + renderSvg); nothing here draws a calendar.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildScene, renderSvg, sanitizeSpec, specSchema, type PlannerSpec } from '../../../src/planner';
import { ROOT, chromium, fontCss } from '../render';

export { ROOT };
export const W = 1080;
export const H = 1920;
export const FPS = 30;
/** Instagram safe area for on-screen text: top 250 px and bottom 380 px stay clear. */
export const SAFE = { top: 250, bottom: H - 380, left: 64, right: W - 64 };
export const BRAND = { lilac: '#d8cde6', aubergine: '#4b1650', ink: '#141414', surface: '#f7f4f9', muted: '#5a5260' };

export const SCRATCH = '/tmp/claude-0/-home-user-wandplaner-website/91d3c9ce-0d1b-5275-9186-e14752d544b6/scratchpad/social';

export function args() {
  const argv = process.argv.slice(2);
  const arg = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  return { arg, has: (n: string) => argv.includes(n) };
}

export function outDirs(reel: string, outRoot = path.join(SCRATCH, 'out')) {
  const out = path.resolve(outRoot, reel);
  if (out.startsWith(ROOT + path.sep)) throw new Error('outputs must not go into the repository');
  const work = path.resolve(outRoot, '..', 'work', reel);
  const frames = path.join(work, 'frames');
  rmSync(frames, { recursive: true, force: true });
  for (const d of [out, work, frames]) mkdirSync(d, { recursive: true });
  return { out, work, frames };
}

/** Validates a spec with the zod schema and makes sure the guardrails would not silently repair it. */
export function validSpec(spec: PlannerSpec, label = ''): PlannerSpec {
  const parsed = specSchema.safeParse(spec);
  if (!parsed.success) throw new Error(`invalid spec ${label}: ${parsed.error.message}`);
  const clean = sanitizeSpec(structuredClone(spec));
  if (JSON.stringify(clean.design) !== JSON.stringify(parsed.data.design)) throw new Error(`spec ${label} would be repaired by sanitizeSpec: ${JSON.stringify(clean.design.colors)}`);
  return parsed.data as PlannerSpec;
}

export function planner(spec: PlannerSpec, label = '') {
  const s = validSpec(spec, label);
  const scene = buildScene(s);
  if (scene.notes.length) console.warn(label, scene.notes);
  return { spec: s, scene, svg: renderSvg(scene) };
}

/** The engine's SVG without its outer element, to be placed inside another SVG in mm units. */
export const svgInner = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

export const htmlPage = (body: string, css = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}html,body{margin:0;padding:0;overflow:hidden}body{width:${W}px;height:${H}px;font-family:Poppins,sans-serif;-webkit-font-smoothing:antialiased}${css}</style></head><body>${body}</body></html>`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

/** One Chromium page at 1080 × 1920, deviceScaleFactor 1: every frame is rasterised from vectors at output size. */
export async function openStage(work: string, html: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const file = path.join(work, 'stage.html');
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(async () => {
    const fams = ['Poppins', 'Gloria Hallelujah', 'DM Serif Display', 'Abril Fatface', 'Archivo Black', 'Space Mono'];
    await Promise.all(fams.flatMap((f) => [400, 500, 600, 700].map((w) => document.fonts.load(`${w} 20px "${f}"`))));
    await document.fonts.ready;
  });
  return { page, close: () => b.close() };
}

export const framePath = (dir: string, i: number) => path.join(dir, `f${String(i).padStart(5, '0')}.png`);

/** H.264, yuv420p, 30 fps, CRF 18, +faststart; optional AAC 192k audio cut to `duration`. */
export function encode(frames: string, out: string, opts: { audio?: string; duration?: number } = {}) {
  const a = ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.png')];
  if (opts.audio) a.push('-i', opts.audio);
  a.push('-map', '0:v');
  if (opts.audio) a.push('-map', '1:a', '-c:a', 'aac', '-b:a', '192k');
  a.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart');
  if (opts.duration) a.push('-t', opts.duration.toFixed(6));
  a.push(out);
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
  const mb = statSync(out).size / 1e6;
  if (mb > 15) throw new Error(`${out} is ${mb.toFixed(1)} MB (limit 15)`);
  return mb;
}

/** Frame strip at 0, 10, 25, 50, 75, 90, 100 % for review. */
export function strip(video: string, out: string) {
  execFileSync('python3', [path.join(ROOT, 'scripts/social/anim/strip.py'), video, out], { stdio: 'inherit' });
}

export function cover(png: string, out: string) {
  execFileSync('python3', ['-c', `from PIL import Image;Image.open('${png}').convert('RGB').save('${out}',quality=92,subsampling=0)`]);
}
