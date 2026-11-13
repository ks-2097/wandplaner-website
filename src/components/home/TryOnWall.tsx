'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type MouseEvent } from 'react';
import { EDITIONS, editionById } from '@/planner/editions';
import { STATES, defaultRegional, type StateCode } from '@/planner/holidays';
import { LAYOUTS } from '@/planner/layout';
import type { LayoutId, PlannerSpec } from '@/planner/spec';
import { plannerSvg } from '../PlannerSvg';
import { RoomStage, type Scene } from '../RoomStage';

type Choice = { layout: LayoutId; edition: string; state: StateCode };

const ROOM: Record<LayoutId, Scene> = { wochen: 'kueche', zeilen: 'kueche', spalten: 'flur' };

const ALT: Record<Scene, (what: string) => string> = {
  wohnzimmer: (w) => `${w} über einem Eichen-Sideboard in einem hellen Wohnzimmer.`,
  kueche: (w) => `${w} an der Küchenwand über einer Holzbank, mit Klebeband befestigt. Davor ein Esstisch mit Mandarinen, Kaffeetasse und Buntstiften.`,
  flur: (w) => `${w} im Flur zwischen Garderobe und Tür, mit zwei Klammern aufgehängt. Darunter eine Holzbank mit Gummistiefeln und einer Stofftasche.`,
};

/** Apply a choice to a spec: layout, the edition's colours, and the Bundesland with its holidays. */
function applyChoice(spec: PlannerSpec, c: Choice): PlannerSpec {
  const e = editionById(c.edition);
  const second = spec.calendars.school.filter((s) => s !== spec.state && s !== c.state);
  return {
    ...spec,
    layout: c.layout,
    edition: e.id,
    state: c.state,
    design: { ...spec.design, colors: { paper: e.paper, ink: e.ink, accent: e.accent } },
    calendars: { ...spec.calendars, school: [c.state, ...second].slice(0, 2), regional: defaultRegional(c.state) },
  };
}

/**
 * "Try it on the wall": choose edition, Bundesland and layout and the planner on the wall is
 * redrawn by the real engine. Landscape layouts hang in the kitchen, the portrait one in the hall.
 * Without JavaScript both rooms are shown side by side (see .tryon in globals.css).
 */
export function TryOnWall({ base }: { base: PlannerSpec }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>({ layout: 'zeilen', edition: 'salbei', state: base.state });
  // The landscape layout last shown in the kitchen, so it stays put while the hall is chosen.
  const [quer, setQuer] = useState<LayoutId>('zeilen');
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Choice>) => {
    setChoice((c) => ({ ...c, ...patch }));
    if (patch.layout && patch.layout !== 'spalten') setQuer(patch.layout);
  };

  const kitchen = useMemo(() => plannerSvg(applyChoice(base, { ...choice, layout: quer })), [base, choice, quer]);
  const hall = useMemo(() => plannerSvg(applyChoice(base, { ...choice, layout: 'spalten' })), [base, choice]);
  const edition = editionById(choice.edition);
  const active = ROOM[choice.layout];
  const layoutName = (id: LayoutId) => LAYOUTS.find((l) => l.id === id)!.name;
  const what = (id: LayoutId) => `Der Wandplaner ${layoutName(id)} in ${edition.name} mit den Ferien von ${STATES[choice.state]}`;

  // Carries the choice into the configurator through its stored draft. Anything already in the
  // draft (birthdays, calendars, title, fonts) is kept; only layout, colours and Bundesland change.
  const carry = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const [{ loadDraft, saveDraft }, { defaultSpec }] = await Promise.all([import('../draft'), import('@/planner/spec')]);
      const draft = loadDraft();
      const spec = applyChoice(draft?.spec ?? defaultSpec({ state: choice.state }), choice);
      saveDraft({ spec, calNames: draft?.calNames ?? {} });
    } catch {
      // Without storage the configurator simply starts from its defaults.
    }
    router.push('/gestalten');
  };

  const stages: { scene: Scene; layout: LayoutId; svg: ReturnType<typeof plannerSvg>; sizes: string }[] = [
    { scene: 'kueche', layout: quer, svg: kitchen, sizes: '(min-width: 1040px) 680px, (min-width: 900px) 58vw, 100vw' },
    { scene: 'flur', layout: 'spalten', svg: hall, sizes: '(min-width: 1040px) 520px, (min-width: 900px) 30vw, 100vw' },
  ];

  return (
    <div className="tryon">
      <div className="tryon-stage">
        {stages.map((s) => (
          <RoomStage
            key={s.scene}
            className={`room-${s.scene}`}
            scene={s.scene}
            svg={s.svg.html}
            sheetSize={s.svg}
            alt={ALT[s.scene](what(s.layout))}
            sizes={s.sizes}
            caption={`${layoutName(s.layout)} · ${edition.name}`}
            active={s.scene === active}
          />
        ))}
      </div>

      <div className="tryon-controls" role="group" aria-labelledby="tryon-title">
        <p className="label" id="tryon-title">Probier ihn an der Wand aus</p>
        <fieldset className="tryon-field">
          <legend className="small">Edition</legend>
          <div className="tryon-swatches">
            {EDITIONS.map((e) => (
              <button key={e.id} type="button" className="tryon-swatch" aria-pressed={choice.edition === e.id} onClick={() => set({ edition: e.id })}>
                <span className="chip" style={{ background: e.paper, color: e.accent }} aria-hidden="true">
                  <i style={{ background: e.accent }} />
                </span>
                {e.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="tryon-field">
          <legend className="small">Layout</legend>
          <div className="tryon-seg">
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button" aria-pressed={choice.layout === l.id} onClick={() => set({ layout: l.id })}>
                {l.name}
                <span className="small">{l.orientation === 'hoch' ? 'hoch, im Flur' : 'quer, in der Küche'}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field tryon-field">
          <span className="small">Bundesland, für Ferien und Feiertage</span>
          <select className="input" value={choice.state} onChange={(e) => set({ state: e.target.value as StateCode })}>
            {(Object.keys(STATES) as StateCode[]).map((code) => (
              <option key={code} value={code}>{STATES[code]}</option>
            ))}
          </select>
        </label>
        <p className="tryon-now small" aria-live="polite">
          An der Wand: {layoutName(choice.layout)} in {edition.name}, mit den Ferien von {STATES[choice.state]}.
        </p>
        <p>
          <a className="btn secondary" href="/gestalten" onClick={carry} aria-busy={busy}>Mit dieser Auswahl gestalten</a>
        </p>
      </div>
    </div>
  );
}
