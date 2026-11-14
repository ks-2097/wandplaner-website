// Builds every social media asset listed in marketing/posts.json.
//
//   npx tsx scripts/social/build.ts --out /path/to/social/out [--only P01,P02] [--no-video]
//
// Rooms and the flat lay are composited in scenes.py (multiply + paper mask, as
// scripts/mockup/flatten.py); sheets and zooms are the engine's own SVG; text is set in
// Poppins by Chromium. Nothing generated is written into the repository.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { LAYOUTS, MONTHS_DE, STATES, toDayNumber, type LayoutId, type StateCode } from '../../src/planner';
import { captureConfigurator } from './configurator';
import { keyId, plannerFor, region, summerLine, type Key } from './planner';
import { ROOT, closeBrowser, cropSvg, page, rasterPlanner, setWork, shoot } from './render';

const require = createRequire(import.meta.url);
const sharp = require('sharp') as typeof import('sharp').default;

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = path.resolve(arg('--out') ?? path.join(os.tmpdir(), 'plana-social', 'out'));
const ONLY = arg('--only')?.split(',');
const NO_VIDEO = argv.includes('--no-video');
if (OUT.startsWith(ROOT + path.sep)) throw new Error('outputs must not go into the repository');
const WORK = path.join(path.dirname(OUT), 'work');
const REVIEW = path.join(path.dirname(OUT), 'review');
for (const d of [OUT, WORK, REVIEW]) mkdirSync(d, { recursive: true });
setWork(path.join(WORK, 'html'));

// ---------------------------------------------------------------- brand
const C = { lilac: '#d8cde6', aubergine: '#4b1650', ink: '#141414', surface: '#f7f4f9', muted: '#5a5260' };

/**
 * On-image wording that is factually wrong in posts.json is corrected here (and reported);
 * posts.json itself is never written.
 */
const TEXT_FIXES: Record<string, { text: string; why: string }> = {
  'P06/4': {
    text: 'Geburtstage klein am Tag, gut lesbar aus der Nähe.',
    why: 'Labels are set at 2.0 mm (cap height 1.4 mm, 2.4 arcmin at 2 m); normal 20/20 vision needs about 2.9 mm caps at 2 m. "gut lesbar aus zwei Metern" is not true for birthday names.',
  },
};

// ---------------------------------------------------------------- formats (1× CSS px)
type Format = { name: string; w: number; h: number; visH: number; m: number; textTop: number; head: number; body: number; chip: number };
const FEED: Format = { name: 'feed', w: 1080, h: 1350, visH: 1000, m: 72, textTop: 1050, head: 56, body: 40, chip: 28 };
const STORY: Format = { name: 'story', w: 1080, h: 1920, visH: 1300, m: 72, textTop: 1364, head: 64, body: 40, chip: 28 };
const PIN: Format = { name: 'pin', w: 1000, h: 1500, visH: 1160, m: 64, textTop: 1206, head: 66, body: 30, chip: 30 };
const COVER: Format = { name: 'cover', w: 1080, h: 1920, visH: 1340, m: 72, textTop: 1396, head: 64, body: 40, chip: 28 };
const DSF = 2;

// Region of interest per scene, in scene pixels: the sheet with enough room around it to read as a room.
const ROI: Record<string, [number, number, number, number]> = {
  wohnzimmer: [520, 330, 1530, 1060],
  kueche: [470, 140, 1580, 1150],
  flur: [300, 170, 1500, 1700],
  flatlay: [0, 300, 1722, 1900],
};

// ---------------------------------------------------------------- visuals
type Visual =
  | { kind: 'room'; scene: 'wohnzimmer' | 'kueche' | 'flur' | 'flatlay'; key: Key }
  | { kind: 'sheet'; key: Key }
  | { kind: 'zoom'; key: Key; region: string }
  | { kind: 'card' }
  | { kind: 'placeholder' }
  | { kind: 'pushin'; scene: 'wohnzimmer' | 'kueche' | 'flur'; key: Key }
  | { kind: 'tryon'; scene: 'kueche' }
  | { kind: 'configurator' };

const isState = (s: string): s is StateCode => s in STATES;
const keyOf = (layout: string, edition: string, state: string): Key => {
  if (!LAYOUTS.some((l) => l.id === layout)) throw new Error(`unknown layout ${layout}`);
  if (!['aubergine', 'salbei', 'sand'].includes(edition)) throw new Error(`unknown edition ${edition}`);
  if (!isState(state)) throw new Error(`unknown state ${state}`);
  return { layout: layout as LayoutId, edition, state };
};
const checkScene = (scene: string, key: Key) => {
  const portrait = key.layout === 'spalten';
  if (portrait !== (scene === 'flur')) throw new Error(`${key.layout} cannot hang in ${scene}`);
};

function parseVisual(v: string): { story: boolean; vis: Visual } {
  const story = v.startsWith('story:');
  const p = (story ? v.slice(6) : v).split(':');
  switch (p[0]) {
    case 'room': { const key = keyOf(p[2], p[3], p[4]); checkScene(p[1], key); return { story, vis: { kind: 'room', scene: p[1] as 'wohnzimmer', key } }; }
    case 'flatlay': { const key = keyOf(p[1], p[2], p[3]); if (key.layout === 'spalten') throw new Error('flat lay is landscape only'); return { story, vis: { kind: 'room', scene: 'flatlay', key } }; }
    case 'sheet': return { story, vis: { kind: 'sheet', key: keyOf(p[1], p[2], p[3]) } };
    case 'zoom': return { story, vis: { kind: 'zoom', key: keyOf(p[1], p[2], p[3]), region: p[4] } };
    case 'card': return { story, vis: { kind: 'card' } };
    case 'photo-placeholder': return { story, vis: { kind: 'placeholder' } };
    case 'reel':
      if (p[1] === 'pushin') { const key = keyOf(p[3], p[4], p[5]); checkScene(p[2], key); return { story, vis: { kind: 'pushin', scene: p[2] as 'wohnzimmer', key } }; }
      if (p[1] === 'tryon') return { story, vis: { kind: 'tryon', scene: 'kueche' } };
      if (p[1] === 'configurator') return { story, vis: { kind: 'configurator' } };
  }
  throw new Error(`unknown visual ${v}`);
}

// ---------------------------------------------------------------- posts.json
type Slide = { visual: string; text: string; detail?: string; sticker?: string };
type OnScreen = { from: number; to: number; text: string };
type Post = { id: string; format: string; slides: Slide[]; needsPhoto?: string; onScreen?: OnScreen[] };
type Pin = { id: string; visual: string; text: string };
const brief = JSON.parse(readFileSync(path.join(ROOT, 'marketing/posts.json'), 'utf8')) as { posts: Post[]; pins: Pin[]; profile: { avatar: string; highlights: string[] } };

// ---------------------------------------------------------------- planner rasters + composites (Python)
type Tile = { file: string; x: number; y: number; w: number; h: number };
const rasters = new Map<string, { tiles: Tile[]; size: [number, number] }>();
async function raster(key: Key, pxPerMm: number) {
  const id = `${keyId(key)}@${pxPerMm}`;
  if (!rasters.has(id)) {
    const { scene, svg } = plannerFor(key);
    const w = Math.round(scene.width * pxPerMm);
    const h = Math.round(scene.height * pxPerMm);
    mkdirSync(path.join(WORK, 'raster'), { recursive: true });
    const base = path.join(WORK, 'raster', id);
    const tiles = await rasterPlanner(svg, { x: 0, y: 0, w: scene.width, h: scene.height }, w, h, base);
    rasters.set(id, { tiles, size: [w, h] });
  }
  return id;
}

type Job = Record<string, unknown> & { type: string; out: string };
function python(jobs: Job[]) {
  if (!jobs.length) return;
  const used = new Set<string>();
  for (const j of jobs) {
    if (typeof j.planner === 'string') used.add(j.planner);
    for (const s of (j.states as { planner: string }[] | undefined) ?? []) used.add(s.planner);
  }
  const file = path.join(WORK, `jobs-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ planners: Object.fromEntries([...used].map((k) => [k, rasters.get(k)])), jobs }));
  execFileSync('python3', [path.join(ROOT, 'scripts/social/scenes.py'), file], { stdio: 'inherit' });
}

/** Composites a room window for a format; returns the PNG path (rendered at DSF × the window). */
const roomCache = new Map<string, string>();
const roomJobs: Job[] = [];
async function roomWindow(scene: string, key: Key, w: number, h: number) {
  const id = `${scene}-${keyId(key)}-${w}x${h}`;
  if (!roomCache.has(id)) {
    const out = path.join(WORK, 'rooms', `${id}.png`);
    mkdirSync(path.dirname(out), { recursive: true });
    roomJobs.push({ type: 'still', scene, planner: await raster(key, 4), roi: ROI[scene], w: w * DSF, h: h * DSF, out });
    roomCache.set(id, out);
  }
  return roomCache.get(id)!;
}

// ---------------------------------------------------------------- HTML building blocks
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fileUrl = (p: string) => 'file://' + p;
const chip = (f: Format, pos: string) =>
  `<div style="position:absolute;${pos};background:${C.surface};color:${C.ink};font-size:${f.chip}px;font-weight:500;letter-spacing:0.01em;line-height:1;padding:12px 18px 13px">Visualisierung</div>`;
const wordmark = (size: number, color = C.ink) => `<span style="font-size:${size}px;letter-spacing:-0.03em;color:${color};white-space:nowrap"><b style="font-weight:700">plana</b> <span style="font-weight:400">studio</span></span>`;

function sheetBox(f: Format, key: Key, top: number, bottom: number) {
  const { scene, svg } = plannerFor(key);
  const w = f.w - 2 * f.m;
  const h = (w * scene.height) / scene.width;
  const y = Math.round(top + (bottom - top - h) / 2);
  return `<div style="position:absolute;left:${f.m}px;top:${y}px;width:${w}px;height:${h}px;outline:1px solid rgba(20,20,20,0.16)">${cropSvg(svg, { x: 0, y: 0, w: scene.width, h: scene.height })}</div>`;
}

/** A date named in the slide text ("Am 2. August"), as a 2027 day number. */
function namedDay(text: string): number | undefined {
  const m = text.match(/(\d{1,2})\.\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/);
  return m ? toDayNumber(2027, MONTHS_DE.indexOf(m[2]) + 1, Number(m[1])) : undefined;
}

async function visualHtml(f: Format, vis: Visual, text = ''): Promise<string> {
  const W = f.w;
  const H = f.visH;
  if (vis.kind === 'room') {
    const png = await roomWindow(vis.scene, vis.key, W, H);
    return `<img src="${fileUrl(png)}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px">` + chip(f, `right:24px;top:${H - 24 - f.chip - 25}px`);
  }
  if (vis.kind === 'zoom') {
    const { svg } = plannerFor(vis.key);
    const b = region(vis.key, vis.region, W / H, vis.region === 'ferien' ? namedDay(text) : undefined);
    return `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden">${cropSvg(svg, b)}</div>`;
  }
  if (vis.kind === 'sheet') return sheetBox(f, vis.key, f.name === 'story' ? 250 : 0, H);
  throw new Error(`no window for ${vis.kind}`);
}

function textHtml(f: Format, text: string, detail?: string) {
  return `<div style="position:absolute;left:${f.m}px;top:${f.textTop}px;width:${f.w - 2 * f.m}px">
    <div style="font-size:${f.head}px;line-height:1.18;font-weight:600;letter-spacing:-0.01em;color:${C.ink};text-wrap:balance">${esc(text)}</div>
    ${detail ? `<div style="margin-top:18px;font-size:${f.body}px;line-height:1.3;font-weight:400;color:${C.muted}">${esc(detail)}</div>` : ''}
  </div>`;
}

/** Card: the text is the message. Lilac, aubergine, large; small wordmark. */
function cardHtml(f: Format, text: string, opts: { sticker?: boolean } = {}) {
  const size = f.name === 'story' ? 84 : 84;
  if (f.name === 'story') {
    // Text sits below the top 250 px; the sticker goes under it; the wordmark stays above the bottom 300 px.
    return `<div style="position:absolute;left:${f.m}px;top:330px;width:${f.w - 2 * f.m}px;font-size:${size}px;line-height:1.1;font-weight:700;letter-spacing:-0.025em;color:${C.aubergine};text-wrap:balance" class="fit">${esc(text)}</div>
      <div style="position:absolute;left:${f.m}px;top:1560px">${wordmark(34, C.aubergine)}</div>`;
  }
  return `<div style="position:absolute;left:${f.m}px;top:${f.m}px">${wordmark(34, C.aubergine)}</div>
    <div style="position:absolute;left:${f.m}px;bottom:${f.h - 1258}px;width:${f.w - 2 * f.m}px;font-size:${size}px;line-height:1.1;font-weight:700;letter-spacing:-0.025em;color:${C.aubergine};text-wrap:balance" class="fit">${esc(text)}</div>`;
}

function placeholderHtml(f: Format, needs: string, text: string) {
  return `<div style="position:absolute;inset:0;background:${C.ink}"></div>
    <div style="position:absolute;left:${f.m}px;top:${f.name === 'story' ? 300 : f.m}px;width:${f.w - 2 * f.m}px;color:#fff">
      <div style="font-size:64px;line-height:1.1;font-weight:700;letter-spacing:-0.02em">Platzhalter.<br>Nicht posten.</div>
      <div style="margin-top:48px;font-size:38px;line-height:1.35;font-weight:400">Hier kommt ${/video/i.test(needs) ? 'ein echtes Video' : 'ein echtes Foto'} hin:</div>
      <div style="margin-top:12px;font-size:38px;line-height:1.35;font-weight:400;color:${C.lilac}">${esc(needs)}</div>
      <div style="margin-top:48px;font-size:38px;line-height:1.35;font-weight:400">Text auf dem Bild: „${esc(text)}“</div>
    </div>`;
}

// shrink .fit blocks until they fit their box (cards with long text)
const FIT_JS = `<script>
for (const el of document.querySelectorAll('.fit')) {
  let s = parseFloat(getComputedStyle(el).fontSize);
  const limit = el.dataset.maxh ? +el.dataset.maxh : (el.style.top === '330px' ? 780 : 1000);
  while (el.scrollHeight > limit && s > 60) { s -= 2; el.style.fontSize = s + 'px'; }
}
</script>`;

async function renderImage(f: Format, inner: string, bg: string, out: string) {
  const png = out.replace(/\.jpg$/, '.png');
  const html = page(`<div style="position:relative;width:${f.w}px;height:${f.h}px;overflow:hidden;background:${bg}">${inner}</div>${FIT_JS}`);
  await shoot(html, f.w, f.h, png, { dsf: DSF });
  await toJpeg(png, out, f.w, f.h);
  rmSync(png);
}

async function toJpeg(src: string, out: string, w: number, h: number) {
  for (const q of [90, 86, 82]) {
    await sharp(src).resize(w, h, { kernel: 'lanczos3' }).withIccProfile('srgb').jpeg({ quality: q, chromaSubsampling: '4:4:4' }).toFile(out);
    if (statSync(out).size < 1.5e6) { if (q !== 90) console.warn(`${out}: quality ${q} to stay under 1.5 MB`); return; }
  }
  throw new Error(`${out} is over 1.5 MB`);
}

// ---------------------------------------------------------------- manifest
type Entry = { file: string; width: number; height: number; kind: 'image' | 'video' | 'cover'; slide?: number; note?: string };
const manifest: Record<string, Entry[]> = {};
const add = (id: string, e: Entry) => (manifest[id] ??= []).push(e);
const fname = (id: string, n: number, ext: string) => `${id}-${String(n).padStart(2, '0')}.${ext}`;
const fixes: string[] = [];

// Deferred renders: room composites must exist before the pages that show them.
const pending: (() => Promise<void>)[] = [];
const videoTasks: (() => Promise<void>)[] = [];

async function slideImage(postId: string, n: number, f: Format, slide: Slide, vis: Visual, opts: { slideIndex?: number; needs?: string; note?: string } = {}) {
  const dir = path.join(OUT, postId.startsWith('PIN') ? 'pins' : postId);
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, fname(postId, n, 'jpg'));
  let text = slide.text;
  const fix = TEXT_FIXES[`${postId}/${opts.slideIndex}`];
  if (fix) { fixes.push(`${postId} slide ${opts.slideIndex}: "${text}" -> "${fix.text}" (${fix.why})`); text = fix.text; }
  const detail = slide.detail === 'summer' && 'key' in vis ? summerLine(vis.key.state) : slide.detail;
  let inner: string;
  let bg = C.surface;
  if (vis.kind === 'card') { inner = cardHtml(f, text, { sticker: !!slide.sticker }); bg = C.lilac; }
  else if (vis.kind === 'placeholder') inner = placeholderHtml(f, opts.needs ?? 'Foto', text);
  else {
    inner = (await visualHtml(f, vis, text)) + textHtml(f, text, detail);
    if (f.name === 'pin') inner += `<div style="position:absolute;left:${f.m}px;top:${f.h - f.m - 30}px;font-size:${f.chip}px;color:${C.muted};line-height:1">plana-planer.de</div>`;
  }
  add(postId, { file: path.relative(OUT, out), width: f.w, height: f.h, kind: 'image', ...(opts.slideIndex ? { slide: opts.slideIndex } : {}), ...(opts.note ? { note: opts.note } : {}) });
  pending.push(() => renderImage(f, inner, bg, out));
}

// ---------------------------------------------------------------- reels
const VID = { w: 1080, h: 1920 };
/** Transparent overlay PNG at video size: the Visualisierung chip (and an optional label). */
async function overlayPng(name: string, label?: string) {
  const f = { ...COVER, chip: 30 };
  const out = path.join(WORK, 'overlay', `${name}.png`);
  mkdirSync(path.dirname(out), { recursive: true });
  const chipCss = `background:${C.surface};color:${C.ink};font-size:30px;font-weight:500;line-height:1;padding:12px 18px 13px;position:absolute`;
  const inner = `<div style="${chipCss};right:40px;top:270px">Visualisierung</div>` + (label ? `<div style="${chipCss};left:40px;top:1530px;color:${C.aubergine};font-weight:600">${esc(label)}</div>` : '');
  await shoot(page(`<div style="position:relative;width:${f.w}px;height:${f.h}px">${inner}</div>`, 'html,body{background:transparent}'), VID.w, VID.h, out, { transparent: true });
  return out;
}

/**
 * Timed on-screen text as transparent layers. Lines whose times overlap stack like a chat: the
 * first is a small header, the others are messages. Cards sit bottom-left, above the bottom 380 px
 * and clear of the right-hand button column; the top 250 px stay free.
 */
async function textLayers(postId: string, items: OnScreen[]) {
  const stacks: OnScreen[][] = [];
  for (const it of items) {
    const st = stacks.find((g) => g.some((o) => o.from < it.to && it.from < o.to));
    if (st) st.push(it); else stacks.push([it]);
  }
  const layers: { png: string; from: number; to: number }[] = [];
  for (const [si, st] of stacks.entries())
    for (const [i, it] of st.entries()) {
      const header = st.length > 1 && i === 0;
      const cards = st.map((o, j) => {
        const small = st.length > 1 && j === 0;
        const style = small
          ? `font-size:34px;font-weight:500;color:${C.muted};padding:14px 24px 15px`
          : `font-size:54px;font-weight:600;letter-spacing:-0.01em;color:${C.aubergine};padding:20px 28px 24px`;
        return `<div style="${style};background:${C.surface};line-height:1.18;width:fit-content;max-width:860px;text-wrap:balance;visibility:${j === i ? 'visible' : 'hidden'}">${esc(o.text)}</div>`;
      }).join('');
      const out = path.join(WORK, 'overlay', `${postId}-text-${si}-${i}.png`);
      await shoot(page(`<div style="position:absolute;left:72px;bottom:400px;display:flex;flex-direction:column;gap:12px;align-items:flex-start">${cards}</div>`, 'html,body{background:transparent;width:1080px;height:1920px;position:relative}'), VID.w, VID.h, out, { transparent: true });
      layers.push({ png: out, from: it.from, to: it.to });
      void header;
    }
  return layers;
}

async function pushin(postId: string, vis: Extract<Visual, { kind: 'pushin' }>, onScreen?: OnScreen[]) {
  const dir = path.join(OUT, postId);
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, fname(postId, 1, 'mp4'));
  const { scene } = plannerFor(vis.key);
  // End on a calm, readable patch of days: about 190 mm of sheet across the frame.
  // wochen: March to August around Oma Inge's birthday, Pfingsten and the summer line;
  // spalten: July to September with the trip, the summer holidays and Mila's birthday.
  const end = vis.key.layout === 'wochen'
    ? { c: [583 / scene.width, 318 / scene.height], w: 190 / scene.width }
    : { c: [452 / scene.width, 520 / scene.height], w: 200 / scene.width };
  const start = { wohnzimmer: { c: [1024.7, 680], w: 765 }, flur: { c: [895.9, 1120], w: 1260 }, kueche: { c: [1021, 680], w: 765 } }[vis.scene];
  // With on-screen text (P04): hold the room while the chat line is read, push in under "Wir:",
  // arrive while "Steht an der Wand." comes up, then hold. Without text: an 11 s push.
  const seconds = onScreen?.length ? Math.max(12, ...onScreen.map((o) => o.to)) : 11;
  const move = onScreen?.length ? [3.3, seconds - 2.0] : [0.9, 9.0];
  const texts = onScreen?.length ? await textLayers(postId, onScreen) : [];
  const job: Job = { type: 'pushin', scene: vis.scene, planner: await raster(vis.key, 12), w: VID.w, h: VID.h, start, end, seconds, move, overlay: await overlayPng('chip'), texts, fade: 0.3, out };
  videoTasks.push(async () => python([job]));
  add(postId, { file: path.relative(OUT, out), width: VID.w, height: VID.h, kind: 'video' });
}

async function tryon(postId: string) {
  const dir = path.join(OUT, postId);
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, fname(postId, 1, 'mp4'));
  const seq: [Key, string][] = [
    [{ layout: 'zeilen', edition: 'salbei', state: 'NW' }, 'Salbei'],
    [{ layout: 'zeilen', edition: 'aubergine', state: 'NW' }, 'Aubergine'],
    [{ layout: 'zeilen', edition: 'sand', state: 'NW' }, 'Sand'],
    [{ layout: 'wochen', edition: 'sand', state: 'NW' }, 'Vier Wochen'],
    [{ layout: 'zeilen', edition: 'sand', state: 'NW' }, 'Monatszeilen'],
    [{ layout: 'zeilen', edition: 'sand', state: 'BY' }, 'Bayern'],
    [{ layout: 'zeilen', edition: 'sand', state: 'HH' }, 'Hamburg'],
  ];
  const states = [];
  for (let i = 0; i < seq.length; i++) {
    const [key, label] = seq[i];
    states.push({ planner: await raster(key, 6), overlay: await overlayPng(`tryon-${i}`, label), hold: i === 0 ? 1.5 : i === seq.length - 1 ? 1.9 : 1.15 });
  }
  // the kitchen wall in portrait: full photo height, centred on the sheet
  const job: Job = { type: 'tryon', scene: 'kueche', crop: [1021.3 - 382.5, 0, 765, 1360], w: VID.w, h: VID.h, states, fade: 0.4, out };
  videoTasks.push(async () => python([job]));
  add(postId, { file: path.relative(OUT, out), width: VID.w, height: VID.h, kind: 'video' });
}

async function cover(postId: string, n: number, text: string, vis: Visual, onScreen?: OnScreen[]) {
  const dir = path.join(OUT, postId);
  const out = path.join(dir, fname(postId, n, 'jpg'));
  let inner: string;
  if (vis.kind === 'pushin') inner = await visualHtml(COVER, { kind: 'room', scene: vis.scene, key: vis.key });
  else if (vis.kind === 'tryon') inner = await visualHtml(COVER, { kind: 'room', scene: 'kueche', key: { layout: 'zeilen', edition: 'salbei', state: 'NW' } });
  else {
    const shot = path.join(WORK, 'configurator', 'cover.png');
    inner = `<img src="${fileUrl(shot)}" style="position:absolute;left:0;top:0;width:${COVER.w}px;height:${COVER.visH}px;object-fit:cover;object-position:50% 0">`;
  }
  if (onScreen && onScreen.length > 1) {
    // The cover opens like the video: the chat header and the question, one size, header muted.
    const f = COVER;
    inner += `<div style="position:absolute;left:${f.m}px;top:${f.textTop}px;width:${f.w - 2 * f.m}px;font-size:${f.head}px;line-height:1.18;font-weight:600;letter-spacing:-0.01em;text-wrap:balance">
      <div style="color:${C.muted}">${esc(onScreen[0].text)}</div><div style="color:${C.ink}">${esc(onScreen[1].text)}</div></div>`;
  } else inner += textHtml(COVER, text);
  add(postId, { file: path.relative(OUT, out), width: COVER.w, height: COVER.h, kind: 'cover', note: 'Reel cover; the centre 1080 × 1440 is the grid crop.' });
  pending.push(() => renderImage(COVER, inner, C.surface, out));
}

// ---------------------------------------------------------------- profile
async function profile() {
  const dir = path.join(OUT, 'profile');
  mkdirSync(dir, { recursive: true });
  const av = path.join(dir, fname('avatar', 1, 'jpg'));
  const A = { name: 'avatar', w: 1080, h: 1080 } as Format;
  // Wordmark "plana" (site Wordmark: Poppins 700, letter-spacing -0.03em), lowercase, centred optically.
  pending.push(() => renderImage(A, `<div style="position:absolute;inset:0;display:grid;place-items:center"><div style="font-size:300px;font-weight:700;letter-spacing:-0.03em;color:${C.aubergine};line-height:1;transform:translateY(-14px)">plana</div></div>`, C.lilac, av));
  add('avatar', { file: path.relative(OUT, av), width: 1080, height: 1080, kind: 'image' });
  const S = { name: 'highlight', w: 1080, h: 1920 } as Format;
  brief.profile.highlights.forEach((label, i) => {
    const out = path.join(dir, fname('highlight', i + 1, 'jpg'));
    pending.push(() => renderImage(S, `<div style="position:absolute;left:0;top:420px;width:1080px;height:1080px;display:grid;place-items:center"><div style="font-size:150px;font-weight:600;letter-spacing:-0.02em;color:${C.aubergine};line-height:1">${esc(label)}</div></div>`, C.lilac, out));
    add('highlight', { file: path.relative(OUT, out), width: 1080, height: 1920, kind: 'image', note: label });
  });
}

// ---------------------------------------------------------------- main
async function main() {
  const want = (id: string) => !ONLY || ONLY.includes(id) || (ONLY.includes('pins') && id.startsWith('PIN')) || (ONLY.includes('profile') && (id === 'avatar' || id === 'highlight'));
  for (const post of brief.posts) {
    if (!want(post.id)) continue;
    let n = 1;
    for (const [i, slide] of post.slides.entries()) {
      const { story, vis } = parseVisual(slide.visual);
      if (vis.kind === 'pushin' || vis.kind === 'tryon' || vis.kind === 'configurator') {
        if (vis.kind === 'pushin') await pushin(post.id, vis, post.onScreen);
        else if (vis.kind === 'tryon') await tryon(post.id);
        else {
          const dir = path.join(OUT, post.id);
          mkdirSync(dir, { recursive: true });
          const out = path.join(dir, fname(post.id, 1, 'mp4'));
          videoTasks.unshift(() => captureConfigurator(path.join(WORK, 'configurator'), out));
          add(post.id, { file: path.relative(OUT, out), width: VID.w, height: VID.h, kind: 'video' });
        }
        await cover(post.id, 2, slide.text, vis, post.onScreen);
        n = 3;
        continue;
      }
      const f = story || post.format === 'story' ? STORY : FEED;
      if (vis.kind === 'card' && post.needsPhoto) {
        // P03: the text card is the post for now; a second file says which photo replaces it.
        await slideImage(post.id, n++, f, slide, vis, { slideIndex: i + 1, note: 'Ersatz-Textkarte, kann gepostet werden, bis das Foto da ist.' });
        await slideImage(post.id, n++, f, slide, { kind: 'placeholder' }, { needs: post.needsPhoto, note: 'Platzhalter: nicht posten. Zeigt, welches Foto Slide 1 ersetzt.' });
        continue;
      }
      await slideImage(post.id, n++, f, slide, vis, { slideIndex: i + 1, needs: post.needsPhoto, note: vis.kind === 'placeholder' ? 'Platzhalter: nicht posten, durch das echte Foto ersetzen.' : slide.sticker ? `Platz für: ${slide.sticker}` : undefined });
    }
  }
  for (const pin of brief.pins) {
    if (!want(pin.id)) continue;
    const { vis } = parseVisual(pin.visual);
    await slideImage(pin.id, 1, PIN, { visual: pin.visual, text: pin.text }, vis, { slideIndex: 1 });
  }
  if (want('avatar')) await profile();

  // Composites first (Python), then the pages, then video.
  python(roomJobs);
  for (const p of pending) await p();
  if (!NO_VIDEO) for (const v of videoTasks) await v();
  await closeBrowser();

  // keep frame strips out of the delivery folder
  for (const id of Object.keys(manifest)) {
    const dir = path.join(OUT, id.startsWith('PIN') ? 'pins' : ['avatar', 'highlight'].includes(id) ? 'profile' : id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (/-f\d{4}\.png$/.test(f)) { mkdirSync(path.join(REVIEW, 'frames'), { recursive: true }); execFileSync('mv', [path.join(dir, f), path.join(REVIEW, 'frames', f)]); }
  }

  // merge with an existing manifest so --only runs keep the rest
  const mf = path.join(OUT, 'manifest.json');
  const old = existsSync(mf) ? (JSON.parse(readFileSync(mf, 'utf8')).posts as Record<string, Entry[]>) : {};
  const all = { ...old, ...manifest };
  for (const [id, list] of Object.entries(all)) for (const e of list) if (!existsSync(path.join(OUT, e.file))) console.warn('missing', e.file);
  writeFileSync(mf, JSON.stringify({ generated: new Date().toISOString(), source: 'marketing/posts.json', posts: all }, null, 2));
  if (fixes.length) console.log('On-image text fixes:\n' + fixes.join('\n'));
  execFileSync('python3', [path.join(ROOT, 'scripts/social/contact.py'), OUT, REVIEW], { stdio: 'inherit' });
}

main().catch(async (e) => { await closeBrowser(); console.error(e); process.exit(1); });
