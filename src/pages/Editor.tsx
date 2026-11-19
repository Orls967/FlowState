import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MousePointer2,
  Spline,
  Eraser,
  MapPin,
  Play,
  Undo2,
  Redo2,
  Download,
  Upload,
  Link2,
  FilePlus2,
  Dices,
  Trash2,
  ArrowLeftRight,
  ChartSpline,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CityCanvas } from '../scene/CityCanvas';
import { StaticCity } from '../scene/StaticCity';
import { EditorOverlay, type Selection } from '../scene/EditorOverlay';
import { Heatmap, Pedestrians, Signals, Trains, TransitStatic, Vehicles } from '../scene/DynamicLayers';
import { useSimController } from '../scene/SimController';
import { QUALITY } from '../scene/context';
import { compileNetwork } from '../lib/sim/network';
import { buildDecor } from '../lib/city/decor';
import { CONTROLS, ZONES, type CityDoc, type Control, type Zone } from '../lib/city/schema';
import {
  addNode,
  addRoad,
  nearestNode,
  nearestRoad,
  removeNode,
  removeRoad,
  reverseRoad,
  splitRoad,
  updateNode,
  updateRoad,
} from '../lib/city/edit';
import { cityFromJson, cityToJson, decodeCity, encodeCity } from '../lib/city/serialize';
import { generateCity } from '../lib/city/generator';
import { useEditorStore, blankCity } from '../store/editor';
import { useSettings } from '../store/settings';
import { SidePanel, Section, Toggle, Slider, Button } from '../ui/Panel';
import { TimeControls } from '../ui/TimeControls';
import { ErrorBoundary, hasWebGL } from '../ui/ErrorBoundary';
import { fmtNum } from '../ui/format';

type Mode = 'select' | 'draw' | 'erase' | 'zone' | 'simulate';
const MODES: { key: Mode; icon: LucideIcon; hotkey: string }[] = [
  { key: 'select', icon: MousePointer2, hotkey: 'v' },
  { key: 'draw', icon: Spline, hotkey: 'd' },
  { key: 'erase', icon: Eraser, hotkey: 'e' },
  { key: 'zone', icon: MapPin, hotkey: 'z' },
  { key: 'simulate', icon: Play, hotkey: 's' },
];
const NODE_SNAP = 14;
const ROAD_SNAP = 8;

function RoadProps({ doc, id, apply }: { doc: CityDoc; id: number; apply: (d: CityDoc) => void }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const r = doc.roads.find((x) => x.id === id);
  if (!r) return null;
  return (
    <div data-testid="road-props">
      <Slider
        label={t('editor.lanes')}
        value={r.lanes}
        min={1}
        max={4}
        step={1}
        onChange={(v) => apply(updateRoad(doc, id, { lanes: v, busLane: v >= 2 && r.busLane }))}
        testId="road-lanes"
      />
      <Slider
        label={t('editor.speedLimit')}
        value={r.speed}
        min={20}
        max={100}
        step={10}
        onChange={(v) => apply(updateRoad(doc, id, { speed: v }))}
        format={(v) => `${fmtNum(v, lang)} ${t('sim.units.kmh')}`}
      />
      <Toggle
        label={t('editor.oneway')}
        checked={r.oneway}
        onChange={(v) => apply(updateRoad(doc, id, { oneway: v }))}
      />
      {r.oneway && (
        <Button onClick={() => apply(reverseRoad(doc, id))}>
          <ArrowLeftRight size={16} aria-hidden /> {t('editor.reverse')}
        </Button>
      )}
      {r.lanes >= 2 && (
        <Toggle
          label={t('editor.busLane')}
          checked={r.busLane}
          onChange={(v) => apply(updateRoad(doc, id, { busLane: v }))}
        />
      )}
      <div className="mt-3">
        <Button onClick={() => apply(removeRoad(doc, id))}>
          <Trash2 size={16} aria-hidden /> {t('editor.delete')}
        </Button>
      </div>
    </div>
  );
}

function NodeProps({ doc, id, apply }: { doc: CityDoc; id: number; apply: (d: CityDoc) => void }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const n = doc.nodes.find((x) => x.id === id);
  const net = useMemo(() => compileNetwork(doc), [doc]);
  if (!n) return null;
  const nn = net.nodes[net.nodeIndexById.get(id) ?? 0];
  const phases = nn?.control === 'signal' ? nn.phases.length : 0;
  const greens = nn?.greens ?? [];
  return (
    <div data-testid="node-props">
      <label className="block py-1.5 text-sm">
        <span className="block">{t('editor.control')}</span>
        <select
          value={n.control}
          data-testid="node-control"
          onChange={(e) =>
            apply(updateNode(doc, id, { control: e.target.value as Control, greens: undefined }))
          }
          className="mt-1 h-9 w-full border-2 border-line-strong bg-paper px-2"
        >
          {CONTROLS.map((c) => (
            <option key={c} value={c}>
              {t(`editor.controls.${c}`)}
            </option>
          ))}
        </select>
      </label>
      <Toggle
        label={t('editor.crosswalk')}
        checked={n.crosswalk}
        onChange={(v) => apply(updateNode(doc, id, { crosswalk: v }))}
      />
      {phases > 0 && (
        <div className="mt-2 border-l-2 border-line-strong pl-2">
          {Array.from({ length: phases }, (_, k) => (
            <Slider
              key={k}
              label={`${t('editor.phase')} ${k + 1} · ${t('editor.green')}`}
              value={Math.round(greens[k] ?? 20)}
              min={5}
              max={90}
              step={1}
              onChange={(v) => {
                const g = Array.from({ length: phases }, (_, j) => Math.round(greens[j] ?? 20));
                g[k] = v;
                apply(updateNode(doc, id, { greens: g }));
              }}
              format={(v) => `${v} ${t('sim.units.s')}`}
            />
          ))}
          <Slider
            label={t('editor.offset')}
            value={n.offset}
            min={0}
            max={Math.max(10, Math.round(nn.cycle))}
            step={1}
            onChange={(v) => apply(updateNode(doc, id, { offset: v }))}
            format={(v) => `${v} ${t('sim.units.s')}`}
          />
          <p className="num text-xs text-ink-2">
            {t('editor.cycle')}: {fmtNum(nn.cycle, lang)} {t('sim.units.s')}
          </p>
        </div>
      )}
      <label className="mt-2 block py-1.5 text-sm">
        <span className="block">{t('editor.modes.zone')}</span>
        <select
          value={n.zone}
          onChange={(e) => apply(updateNode(doc, id, { zone: e.target.value as Zone }))}
          className="mt-1 h-9 w-full border-2 border-line-strong bg-paper px-2"
        >
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {t(`sim.zones.${z}`)}
            </option>
          ))}
        </select>
      </label>
      {n.zone !== 'none' && (
        <Slider
          label={t('editor.zoneWeight')}
          value={n.weight}
          min={0.5}
          max={5}
          step={0.5}
          onChange={(v) => apply(updateNode(doc, id, { weight: v }))}
        />
      )}
      <div className="mt-3">
        <Button onClick={() => apply(removeNode(doc, id))}>
          <Trash2 size={16} aria-hidden /> {t('editor.delete')}
        </Button>
      </div>
    </div>
  );
}

export default function Editor() {
  const { t } = useTranslation();
  const quality = useSettings((s) => s.quality);
  const { doc, past, future, apply, undo, redo, load } = useEditorStore();
  const [mode, setMode] = useState<Mode>('select');
  const [selection, setSelection] = useState<Selection>(null);
  const [drawFrom, setDrawFrom] = useState<number | null>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [zoneBrush, setZoneBrush] = useState<Zone>('home');
  const [heatmap, setHeatmap] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const c = useSimController();
  const webgl = useMemo(hasWebGL, []);
  const net = useMemo(() => compileNetwork(doc), [doc]);
  const simulating = mode === 'simulate';
  const decor = useMemo(() => (simulating ? buildDecor(doc) : null), [doc, simulating]);
  const q = QUALITY[quality];

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 2600);
  };

  // muat kota dari tautan bersama (#/editor?c=...)
  useEffect(() => {
    const code = params.get('c');
    if (!code) return;
    const r = decodeCity(code);
    if (r.ok) {
      load(r.doc);
      say(t('editor.sharedLoaded'));
    } else say(`${t('editor.loadError')}: ${r.error}`);
    params.delete('c');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (simulating) {
      c.init(
        {
          city: doc,
          seed: doc.seed ?? 1,
          startHour: 7,
          demand: { kind: 'zones', peakPerHour: q.demand * 0.6 },
          maxVehicles: q.maxVehicles,
        },
        { paused: false },
      );
    } else c.setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulating, c]);

  useEffect(() => {
    setDrawFrom(null);
    if (mode !== 'select') setSelection(null);
  }, [mode]);

  // pintasan keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod) return;
      if (e.key === 'Escape') {
        setDrawFrom(null);
        setSelection(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        const s = useEditorStore.getState();
        s.apply(
          selection.kind === 'node' ? removeNode(s.doc, selection.id) : removeRoad(s.doc, selection.id),
        );
        setSelection(null);
      }
      const m = MODES.find((x) => x.hotkey === e.key.toLowerCase());
      if (m) setMode(m.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, undo, redo]);

  /** Titik pada peta → id simpang (menempel ke simpang/ruas terdekat atau membuat baru). */
  const resolvePoint = (d: CityDoc, x: number, y: number): [CityDoc, number] => {
    const n = nearestNode(d, x, y, NODE_SNAP);
    if (n) return [d, n.id];
    const r = nearestRoad(d, x, y, ROAD_SNAP);
    if (r) return splitRoad(d, r.id, x, y);
    return addNode(d, x, y);
  };

  const onGround = (x: number, y: number) => {
    const d = useEditorStore.getState().doc;
    switch (mode) {
      case 'select': {
        const n = nearestNode(d, x, y, NODE_SNAP);
        if (n) return setSelection({ kind: 'node', id: n.id });
        const r = nearestRoad(d, x, y, ROAD_SNAP);
        return setSelection(r ? { kind: 'road', id: r.id } : null);
      }
      case 'draw': {
        if (drawFrom === null) {
          const [d2, id] = resolvePoint(d, x, y);
          if (d2 !== d) apply(d2);
          setDrawFrom(id);
          return;
        }
        const target = nearestNode(d, x, y, NODE_SNAP);
        if (target && target.id === drawFrom) {
          setDrawFrom(null);
          return;
        }
        const [d1, id] = resolvePoint(d, x, y);
        const [d2, rid] = addRoad(d1, drawFrom, id, { lanes: 1, speed: 40 });
        if (rid !== null) apply(d2);
        setDrawFrom(id);
        return;
      }
      case 'erase': {
        const n = nearestNode(d, x, y, NODE_SNAP);
        if (n) return apply(removeNode(d, n.id));
        const r = nearestRoad(d, x, y, ROAD_SNAP);
        if (r) apply(removeRoad(d, r.id));
        return;
      }
      case 'zone': {
        const n = nearestNode(d, x, y, NODE_SNAP);
        if (n) apply(updateNode(d, n.id, { zone: n.zone === zoneBrush ? 'none' : zoneBrush }));
        return;
      }
      case 'simulate':
        return;
    }
  };

  const fromNode = drawFrom !== null ? doc.nodes.find((n) => n.id === drawFrom) : undefined;
  const draft = fromNode && hover ? { from: [fromNode.x, fromNode.y] as [number, number], to: hover } : null;

  const save = () => {
    const blob = new Blob([cityToJson(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(doc.name || 'flowstate-kota').replace(/[^\w-]+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = cityFromJson(await f.text());
    if (r.ok) {
      load(r.doc);
      setSelection(null);
      say(t('editor.loadOk'));
    } else say(`${t('editor.loadError')}: ${r.error}`);
  };
  const share = async () => {
    const code = encodeCity(doc);
    const url = `${window.location.origin}${window.location.pathname}#/editor?c=${code}`;
    if (url.length > 30000) return say(t('editor.linkTooLong'));
    try {
      await navigator.clipboard.writeText(url);
      say(t('editor.copied'));
    } catch {
      window.prompt(t('editor.share'), url);
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem-3.5rem)] flex-1 overflow-hidden xl:min-h-[calc(100dvh-3.5rem)]">
      <h1 className="sr-only">{t('editor.title')}</h1>
      {webgl ? (
        <ErrorBoundary kind="webgl">
          <CityCanvas
            bounds={net.bounds}
            controller={simulating ? c : null}
            hour={12}
            topDown
            onGroundClick={onGround}
            onGroundMove={mode === 'draw' && drawFrom !== null ? (x, y) => setHover([x, y]) : undefined}
          >
            <StaticCity doc={doc} net={net} decor={decor} />
            {!simulating && <EditorOverlay doc={doc} selection={selection} draft={draft} />}
            {simulating && (
              <>
                <TransitStatic doc={doc} net={net} />
                <Signals c={c} net={net} />
                <Heatmap c={c} net={net} visible={heatmap} />
                <Vehicles c={c} />
                <Pedestrians c={c} />
                <Trains c={c} />
              </>
            )}
          </CityCanvas>
        </ErrorBoundary>
      ) : (
        <p className="p-6">{t('errors.webgl')}</p>
      )}

      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 lg:max-w-[calc(100%-25rem)]">
        <div
          role="toolbar"
          aria-label={t('editor.title')}
          className="flex w-fit max-w-full overflow-x-auto border-2 border-line-strong bg-surface shadow-[3px_3px_0_var(--fs-line-strong)]"
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                title={`${t(`editor.modes.${m.key}`)} (${m.hotkey.toUpperCase()})`}
                data-testid={`mode-${m.key}`}
                onClick={() => setMode(m.key)}
                className={`flex h-11 shrink-0 items-center gap-1.5 border-r border-line px-3 text-sm font-semibold ${mode === m.key ? 'bg-ink text-paper' : 'hover:bg-surface-2'}`}
              >
                <Icon size={16} aria-hidden />
                <span className="max-sm:sr-only">{t(`editor.modes.${m.key}`)}</span>
              </button>
            );
          })}
          <button
            type="button"
            title={t('editor.undo')}
            aria-label={t('editor.undo')}
            disabled={!past.length}
            onClick={undo}
            data-testid="undo"
            className="flex h-11 w-11 shrink-0 items-center justify-center border-r border-line hover:bg-surface-2 disabled:opacity-35"
          >
            <Undo2 size={16} aria-hidden />
          </button>
          <button
            type="button"
            title={t('editor.redo')}
            aria-label={t('editor.redo')}
            disabled={!future.length}
            onClick={redo}
            data-testid="redo"
            className="flex h-11 w-11 shrink-0 items-center justify-center hover:bg-surface-2 disabled:opacity-35"
          >
            <Redo2 size={16} aria-hidden />
          </button>
        </div>
        <p className="w-fit max-w-md bg-surface/95 px-2 py-1 text-xs text-ink-2" aria-live="polite">
          {t(`editor.hints.${mode}`)}
        </p>
        {simulating && <TimeControls c={c} />}
      </div>

      {toast && (
        <div
          role="status"
          className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 border-2 border-line-strong bg-ink px-3 py-2 text-sm text-paper lg:bottom-6"
        >
          {toast}
        </div>
      )}

      <SidePanel
        title={t('editor.title')}
        code="M2"
        summary={
          <span className="num text-sm" data-testid="editor-stats">
            {t('editor.stats', { nodes: doc.nodes.length, roads: doc.roads.length })}
          </span>
        }
      >
        <p className="num mb-3 text-xs text-ink-2" data-testid="editor-stats">
          {t('editor.stats', { nodes: doc.nodes.length, roads: doc.roads.length })}
        </p>
        {mode === 'zone' && (
          <Section title={t('editor.modes.zone')}>
            <div role="radiogroup" className="grid grid-cols-2 gap-1">
              {ZONES.filter((z) => z !== 'none').map((z) => (
                <button
                  key={z}
                  type="button"
                  role="radio"
                  aria-checked={zoneBrush === z}
                  onClick={() => setZoneBrush(z)}
                  className={`border-2 px-2 py-1.5 text-sm ${zoneBrush === z ? 'border-line-strong bg-ink text-paper' : 'border-line hover:bg-surface-2'}`}
                >
                  {t(`sim.zones.${z}`)}
                </button>
              ))}
            </div>
          </Section>
        )}
        {mode === 'select' && (
          <Section
            title={
              selection?.kind === 'node'
                ? t('editor.node')
                : selection?.kind === 'road'
                  ? t('editor.road')
                  : t('editor.modes.select')
            }
          >
            {!selection && <p className="text-sm text-ink-2">{t('editor.nothingSelected')}</p>}
            {selection?.kind === 'road' && <RoadProps doc={doc} id={selection.id} apply={apply} />}
            {selection?.kind === 'node' && <NodeProps doc={doc} id={selection.id} apply={apply} />}
          </Section>
        )}
        {simulating && (
          <Section title={t('settings.settings')}>
            <Toggle label={t('sim.heatmap')} checked={heatmap} onChange={setHeatmap} />
          </Section>
        )}
        <Section title={t('editor.save')}>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} testId="save-json">
              <Download size={16} aria-hidden /> {t('editor.save')}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={16} aria-hidden /> {t('editor.load')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="load-json"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button onClick={() => void share()} testId="share">
              <Link2 size={16} aria-hidden /> {t('editor.share')}
            </Button>
          </div>
        </Section>
        <Section title={t('sim.newCity')}>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                apply(blankCity());
                setSelection(null);
              }}
            >
              <FilePlus2 size={16} aria-hidden /> {t('editor.newBlank')}
            </Button>
            <Button
              onClick={() => {
                apply(generateCity(Math.floor(Math.random() * 99999) + 1, 'small'));
                setSelection(null);
              }}
            >
              <Dices size={16} aria-hidden /> {t('editor.fromGenerator')}
            </Button>
          </div>
        </Section>
        <div className="border-t border-line pt-3">
          <Link
            to="/analytics?src=editor"
            className="inline-flex items-center gap-1.5 border-2 border-line-strong px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
          >
            <ChartSpline size={16} aria-hidden /> {t('editor.openAnalytics')}
          </Link>
        </div>
      </SidePanel>
    </div>
  );
}
