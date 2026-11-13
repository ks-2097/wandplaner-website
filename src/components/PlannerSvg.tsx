// Imports come straight from the engine modules (not '@/planner'), so a client component that
// draws a planner does not pull the spec validation (zod) into the browser bundle.
import { buildScene } from '@/planner/layout';
import type { PlannerSpec } from '@/planner/spec';
import { renderSvg } from '@/planner/svg';

/** The planner as SVG markup plus its trim size in mm. Works on the server and in the browser. */
export function plannerSvg(spec: PlannerSpec, label?: string): { html: string; width: number; height: number } {
  const scene = buildScene(spec);
  return { html: renderSvg(scene, { title: label, className: 'planner' }), width: scene.width, height: scene.height };
}

/**
 * The planner, drawn by the same layout engine that makes the print file.
 * Works on the server and in the browser.
 */
export function PlannerSvg({ spec, label }: { spec: PlannerSpec; label?: string }) {
  const svg = plannerSvg(spec, label);
  return <div className="sheet" style={{ aspectRatio: `${svg.width} / ${svg.height}` }} dangerouslySetInnerHTML={{ __html: svg.html }} />;
}
