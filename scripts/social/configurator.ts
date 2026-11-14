// Screen capture of /gestalten on a phone viewport for the P11 reel.
//
// Deterministic: every output frame is a screenshot taken after the page was put into that exact
// state (scroll position, tap dot opacity, typed characters), so motion is smooth at 30 fps no
// matter how long a screenshot takes. The app must be running (npm run build && npx next start -p 3123).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from './render';

const require = createRequire(import.meta.url);
const sharp = require('sharp') as typeof import('sharp').default;

const URL_ = process.env.PLANA_URL ?? 'http://localhost:3123/gestalten';
const FPS = 30;
const VW = 390;
const VH = 694; // 390 × 694 at device scale 3 = 1170 × 2082, scaled to 1080 × 1922 and trimmed to 1920
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function captureConfigurator(work: string, out: string) {
  mkdirSync(work, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.evaluate('document.fonts.ready');
  // A calm tap marker, drawn by the page itself so it is part of the capture.
  await page.addStyleTag({ content: '#tapdot{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(75,22,80,.28);border:2px solid rgba(75,22,80,.55);pointer-events:none;z-index:99;opacity:0} html{scroll-behavior:auto!important}' });
  await page.evaluate(`document.body.insertAdjacentHTML('beforeend','<div id="tapdot"></div>')`);

  const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1920', '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let frames = 0;
  let last: Buffer | undefined;
  const write = (buf: Buffer) => new Promise<void>((res) => { frames++; if (!enc.stdin.write(buf)) enc.stdin.once('drain', () => res()); else res(); });
  const shot = async () => {
    const png = await page.screenshot();
    last = await sharp(png).resize(1080, 1922, { kernel: 'lanczos3' }).extract({ left: 0, top: 1, width: 1080, height: 1920 }).removeAlpha().raw().toBuffer();
    await write(last);
  };
  const hold = async (sec: number) => {
    await page.waitForTimeout(250);
    await shot();
    for (let i = 1; i < Math.round(sec * FPS); i++) await write(last!);
  };
  const scrollY = () => page.evaluate('scrollY') as Promise<number>;
  const scrollTo = async (y: number, sec: number) => {
    const y0 = await scrollY();
    const max = (await page.evaluate('document.documentElement.scrollHeight - innerHeight')) as number;
    const y1 = Math.max(0, Math.min(max, y));
    const n = Math.round(sec * FPS);
    for (let i = 1; i <= n; i++) {
      await page.evaluate(`scrollTo(0, ${y0 + (y1 - y0) * ease(i / n)})`);
      await shot();
    }
  };
  /** Document y of an element's top. */
  const top = async (sel: string) => (await page.locator(sel).first().evaluate('(e) => e.getBoundingClientRect().top + scrollY')) as number;
  const dot = (x: number, y: number, o: number) => page.evaluate(`(() => { const d = document.getElementById('tapdot'); d.style.left='${x}px'; d.style.top='${y}px'; d.style.opacity='${o}'; })()`);
  /** Tap: the dot fades in, the action happens, the dot fades out while the page reacts. */
  const tap = async (sel: string, action?: () => Promise<unknown>) => {
    const el = page.locator(sel).first();
    const r = (await el.boundingBox())!;
    const x = r.x + Math.min(r.width / 2, 60);
    const y = r.y + r.height / 2;
    for (let i = 1; i <= 5; i++) { await dot(x, y, i / 5); await shot(); }
    await (action ? action() : el.click());
    await page.waitForTimeout(200);
    for (let i = 1; i <= 9; i++) { await dot(x, y, 1 - i / 9); await shot(); }
  };
  const type = async (text: string) => {
    for (const ch of text) {
      await page.keyboard.type(ch);
      await page.waitForTimeout(40);
      await shot(); await shot(); await shot(); await shot();
    }
  };

  // 1 · the page with the default planner
  await hold(1.6);
  // 2 · layout: Monatszeilen, with the preview still in view
  await scrollTo(250, 1.0);
  await hold(0.4);
  await tap('.option:nth-child(2)');
  await hold(1.4);
  // 3 · colour: Salbei, then back up to see it
  await scrollTo((await top('.swatches')) - 300, 0.9);
  await hold(0.3);
  await tap('.swatch:nth-child(2) .chip');
  await hold(0.5);
  await scrollTo(230, 0.9);
  await hold(1.3);
  // 4 · Bundesland: Bayern
  await scrollTo((await top('select.input >> nth=1')) - 330, 1.1);
  await hold(0.3);
  await tap('select.input >> nth=1', () => page.locator('select.input').nth(1).selectOption('BY'));
  await hold(0.9);
  // 5 · one birthday
  await scrollTo((await top('summary:has-text("Geburtstage")')) - 260, 0.8);
  await tap('summary:has-text("Geburtstage")');
  await hold(0.3);
  await tap('button:has-text("Geburtstag eintragen")');
  await page.locator('.bday input[aria-label="Name"]').first().focus();
  await hold(0.2);
  await type('Oma Inge');
  await tap('.bday input[aria-label="Tag"]');
  await type('14');
  await tap('.bday input[aria-label="Monat"]');
  await type('3');
  await page.evaluate('document.activeElement && document.activeElement.blur()');
  await hold(0.8);
  // 6 · back to the preview, then closer to the day
  await scrollTo(0, 1.4);
  await hold(0.8);
  await scrollTo(120, 0.6);
  // cover still: the finished preview in view
  writeFileSync(path.join(work, 'cover.png'), await page.screenshot());
  await hold(0.9);
  await tap('button:has-text("Details vergrößern")');
  await hold(0.4);
  // scroll the zoomed viewer to the birthday, smoothly
  const target = (await page.evaluate(`(() => {
    const v = document.querySelector('.viewer');
    const t = [...v.querySelectorAll('text')].find((e) => e.textContent === 'OMA INGE');
    const vb = v.getBoundingClientRect(), tb = t.getBoundingClientRect();
    return [v.scrollLeft + tb.left - vb.left - vb.width / 2 + tb.width / 2, v.scrollTop + tb.top - vb.top - vb.height / 2];
  })()`)) as [number, number];
  const n = Math.round(1.6 * FPS);
  for (let i = 1; i <= n; i++) {
    const k = ease(i / n);
    await page.evaluate(`(() => { const v = document.querySelector('.viewer'); v.scrollLeft = ${target[0] * k}; v.scrollTop = ${Math.max(0, target[1]) * k}; })()`);
    await shot();
  }
  await hold(2.6);

  enc.stdin.end();
  await new Promise((res) => enc.on('close', res));
  const bad = (await page.evaluate(`document.body.innerText.match(/noch nicht eingerichtet|Fehler|nicht geklappt/g)`)) as string[] | null;
  await b.close();
  if (bad) throw new Error('error text on the configurator page: ' + bad.join(', '));
  console.log(`configurator: ${frames} frames, ${(frames / FPS).toFixed(1)} s`);
}
