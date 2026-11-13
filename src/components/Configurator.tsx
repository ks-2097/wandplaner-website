'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BODY_FONTS, EDITIONS, FONT_FAMILIES, LAYOUTS, MONTHS_DE, STATES, STATE_CODES, TITLE_FONTS, buildScene, defaultRegional, defaultSpec, defaultTitle, fromDayNumber, iso,
  plannerRange, regionalHolidaysFor, renderSvg, type Birthday, type Design, type FontFamilyId, type LayoutId, type PlannerEvent, type PlannerSpec, type StateCode,
} from '@/planner';
import { loadDraft, saveDraft } from './draft';

type Row = { name: string; day: string; month: string; unsure?: boolean };
type Tone = 'ok' | 'error' | undefined;
type Msg = { text: string; tone?: Tone };

const START_OPTIONS = [{ year: 2026, month: 12 }, ...Array.from({ length: 12 }, (_, i) => ({ year: 2027, month: i + 1 }))];
const LEAGUES = { bl1: '1. Bundesliga', bl2: '2. Bundesliga', bl3: '3. Liga' };

const toRows = (list: Birthday[]): Row[] => list.map((b) => ({ name: b.name, day: String(b.day), month: String(b.month) }));
const fromRows = (rows: Row[]): Birthday[] =>
  rows
    .map((r) => ({ name: r.name.trim().slice(0, 24), day: Number(r.day), month: Number(r.month) }))
    .filter((b) => b.name && Number.isInteger(b.day) && Number.isInteger(b.month) && b.month >= 1 && b.month <= 12 && b.day >= 1 && b.day <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][b.month - 1]);

async function postJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init).catch(() => undefined);
  const data = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok) throw new Error((data as { error?: string }).error ?? 'Das hat nicht geklappt. Bitte prüf deine Verbindung und versuch es noch einmal.');
  return data as T;
}

export function Configurator({ assistant }: { assistant: boolean }) {
  const [spec, setSpec] = useState<PlannerSpec>(() => defaultSpec());
  const [rows, setRows] = useState<Row[]>([]);
  const [calNames, setCalNames] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<PlannerSpec[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(false);

  // Restore the draft from this browser, once.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setSpec(draft.spec);
      setRows(toRows(draft.spec.birthdays));
      setCalNames(draft.calNames);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) saveDraft({ spec, calNames });
  }, [spec, calNames, loaded]);

  const change = (fn: (s: PlannerSpec) => void) =>
    setSpec((old) => {
      const next = structuredClone(old);
      fn(next);
      return next;
    });
  const design = (fn: (d: Design) => void) => change((s) => { fn(s.design); s.edition = 'eigenes'; });
  const setBirthdayRows = (next: Row[]) => {
    setRows(next);
    change((s) => { s.birthdays = fromRows(next); });
  };

  const deferred = useDeferredValue(spec);
  const scene = useMemo(() => buildScene(deferred), [deferred]);
  const svg = useMemo(() => renderSvg(scene, { title: 'Vorschau deines Planers', className: 'planner' }), [scene]);
  const range = plannerRange(spec);
  const [fromIso, toIso] = [iso(fromDayNumber(range.from)), iso(fromDayNumber(range.to))];
  const d = spec.design;

  // ---- Calendars
  const sources = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of spec.events) m.set(e.source ?? 'manual', (m.get(e.source ?? 'manual') ?? 0) + 1);
    return [...m.entries()];
  }, [spec.events]);
  const outOfRange = spec.events.filter((e) => (e.end ?? e.start) < fromIso || e.start > toIso).length;

  const addEvents = (events: PlannerEvent[], name: string) => {
    const source = events[0]?.source ?? 'manual';
    setCalNames((n) => ({ ...n, [source]: name }));
    change((s) => { s.events = [...s.events.filter((e) => (e.source ?? 'manual') !== source || source === 'manual'), ...events].slice(0, 600); });
  };

  return (
    <div className="wrap config">
      <div className="stage">
        <div className={`viewer${zoom ? ' zoomed' : ''}${scene.height > scene.width ? ' portrait' : ''}`} onClick={() => setZoom((z) => !z)} title={zoom ? 'Verkleinern' : 'Vergrößern'}>
          <div className="sheet" style={{ aspectRatio: `${scene.width} / ${scene.height}` }} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <div className="caption">
          <span className="label">Vorschau · {scene.width / 10} × {scene.height / 10} cm · so wird gedruckt</span>
          <button type="button" className="linkbtn" onClick={() => setZoom((z) => !z)}>{zoom ? 'Ganzes Blatt zeigen' : 'Details vergrößern'}</button>
        </div>
        {scene.notes.length > 0 && (
          <div className="note" role="status">
            {scene.notes.map((n) => <p key={n}>{n}</p>)}
          </div>
        )}
        {assistant && (
          <Assistant
            enabled={assistant}
            spec={spec}
            canUndo={undo.length > 0}
            onResult={(next) => { setUndo((u) => [...u.slice(-9), spec]); setSpec(next); }}
            onUndo={() => { const last = undo[undo.length - 1]; if (last) { setSpec(last); setUndo((u) => u.slice(0, -1)); } }}
          />
        )}
      </div>

      <div>
        <div className="controls">
          <Section title="Layout" open>
            <div className="options" role="radiogroup" aria-label="Layout">
              {LAYOUTS.map((l) => (
                <label className="option" key={l.id}>
                  <input type="radio" name="layout" checked={spec.layout === l.id} onChange={() => change((s) => { s.layout = l.id; })} />
                  <span className="thumb"><LayoutThumb id={l.id} /></span>
                  <span>
                    <span className="h3">{l.name}</span> <span className="label">{l.orientation === 'quer' ? 'Querformat' : 'Hochformat'}</span>
                    <span className="small" style={{ display: 'block' }}>{l.summary}</span>
                  </span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Farben" open>
            <div className="swatches" role="radiogroup" aria-label="Edition">
              {EDITIONS.map((e) => (
                <label className="swatch" key={e.id}>
                  <input type="radio" name="edition" checked={spec.edition === e.id} onChange={() => change((s) => { s.edition = e.id; s.design.colors = { paper: e.paper, ink: e.ink, accent: e.accent }; })} />
                  <span className="chip" style={{ background: e.paper, color: e.accent }}>27</span>
                  {e.name}
                </label>
              ))}
            </div>
            <div className="colors">
              {([['paper', 'Papier'], ['accent', 'Akzent'], ['ink', 'Zahlen']] as const).map(([key, label]) => (
                <label className="field" key={key}>
                  <span className="label">{label}</span>
                  <input type="color" value={d.colors[key]} onChange={(e) => design((x) => { x.colors[key] = e.target.value; })} />
                </label>
              ))}
            </div>
            <p className="small">Eigene Farben prüfen wir auf Lesbarkeit. Zu schwache Kontraste gleichen wir beim Bestellen aus.</p>
          </Section>

          <Section title="Zeitraum und Bundesland" open>
            <div className="grid-2">
              <label className="field">
                <span className="label">Beginnt im</span>
                <select className="input" value={`${spec.start.year}-${spec.start.month}`} onChange={(e) => {
                  const [year, month] = e.target.value.split('-').map(Number);
                  change((s) => {
                    if (s.design.title.text === defaultTitle(s.start)) s.design.title.text = defaultTitle({ year, month });
                    s.start = { year, month };
                  });
                }}>
                  {START_OPTIONS.map((o) => <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{MONTHS_DE[o.month - 1]} {o.year}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Bundesland</span>
                <select className="input" value={spec.state} onChange={(e) => change((s) => {
                  const next = e.target.value as StateCode;
                  s.calendars.school = s.calendars.school.map((x) => (x === s.state ? next : x)).filter((x, i, a) => a.indexOf(x) === i);
                  s.state = next;
                  s.calendars.regional = defaultRegional(next);
                })}>
                  {STATE_CODES.map((c) => <option key={c} value={c}>{STATES[c]}</option>)}
                </select>
              </label>
            </div>
            <p className="small">
              {spec.layout === 'wochen'
                ? `Der Planer zeigt 364 Tage: ${fmt(fromIso)} bis ${fmt(toIso)}.`
                : `Der Planer zeigt zwölf volle Monate: ${fmt(fromIso)} bis ${fmt(toIso)}.`}
            </p>
          </Section>

          <Section title="Kalender" hint={`${Number(spec.calendars.publicHolidays) + spec.calendars.school.length + sources.length} aktiv`}>
            <label className="check">
              <input type="checkbox" checked={spec.calendars.publicHolidays} onChange={(e) => change((s) => { s.calendars.publicHolidays = e.target.checked; })} />
              <span>Feiertage in {STATES[spec.state]}</span>
            </label>
            {regionalHolidaysFor(spec.state).map((h) => {
              const on = (spec.calendars.regional ?? defaultRegional(spec.state)).includes(h.id);
              return (
                <label className="check" key={h.id}>
                  <input type="checkbox" checked={on && spec.calendars.publicHolidays} disabled={!spec.calendars.publicHolidays} onChange={(e) => change((s) => {
                    const rest = (s.calendars.regional ?? defaultRegional(s.state)).filter((id) => id !== h.id);
                    s.calendars.regional = e.target.checked ? [...rest, h.id] : rest;
                  })} />
                  <span>{h.name} ist bei uns Feiertag<span className="small" style={{ display: 'block' }}>{h.hint}</span></span>
                </label>
              );
            })}
            <label className="check">
              <input type="checkbox" checked={spec.calendars.school.includes(spec.state)} onChange={(e) => change((s) => {
                s.calendars.school = e.target.checked ? [s.state, ...s.calendars.school.filter((x) => x !== s.state)].slice(0, 2) : s.calendars.school.filter((x) => x !== s.state);
              })} />
              <span>Schulferien in {STATES[spec.state]}</span>
            </label>
            <label className="field">
              <span className="label">Schulferien eines zweiten Bundeslandes</span>
              <select className="input" value={spec.calendars.school.find((x) => x !== spec.state) ?? ''} onChange={(e) => change((s) => {
                const own = s.calendars.school.filter((x) => x === s.state);
                s.calendars.school = e.target.value ? [...own, e.target.value as StateCode] : own;
              })}>
                <option value="">Keines</option>
                {STATE_CODES.filter((c) => c !== spec.state).map((c) => <option key={c} value={c}>{STATES[c]}</option>)}
              </select>
            </label>

            <Football from={fromIso} to={toIso} onAdd={addEvents} />
            <IcsImport from={fromIso} to={toIso} onAdd={addEvents} />
            <OwnDate from={fromIso} to={toIso} onAdd={(e) => change((s) => { s.events = [...s.events, e].slice(0, 600); })} />

            {sources.length > 0 && (
              <ul className="list-plain" aria-label="Hinzugefügte Kalender">
                {sources.map(([source, count]) => (
                  <li key={source}>
                    <span>{source === 'manual' ? 'Eigene Termine' : calNames[source] ?? 'Kalender'} <span className="small">· {count} {count === 1 ? 'Eintrag' : 'Einträge'}</span></span>
                    <button type="button" className="linkbtn" onClick={() => change((s) => { s.events = s.events.filter((e) => (e.source ?? 'manual') !== source); })}>Entfernen</button>
                  </li>
                ))}
              </ul>
            )}
            {outOfRange > 0 && <p className="note">{outOfRange} Einträge liegen außerhalb des gewählten Zeitraums. Wenn du den Zeitraum geändert hast, füg den Kalender noch einmal hinzu.</p>}
            <p className="small">Schulferien und Feiertage: OpenHolidays (ODbL). Spielpläne: OpenLigaDB, Stand heute; Ansetzungen können sich verschieben.</p>
          </Section>

          <Section title="Geburtstage" hint={spec.birthdays.length ? `${spec.birthdays.length} eingetragen` : undefined}>
            <Birthdays rows={rows} onChange={setBirthdayRows} scan={assistant} />
          </Section>

          <Section title="Titel und Schrift">
            <label className="field">
              <span className="label">Titel</span>
              <input className="input" maxLength={40} value={d.title.text} onChange={(e) => design((x) => { x.title.text = e.target.value; })} onBlur={(e) => { if (!e.target.value.trim()) design((x) => { x.title.text = defaultTitle(spec.start); }); }} />
            </label>
            <div className="grid-2">
              <Select label="Schrift des Titels" value={d.title.font} onChange={(v) => design((x) => { x.title.font = v as FontFamilyId; })} options={TITLE_FONTS.map((f) => [f, `${FONT_FAMILIES[f].label} · ${FONT_FAMILIES[f].kind}`])} />
              <Select label="Schreibweise" value={d.title.case} onChange={(v) => design((x) => { x.title.case = v as Design['title']['case']; })} options={[['lower', 'klein geschrieben'], ['asis', 'wie eingegeben'], ['upper', 'GROSS']]} />
              <Select label="Ausrichtung" value={d.title.align} onChange={(v) => design((x) => { x.title.align = v as Design['title']['align']; })} options={[['left', 'links'], ['center', 'mittig'], ['right', 'rechts']]} />
              <Select label="Schrift der Zahlen" value={d.bodyFont} onChange={(v) => design((x) => { x.bodyFont = v as FontFamilyId; })} options={BODY_FONTS.map((f) => [f, FONT_FAMILIES[f].label])} />
            </div>
            <Range label="Größe des Titels" min={0.4} max={1.25} step={0.05} value={d.title.scale} onChange={(v) => design((x) => { x.title.scale = v; })} />
          </Section>

          <Section title="Feinheiten">
            <div className="grid-2">
              <Select label="Ferien und Zeiträume" value={d.schoolHolidays} onChange={(v) => design((x) => { x.schoolHolidays = v as Design['schoolHolidays']; })} options={[['arrows', 'Linie mit Pfeilen'], ['band', 'Farbband'], ['underline', 'Zahlen unterstrichen'], ['none', 'nicht zeigen']]} />
              <Select label="Stärke der Zahlen" value={String(d.numbers.weight)} onChange={(v) => design((x) => { x.numbers.weight = Number(v) as 400 | 500 | 700; })} options={[['400', 'fein'], ['500', 'mittel'], ['700', 'kräftig']]} />
              {spec.layout === 'wochen' && <Select label="Monatsname" value={d.monthLabel} onChange={(v) => design((x) => { x.monthLabel = v as Design['monthLabel']; })} options={[['vertical', 'senkrecht'], ['horizontal', 'waagerecht']]} />}
            </div>
            <Range label="Schattierung von Wochenenden und Feiertagen" min={0} max={0.3} step={0.01} value={d.shading} onChange={(v) => design((x) => { x.shading = v; })} />
            <Range label="Größe der Zahlen" min={0.7} max={1.4} step={0.05} value={d.numbers.scale} onChange={(v) => design((x) => { x.numbers.scale = v; })} />
            <Range label="Monatslinie" min={0} max={2.5} step={0.04} value={d.lines.month} onChange={(v) => design((x) => { x.lines.month = Math.round(v * 100) / 100; })} />
            <label className="check"><input type="checkbox" checked={d.numbers.zeroPad} onChange={(e) => design((x) => { x.numbers.zeroPad = e.target.checked; })} /><span>Tage zweistellig schreiben (02 statt 2)</span></label>
            <label className="check"><input type="checkbox" checked={d.weekdays} onChange={(e) => design((x) => { x.weekdays = e.target.checked; })} /><span>Wochentage zeigen (MO DI MI)</span></label>
          </Section>
        </div>

        <div className="buybar">
          <div>
            <div className="price">99 €</div>
            <div className="small">inkl. MwSt. und Versand in Deutschland</div>
          </div>
          <Link className="btn" href="/kasse">Weiter zur Prüfung</Link>
        </div>
        <p className="small" style={{ marginTop: 'var(--space-3)' }}>
          Dein Entwurf bleibt in diesem Browser gespeichert. <button type="button" className="linkbtn" onClick={() => { if (confirm('Den Entwurf verwerfen und neu beginnen?')) { setSpec(defaultSpec()); setRows([]); setCalNames({}); setUndo([]); } }}>Neu beginnen</button>
        </p>
      </div>
    </div>
  );
}

const fmt = (isoDate: string) => {
  const [y, m, dd] = isoDate.split('-').map(Number);
  return `${dd}. ${MONTHS_DE[m - 1]} ${y}`;
};

function Section({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open}>
      <summary><span>{title}{hint && <span className="small"> · {hint}</span>}</span></summary>
      <div className="body">{children}</div>
    </details>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (readonly [string, string])[] }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Range({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function LayoutThumb({ id }: { id: LayoutId }) {
  const stroke = { stroke: 'currentColor', strokeWidth: 1, fill: 'none' } as const;
  if (id === 'spalten')
    return (
      <svg viewBox="0 0 32 46" aria-hidden="true">
        <rect x="1" y="1" width="30" height="44" {...stroke} />
        {Array.from({ length: 11 }, (_, i) => <line key={i} x1={3.5 + (i + 1) * 2.27} y1="6" x2={3.5 + (i + 1) * 2.27} y2={i % 2 ? 42 : 41} {...stroke} strokeWidth={0.6} />)}
        <line x1="3.5" y1="6" x2="28.5" y2="6" {...stroke} />
      </svg>
    );
  return (
    <svg viewBox="0 0 64 46" aria-hidden="true">
      <rect x="1" y="1" width="62" height="44" {...stroke} />
      {id === 'wochen'
        ? <path d="M4 8H60M4 11H60M4 14H20V17H60M4 20H34V23H60M4 26H44V29H60M4 32H14V35H60M4 38H52V41H60" {...stroke} strokeWidth={0.6} />
        : Array.from({ length: 12 }, (_, i) => <line key={i} x1="4" y1={8 + i * 3} x2={i === 1 ? 54 : i % 2 ? 58 : 60} y2={8 + i * 3} {...stroke} strokeWidth={0.6} />)}
    </svg>
  );
}

// ---- Design assistant

function Assistant({ enabled, spec, onResult, onUndo, canUndo }: { enabled: boolean; spec: PlannerSpec; onResult: (s: PlannerSpec) => void; onUndo: () => void; canUndo: boolean }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>({ text: '' });
  const file = useRef<HTMLInputElement>(null);

  async function run() {
    const image = file.current?.files?.[0];
    if (!prompt.trim() && !image) return setMsg({ text: 'Beschreib kurz, was sich ändern soll, oder wähle ein Foto.', tone: 'error' });
    setBusy(true);
    setMsg({ text: 'Der Assistent gestaltet … das dauert einen Moment.' });
    const form = new FormData();
    form.set('prompt', prompt);
    form.set('spec', JSON.stringify(spec));
    if (image) form.set('image', image);
    try {
      const out = await postJson<{ spec: PlannerSpec; message: string }>('/api/assistant', { method: 'POST', body: form });
      onResult(out.spec);
      setMsg({ text: out.message, tone: 'ok' });
      setPrompt('');
      if (file.current) file.current.value = '';
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'error' });
    }
    setBusy(false);
  }

  return (
    <div className="panel assistant">
      <div>
        <h2 className="h3">Sag, wie dein Planer aussehen soll</h2>
        <p className="small">Schreib es in deinen Worten, zum Beispiel „Mach den Titel zu einer großen 2027 in einer Serifenschrift“ oder „Farben wie auf diesem Foto“. Der Assistent ändert das Design, die Daten bleiben, wie sie sind.</p>
      </div>
      <label className="field">
        <span className="label">Dein Wunsch</span>
        <textarea className="input" value={prompt} maxLength={1500} disabled={!enabled || busy} onChange={(e) => setPrompt(e.target.value)} placeholder="Warme Farben, passend zu unserem Holzregal, und der Titel mittig." />
      </label>
      <label className="field">
        <span className="label">Foto als Vorlage (optional)</span>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" disabled={!enabled || busy} />
      </label>
      <div className="row">
        <button type="button" className="btn" onClick={run} disabled={!enabled || busy}>{busy ? 'Einen Moment …' : 'Vorschlag ansehen'}</button>
        {canUndo && <button type="button" className="btn secondary" onClick={() => { onUndo(); setMsg({ text: 'Zurückgenommen.' }); }} disabled={busy}>Rückgängig</button>}
      </div>
      {!enabled && <p className="small">Der Assistent ist auf dieser Seite noch nicht eingerichtet. Alle Einstellungen findest du rechts.</p>}
      <p className="status" role="status" aria-live="polite" data-tone={msg.tone}>{msg.text}</p>
      <p className="small">Vorschläge kommen von einer KI. Fotos werden nur für den Vorschlag verwendet und nicht gespeichert.</p>
    </div>
  );
}

// ---- Calendars

function Football({ from, to, onAdd }: { from: string; to: string; onAdd: (e: PlannerEvent[], name: string) => void }) {
  const [league, setLeague] = useState('');
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [team, setTeam] = useState('');
  const [msg, setMsg] = useState<Msg>({ text: '' });
  const [busy, setBusy] = useState(false);

  async function pickLeague(value: string) {
    setLeague(value);
    setTeams([]);
    setTeam('');
    setMsg({ text: '' });
    if (!value) return;
    try {
      const out = await postJson<{ teams: { id: number; name: string }[] }>(`/api/calendar?league=${value}&from=${from}`, { method: 'GET' });
      setTeams(out.teams);
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'error' });
    }
  }
  async function add() {
    setBusy(true);
    try {
      const out = await postJson<{ events: PlannerEvent[]; name: string }>('/api/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'football', league, teamId: Number(team), from, to }) });
      onAdd(out.events, out.name);
      setMsg({ text: `${out.events.length} Spiele von ${out.name} eingetragen.`, tone: 'ok' });
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'error' });
    }
    setBusy(false);
  }
  return (
    <div className="stack">
      <span className="label">Spielplan deines Vereins</span>
      <div className="row">
        <select className="input grow" aria-label="Liga" value={league} onChange={(e) => pickLeague(e.target.value)}>
          <option value="">Liga wählen</option>
          {Object.entries(LEAGUES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input grow" aria-label="Verein" value={team} onChange={(e) => setTeam(e.target.value)} disabled={!teams.length}>
          <option value="">Verein wählen</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="button" className="btn secondary small-btn" onClick={add} disabled={!team || busy}>Hinzufügen</button>
      </div>
      {msg.text && <p className="status" role="status" data-tone={msg.tone}>{msg.text}</p>}
    </div>
  );
}

function IcsImport({ from, to, onAdd }: { from: string; to: string; onAdd: (e: PlannerEvent[], name: string) => void }) {
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<Msg>({ text: '' });
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    setMsg({ text: 'Kalender wird geladen …' });
    try {
      const out = await postJson<{ events: PlannerEvent[]; name: string; skipped: number }>('/api/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'ics', url, from, to }) });
      onAdd(out.events, out.name);
      setMsg({ text: `${out.events.length} Einträge aus „${out.name}“ eingetragen.${out.skipped ? ` ${out.skipped} wiederkehrende oder sehr lange Termine haben wir ausgelassen.` : ''}`, tone: 'ok' });
      setUrl('');
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'error' });
    }
    setBusy(false);
  }
  return (
    <div className="stack">
      <label className="field">
        <span className="label">Öffentlicher Kalender per Adresse (iCal, .ics)</span>
        <div className="row">
          <input className="input grow" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… oder webcal://…" />
          <button type="button" className="btn secondary small-btn" onClick={add} disabled={url.trim().length < 8 || busy}>Hinzufügen</button>
        </div>
      </label>
      <p className="small">Zum Beispiel der Spielplan eines Vereins, Tourdaten einer Band oder der Müllkalender deiner Stadt. Die Termine werden einmal übernommen und dann mitgedruckt.</p>
      {msg.text && <p className="status" role="status" data-tone={msg.tone}>{msg.text}</p>}
    </div>
  );
}

function OwnDate({ from, to, onAdd }: { from: string; to: string; onAdd: (e: PlannerEvent) => void }) {
  const [label, setLabel] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const ok = label.trim() && start && (!end || end >= start);
  return (
    <div className="stack">
      <span className="label">Eigener Termin oder Zeitraum</span>
      <div className="row">
        <input className="input grow" aria-label="Bezeichnung" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Costa Rica" />
        <input className="input" style={{ width: 150 }} aria-label="Von" type="date" min={from} max={to} value={start} onChange={(e) => setStart(e.target.value)} />
        <input className="input" style={{ width: 150 }} aria-label="Bis (optional)" type="date" min={start || from} max={to} value={end} onChange={(e) => setEnd(e.target.value)} />
        <button type="button" className="btn secondary small-btn" disabled={!ok} onClick={() => { onAdd({ start, ...(end && end > start ? { end } : {}), label: label.trim(), source: 'manual' }); setLabel(''); setStart(''); setEnd(''); }}>Hinzufügen</button>
      </div>
    </div>
  );
}

// ---- Birthdays

function Birthdays({ rows, onChange, scan }: { rows: Row[]; onChange: (r: Row[]) => void; scan: boolean }) {
  const [msg, setMsg] = useState<Msg>({ text: '' });
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<Row>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch, unsure: false } : r)));

  async function scanPhoto(file: File | undefined, input: HTMLInputElement) {
    if (!file) return;
    setBusy(true);
    setMsg({ text: 'Das Foto wird gelesen … das dauert einen Moment.' });
    const form = new FormData();
    form.set('image', file);
    try {
      const out = await postJson<{ entries: { name: string; day: number; month: number; unsure: boolean }[]; note: string }>('/api/birthdays/scan', { method: 'POST', body: form });
      const known = new Set(rows.map((r) => `${r.name.trim().toLowerCase()}|${r.day}|${r.month}`));
      const fresh = out.entries.filter((e) => !known.has(`${e.name.toLowerCase()}|${e.day}|${e.month}`)).map((e) => ({ name: e.name, day: String(e.day), month: String(e.month), unsure: e.unsure }));
      onChange([...rows.filter((r) => r.name.trim() || r.day || r.month), ...fresh]);
      const unsure = fresh.filter((e) => e.unsure).length;
      setMsg({
        text: fresh.length
          ? `${fresh.length} Geburtstage gelesen. Bitte prüf jeden Eintrag${unsure ? `; ${unsure} davon waren schwer zu lesen und sind markiert` : ''}. ${out.note}`
          : out.note || 'Auf dem Foto haben wir keine neuen Geburtstage gefunden.',
        tone: fresh.length ? 'ok' : 'error',
      });
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'error' });
    }
    input.value = '';
    setBusy(false);
  }

  return (
    <>
      <p className="small">Jeder Name steht später klein im Feld seines Tages. Bis zu drei Namen pro Tag.</p>
      {rows.length > 0 && (
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          <div className="bday label" aria-hidden="true"><span>Name</span><span>Tag</span><span>Monat</span><span /></div>
          {rows.map((r, i) => (
            <div className={`bday${r.unsure ? ' unsure' : ''}`} key={i}>
              <input className="input" aria-label="Name" maxLength={24} value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
              <input className="input num" aria-label="Tag" inputMode="numeric" maxLength={2} value={r.day} onChange={(e) => set(i, { day: e.target.value.replace(/\D/g, '') })} />
              <input className="input num" aria-label="Monat" inputMode="numeric" maxLength={2} value={r.month} onChange={(e) => set(i, { month: e.target.value.replace(/\D/g, '') })} />
              <button type="button" className="xbtn" aria-label={`${r.name || 'Eintrag'} entfernen`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <button type="button" className="btn secondary small-btn" onClick={() => onChange([...rows, { name: '', day: '', month: '' }])}>Geburtstag eintragen</button>
      </div>
      {scan && (
        <>
        <label className="field">
          <span className="label">Oder: Foto eures Geburtstagskalenders</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => scanPhoto(e.target.files?.[0], e.target)} />
        </label>
        <p className="small">Eine KI liest Namen und Daten aus dem Foto. Du prüfst und korrigierst die Liste, bevor etwas gedruckt wird. Das Foto wird nicht gespeichert.</p>
        </>
      )}
      {msg.text && <p className="status" role="status" aria-live="polite" data-tone={msg.tone}>{msg.text}</p>}
    </>
  );
}
