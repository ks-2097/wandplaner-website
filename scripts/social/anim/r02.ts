// R02 "Du entscheidest": the same planner changes one property per cut, every cut on a beat
// of marketing/audio/beat-120bpm.mp3. 24.03 s with the track.
//
//   npx tsx scripts/social/anim/r02.ts [--out <dir>]
//
// Beat times come from onset detection (beats.py), not from the nominal tempo. Every state is a
// spec validated with specSchema and rendered by the engine (buildScene + renderSvg).
import { execFileSync } from 'node:child_process';
import { linkSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FONT_FAMILIES, LAYOUTS, MONTHS_DE, STATES, TITLE_FONTS, defaultRegional, defaultSpec, editionById, type FontFamilyId, type PlannerSpec, type StateCode } from '../../../src/planner';
import { BRAND, FPS, H, ROOT, SAFE, W, args, cover, encode, framePath, htmlPage, openStage, outDirs, planner, strip } from './lib';

const { arg } = args();
const { out, work, frames } = outDirs('R02', arg('--out'));
const AUDIO = path.join(ROOT, 'marketing/audio/beat-120bpm.mp3');

// ------------------------------------------------------------------ beat grid
const beatsJson = path.join(work, 'beats.json');
execFileSync('python3', [path.join(ROOT, 'scripts/social/anim/beats.py'), AUDIO, beatsJson], { stdio: 'ignore' });
const beats = JSON.parse(readFileSync(beatsJson, 'utf8')) as { duration: number; bpm: number; beat_onsets: number[] };
const DUR = beats.duration;
const onsets = beats.beat_onsets;
if (onsets.length !== 48) throw new Error(`expected 48 beats, found ${onsets.length}`);
if (Math.abs(beats.bpm - 120) > 0.5) throw new Error(`tempo ${beats.bpm}`);

// ------------------------------------------------------------------ the states
type State = { beat: number; cat: string; value: string; spec: PlannerSpec; final?: boolean };
const PALETTES = {
  petrol: { name: 'Petrol', paper: '#d3e2e1', ink: '#141414', accent: '#0f4a4f' },
  mohn: { name: 'Mohn', paper: '#f3dfda', ink: '#141414', accent: '#8f2a1c' },
};
const clone = (s: PlannerSpec) => structuredClone(s);
let cur = defaultSpec({ layout: 'wochen', edition: 'aubergine', state: 'BE', start: { year: 2027, month: 1 } });
cur.birthdays = [
  { name: 'Oma Inge', day: 14, month: 3 },
  { name: 'Jonas', day: 1, month: 5 },
  { name: 'Mila', day: 22, month: 9 },
];
const steps: { cat: string; value: string; edit: (s: PlannerSpec) => void }[] = [];
const step = (cat: string, value: string, edit: (s: PlannerSpec) => void) => steps.push({ cat, value, edit });
const edition = (id: string) => (s: PlannerSpec) => { const e = editionById(id); s.edition = id; s.design.colors = { paper: e.paper, ink: e.ink, accent: e.accent }; };
const palette = (p: { paper: string; ink: string; accent: string }) => (s: PlannerSpec) => { s.design.colors = { paper: p.paper, ink: p.ink, accent: p.accent }; };
const state = (st: StateCode) => (s: PlannerSpec) => { s.state = st; s.calendars.school = [st]; s.calendars.regional = defaultRegional(st); };
const font = (f: FontFamilyId) => (s: PlannerSpec) => { s.design.title.font = f; };

// first 8 bars: two beats per change (16 states incl. the opening one)
step('Farbe', 'Aubergine', () => {});
step('Farbe', 'Salbei', edition('salbei'));
step('Farbe', 'Sand', edition('sand'));
step('Farbe', PALETTES.petrol.name, palette(PALETTES.petrol));
step('Farbe', PALETTES.mohn.name, palette(PALETTES.mohn));
step('Titel', '„Familie Berg 2027“', (s) => { s.design.title.text = 'Familie Berg 2027'; });
step('Schreibweise', 'Wie eingegeben', (s) => { s.design.title.case = 'asis'; });
step('Titel', '„unser jahr“', (s) => { s.design.title.text = 'unser jahr'; });
const fontOrder: FontFamilyId[] = ['gloria', 'spacemono', 'dmserif', 'abril', 'archivo'];
if (TITLE_FONTS.length !== fontOrder.length + 1 || !TITLE_FONTS.every((f) => f === 'poppins' || fontOrder.includes(f))) throw new Error(`title fonts changed: ${TITLE_FONTS}`);
for (const f of fontOrder) step('Schrift', FONT_FAMILIES[f].label, font(f));
step('Ausrichtung', 'Mittig', (s) => { s.design.title.align = 'center'; });
step('Layout', LAYOUTS.find((l) => l.id === 'zeilen')!.name, (s) => { s.layout = 'zeilen'; });
step('Layout', LAYOUTS.find((l) => l.id === 'spalten')!.name, (s) => { s.layout = 'spalten'; });
// the lift: one beat per change (12 states)
step('Layout', LAYOUTS.find((l) => l.id === 'wochen')!.name, (s) => { s.layout = 'wochen'; });
step('Ausrichtung', 'Links', (s) => { s.design.title.align = 'left'; });
step('Ferien', 'Unterstrichen', (s) => { s.design.schoolHolidays = 'underline'; });
step('Ferien', 'Band', (s) => { s.design.schoolHolidays = 'band'; });
step('Monatsnamen', 'Waagerecht', (s) => { s.design.monthLabel = 'horizontal'; });
step('Wochenenden', 'Kräftig', (s) => { s.design.shading = 0.2; });
step('Wochenenden', 'Zart', (s) => { s.design.shading = 0.05; });
step('Bundesland', STATES.BY, state('BY'));
step('Bundesland', STATES.SN, state('SN'));
step('Startmonat', `${MONTHS_DE[8]} 2027`, (s) => { s.start = { year: 2027, month: 9 }; });
step('Titelgröße', 'Groß', (s) => { s.design.title.scale = 1.25; });
step('Farbe', 'Aubergine', edition('aubergine'));

const stateList: State[] = [];
steps.forEach((st, i) => {
  st.edit(cur);
  cur = clone(cur);
  const beat = i < 16 ? i * 2 : 32 + (i - 16);
  stateList.push({ beat, cat: st.cat, value: st.value, spec: clone(cur) });
});
if (stateList.length !== 28 || stateList[27].beat !== 43) throw new Error(`sequence has ${stateList.length} states, last on beat ${stateList.at(-1)!.beat}`);
// last bar: hold the final design with the end line
stateList.push({ beat: 44, cat: '', value: '', spec: clone(cur), final: true });

// ------------------------------------------------------------------ pages
const mix = (a: string, b: string, t: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
// Layout of the frame: label (top of the safe area), the whole sheet at full safe width, and
// below it a 2.5× detail panel of the same SVG showing the title and the first rows.
const M = 48;
const BOX = { x: M, y: 368, w: W - 2 * M, h: 689 };
const PANEL = { x: M, y: BOX.y + BOX.h + 22, w: W - 2 * M, h: SAFE.bottom - (BOX.y + BOX.h + 22) };
const ZOOM = 2.5;
function pageFor(s: State) {
  const { scene, svg } = planner(s.spec, `${s.cat} ${s.value}`);
  const { paper, accent } = s.spec.design.colors;
  const bg = mix(paper, '#ffffff', 0.62);
  const k = Math.min(BOX.w / scene.width, BOX.h / scene.height);
  const w = Math.round(scene.width * k), h = Math.round(scene.height * k);
  const sx = BOX.x + (BOX.w - w) / 2, sy = BOX.y + (BOX.h - h) / 2;
  // detail region in mm: from just above the title down through the first rows, placed where the title is anchored
  const pk = k * ZOOM;
  const rw = PANEL.w / pk, rh = PANEL.h / pk;
  const align = s.spec.design.title.align;
  const rx = align === 'left' ? 18 : align === 'center' ? (scene.width - rw) / 2 : scene.width - 18 - rw;
  const ry = 22;
  const sized = (v: string, ww: number, hh: number) => v.replace('<svg ', `<svg width="${ww}" height="${hh}" style="display:block" `);
  const detail = sized(svg.replace(/viewBox="[^"]*"/, `viewBox="${rx} ${ry} ${rw} ${rh}"`), PANEL.w, PANEL.h);
  const label = s.final
    ? `<div class="end">Du entscheidest.</div><div class="url" style="color:${accent}">plana-planer.de</div>`
    : `<div class="label"><div class="cat">${s.cat}</div><div class="val" style="color:${accent}">${s.value}</div></div>`;
  return {
    html: htmlPage(
      `<div class="card" style="left:${sx}px;top:${sy}px;width:${w}px;height:${h}px">${sized(svg, w, h)}</div>
       <div class="mark" style="left:${sx + rx * k}px;top:${sy + ry * k}px;width:${rw * k}px;height:${rh * k}px;border-color:${accent}"></div>
       <div class="card" style="left:${PANEL.x}px;top:${PANEL.y}px;width:${PANEL.w}px;height:${PANEL.h}px">${detail}</div>${label}`,
      `body{background:${bg}}
       .card{position:absolute;overflow:hidden;box-shadow:0 1px 3px rgba(20,20,20,.07),0 14px 36px rgba(20,20,20,.10)}
       .mark{position:absolute;border:2px solid;opacity:.55;box-sizing:border-box}
       .label{position:absolute;left:0;right:0;top:${SAFE.top + 6}px;text-align:center}
       .cat{font:500 26px/1 Poppins;letter-spacing:.02em;color:${BRAND.muted}}
       .val{margin-top:10px;font:600 48px/1.1 Poppins;letter-spacing:-0.02em}
       .end{position:absolute;left:0;right:0;top:${SAFE.top + 2}px;text-align:center;font:600 58px/1.1 Poppins;letter-spacing:-0.02em;color:${BRAND.ink}}
       .url{position:absolute;left:0;right:0;top:${SAFE.top + 74}px;text-align:center;font:500 32px/1 Poppins;letter-spacing:-0.01em}`,
    ),
    bottom: PANEL.y + PANEL.h,
  };
}

(async () => {
  const pngs: string[] = [];
  const { page, close } = await openStage(work, htmlPage(''));
  for (const [i, s] of stateList.entries()) {
    const { html, bottom } = pageFor(s);
    if (bottom > SAFE.bottom) throw new Error(`state ${i} reaches into the bottom safe area`);
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const png = path.join(work, `state-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: png });
    pngs.push(png);
  }
  await close();

  // ---- frames: state k from the frame nearest to its beat's detected attack
  const N = Math.round(DUR * FPS);
  const startFrame = stateList.map((s) => (s.beat === 0 ? 0 : Math.round(onsets[s.beat] * FPS)));
  const rows: string[] = ['state  beat  attack(s)  cut frame  cut time(s)  error(ms)  error(frames)  change'];
  let maxErr = 0;
  stateList.forEach((s, k) => {
    const f = startFrame[k];
    const err = s.beat === 0 ? 0 : f / FPS - onsets[s.beat];
    if (s.beat) maxErr = Math.max(maxErr, Math.abs(err));
    rows.push(`${String(k).padStart(5)}  ${String(s.beat).padStart(4)}  ${onsets[s.beat].toFixed(3).padStart(9)}  ${String(f).padStart(9)}  ${(f / FPS).toFixed(3).padStart(11)}  ${(err * 1000).toFixed(1).padStart(9)}  ${(err * FPS).toFixed(2).padStart(13)}  ${s.final ? 'end: Du entscheidest. / plana-planer.de' : `${s.cat}: ${s.value}`}`);
  });
  rows.push(`max |error| = ${(maxErr * 1000).toFixed(1)} ms = ${(maxErr * FPS).toFixed(2)} frames; duration ${DUR.toFixed(3)} s = ${N} frames; detected tempo ${beats.bpm.toFixed(2)} BPM`);
  if (maxErr * FPS > 1) throw new Error('a cut is more than one frame off its beat');
  writeFileSync(path.join(out, 'cuts.txt'), rows.join('\n') + '\n');
  console.log(rows.join('\n'));
  for (let f = 0, k = 0; f < N; f++) {
    while (k + 1 < startFrame.length && f >= startFrame[k + 1]) k++;
    linkSync(pngs[k], framePath(frames, f));
  }

  const video = path.join(out, 'R02-du-entscheidest.mp4');
  const mb = encode(frames, video, { audio: AUDIO, duration: DUR });
  cover(pngs[pngs.length - 1], path.join(out, 'R02-cover.jpg'));
  strip(video, path.join(out, 'R02-strip.png'));
  // the muxed audio, analysed again: the beat grid must not have moved
  execFileSync('python3', [path.join(ROOT, 'scripts/social/anim/beats.py'), video, path.join(work, 'beats-muxed.json')], { stdio: 'ignore' });
  const muxed = JSON.parse(readFileSync(path.join(work, 'beats-muxed.json'), 'utf8')) as { beat_onsets: number[] };
  const drift = Math.max(...muxed.beat_onsets.slice(0, 48).map((o, i) => Math.abs(o - onsets[i])));
  console.log(`${video} ${mb.toFixed(2)} MB; muxed audio beat drift max ${(drift * 1000).toFixed(1)} ms`);
  writeFileSync(path.join(out, 'cuts.txt'), rows.join('\n') + `\nmuxed audio: beat attacks re-detected in the MP4, max drift ${(drift * 1000).toFixed(1)} ms\n`);
})().catch((e) => { console.error(e); process.exit(1); });
