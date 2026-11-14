// Playwright helpers: HTML pages to PNG, and the engine's SVG to high-resolution rasters.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Box } from './planner';

const require = createRequire(import.meta.url);
// Playwright is installed globally in this environment (no new npm dependency).
// Typed loosely: the package is not in this repo's node_modules, so its types are not either.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const { chromium } = require('playwright') as { chromium: { launch(opts?: object): Promise<any> } };

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

let fontCssCache = '';
/** fonts.css with every woff2 inlined as a data URI, so text renders the same everywhere. */
export function fontCss(): string {
  if (!fontCssCache) {
    const dir = path.join(ROOT, 'public/fonts');
    fontCssCache = readFileSync(path.join(dir, 'fonts.css'), 'utf8').replace(/url\("\/fonts\/([^"]+)"\)/g, (_m, f) => `url("data:font/woff2;base64,${readFileSync(path.join(dir, f)).toString('base64')}")`);
  }
  return fontCssCache;
}

type Browser = Awaited<ReturnType<typeof chromium.launch>>;
let browserP: Promise<Browser> | undefined;
export const browser = () => (browserP ??= chromium.launch({ args: ['--disable-dev-shm-usage'] }));
export async function closeBrowser() {
  if (browserP) await (await browserP).close();
  browserP = undefined;
}

let workDir = '';
export const setWork = (d: string) => { workDir = d; mkdirSync(d, { recursive: true }); };
let seq = 0;

/** Renders a full HTML document at w × h CSS px (× dsf) and writes a PNG. */
export async function shoot(html: string, w: number, h: number, out: string, opts: { dsf?: number; transparent?: boolean } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await shootOnce(html, w, h, out, opts);
    } catch (e) {
      if (attempt >= 2) throw e;
      console.warn(`retrying ${path.basename(out)}: ${(e as Error).message.split('\n')[0]}`);
      await closeBrowser();
    }
  }
}

async function shootOnce(html: string, w: number, h: number, out: string, opts: { dsf?: number; transparent?: boolean }) {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: opts.dsf ?? 1 });
  const page = await ctx.newPage();
  const file = path.join(workDir, `page-${seq++}.html`);
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })))));
  await page.screenshot({ path: out, omitBackground: !!opts.transparent });
  await ctx.close();
}

/** The SVG with its viewBox moved to a region (mm) and stretched to fill its box exactly. */
export function cropSvg(svg: string, b: Box): string {
  return svg
    .replace(/viewBox="[^"]*"/, `viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="none"`)
    .replace('<svg ', '<svg style="display:block;width:100%;height:100%" ');
}

export const page = (body: string, css = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}html,body{margin:0;padding:0}body{font-family:Poppins,sans-serif;-webkit-font-smoothing:antialiased}${css}</style></head><body>${body}</body></html>`;

/**
 * Rasterises a region of the planner at outW × outH px. Large outputs are rendered in tiles
 * (Chromium limits a single screenshot) and stitched by the caller's Python side via a list.
 * Returns the tile list: [{file, x, y, w, h}] in output pixels.
 */
export async function rasterPlanner(svg: string, b: Box, outW: number, outH: number, outBase: string) {
  const T = 4000;
  const tiles: { file: string; x: number; y: number; w: number; h: number }[] = [];
  const bw = await browser();
  const ctx = await bw.newContext({ viewport: { width: Math.min(T, outW), height: Math.min(T, outH) }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  const file = path.join(workDir, `raster-${seq++}.html`);
  const sx = b.w / outW;
  const sy = b.h / outH;
  for (let ty = 0; ty < outH; ty += T)
    for (let tx = 0; tx < outW; tx += T) {
      const w = Math.min(T, outW - tx);
      const h = Math.min(T, outH - ty);
      const sub = { x: b.x + tx * sx, y: b.y + ty * sy, w: w * sx, h: h * sy };
      writeFileSync(file, page(`<div style="width:${w}px;height:${h}px">${cropSvg(svg, sub)}</div>`));
      await pg.setViewportSize({ width: w, height: h });
      await pg.goto(pathToFileURL(file).href);
      await pg.evaluate(() => document.fonts.ready);
      const out = `${outBase}-${tx}-${ty}.png`;
      await pg.screenshot({ path: out });
      tiles.push({ file: out, x: tx, y: ty, w, h });
    }
  await ctx.close();
  return tiles;
}
