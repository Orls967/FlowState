import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bus, TrainFront, Check, X, Trash2, Sparkles, Scale } from 'lucide-react';
import { Line } from '@react-three/drei';
import { CityCanvas } from '../scene/CityCanvas';
import { StaticCity } from '../scene/StaticCity';
import { Pedestrians, Signals, Trains, TransitStatic, Vehicles, Heatmap } from '../scene/DynamicLayers';
import { useSim, useSimController } from '../scene/SimController';
import { useSceneCtx, QUALITY } from '../scene/context';
import { useHeadlessRuns, summarize, type RunSummary } from '../scene/headless';
import { compileNetwork } from '../lib/sim/network';
import { buildDecor } from '../lib/city/decor';
import { nearestNode, nextId } from '../lib/city/edit';
import { presetBrt, presetMrt } from '../lib/city/transit';
import type { CityDoc } from '../lib/city/schema';
import { useCityStore } from '../store/city';
import { useSettings } from '../store/settings';
import { SidePanel, Section, Slider, Toggle, Button } from '../ui/Panel';
import { TimeControls } from '../ui/TimeControls';
import { ErrorBoundary, hasWebGL } from '../ui/ErrorBoundary';
import { fmtDuration, fmtNum, kmh } from '../ui/format';

type Draft = { kind: 'bus'; stops: number[] } | { kind: 'mrt'; stations: { x: number; y: number }[] } | null;

/** Perbandingan tanpa tampilan memakai permintaan jam sibuk tetap (tidak bergantung kualitas grafis). */
const COMPARE_DEMAND = 24000;

const MODE_COLORS = ['var(--fs-ink-2)', 'var(--fs-line)', 'var(--fs-accent)', 'var(--fs-series-b)'];

export function ModeShareBar({ counts, testId }: { counts: readonly number[]; testId?: string }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const keys = ['car', 'moto', 'bus', 'mrt'] as const;
  return (
    <div data-testid={testId}>
      <div
        className="flex h-4 w-full border-2 border-line-strong"
        role="img"
        aria-label={t('transit.modeShare')}
      >
        {counts.map((c, i) =>
          c > 0 ? (
            <span
              key={i}
              style={{ width: `${(c / total) * 100}%`, background: MODE_COLORS[i] }}
              className={
                i === 1
                  ? 'bg-[repeating-linear-gradient(45deg,transparent_0_3px,var(--fs-ink-2)_3px_4px)]'
                  : ''
              }
            />
          ) : null,
        )}
      </div>
      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        {keys.map((k, i) => (
          <li key={k} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 border border-line-strong"
              style={{ background: MODE_COLORS[i] }}
            />
            <span className="flex-1">{t(`transit.modes.${k}`)}</span>
            <span className="num">{fmtNum((counts[i] / total) * 100, lang, 1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DraftOverlay({ draft, doc }: { draft: Draft; doc: CityDoc }) {
  const { preset } = useSceneCtx();
  if (!draft) return null;
  const pts: [number, number, number][] =
    draft.kind === 'bus'
      ? draft.stops
          .map((id) => doc.nodes.find((n) => n.id === id))
          .filter((n): n is NonNullable<typeof n> => !!n)
          .map((n) => [n.x, 2, -n.y])
      : draft.stations.map((s) => [s.x, 12, -s.y]);
  return (
    <group>
      {pts.length >= 2 && (
        <Line points={pts} color={preset.highlight} lineWidth={4} dashed dashSize={8} gapSize={5} />
      )}
      {pts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[5, 12, 8]} />
          <meshBasicMaterial color={preset.highlight} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function CompareTable({ base, cur }: { base: RunSummary; cur: RunSummary }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const rows: { label: string; a: number; b: number; fmt: (v: number) => string; lower: boolean }[] = [
    {
      label: t('transit.travelTime'),
      a: base.meanTravelTime,
      b: cur.meanTravelTime,
      fmt: fmtDuration,
      lower: true,
    },
    {
      label: t('transit.meanSpeed'),
      a: kmh(base.meanSpeed),
      b: kmh(cur.meanSpeed),
      fmt: (v) => `${fmtNum(v, lang, 1)} ${t('sim.units.kmh')}`,
      lower: false,
    },
    {
      label: t('transit.density'),
      a: base.meanDensity,
      b: cur.meanDensity,
      fmt: (v) => `${fmtNum(v, lang, 1)} ${t('sim.units.vehKm')}`,
      lower: true,
    },
    {
      label: `${t('transit.emissions')} (${t('transit.perTrip')})`,
      a: base.emissionsPerTrip,
      b: cur.emissionsPerTrip,
      fmt: (v) => fmtNum(v, lang, 3),
      lower: true,
    },
    {
      label: t('sim.vehicles'),
      a: base.meanActive,
      b: cur.meanActive,
      fmt: (v) => fmtNum(v, lang),
      lower: true,
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="transit-compare">
        <thead>
          <tr className="border-b-2 border-line-strong text-left">
            <th className="py-1 font-normal text-ink-2" />
            <th className="py-1 pr-2 font-semibold">{t('transit.baseline')}</th>
            <th className="py-1 font-semibold text-accent">{t('transit.current')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.a ? ((r.b - r.a) / r.a) * 100 : 0;
            const good = r.lower ? pct < 0 : pct > 0;
            return (
              <tr key={r.label} className="border-b border-line">
                <td className="py-1.5 pr-2 text-ink-2">{r.label}</td>
                <td className="num py-1.5 pr-2">{r.fmt(r.a)}</td>
                <td className="num py-1.5">
                  {r.fmt(r.b)}{' '}
                  {Math.abs(pct) >= 0.5 && (
                    <span className={`text-xs ${good ? 'text-ink' : 'text-accent'}`}>
                      ({pct > 0 ? '+' : ''}
                      {fmtNum(pct, lang, 0)}%)
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 grid gap-3">
        <div>
          <p className="mb-1 text-xs text-ink-2">{t('transit.baseline')}</p>
          <ModeShareBar counts={base.modeCounts} />
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-2">{t('transit.current')}</p>
          <ModeShareBar counts={cur.modeCounts} />
        </div>
      </div>
    </div>
  );
}

export default function Transit() {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const quality = useSettings((s) => s.quality);
  const { live, setTransit } = useCityStore();
  const c = useSimController();
  const [draft, setDraft] = useState<Draft>(null);
  const [heatmap, setHeatmap] = useState(false);
  const net = useMemo(() => compileNetwork(live), [live]);
  const decor = useMemo(() => buildDecor(live), [live]);
  const webgl = useMemo(hasWebGL, []);
  const stats = useSim(c, (s) => s.stats);
  const q = QUALITY[quality];
  const cmp = useHeadlessRuns();
  const transit = live.transit;

  useEffect(() => {
    c.init(
      {
        city: live,
        seed: live.seed ?? 1,
        startHour: 6.75,
        demand: { kind: 'zones', peakPerHour: q.demand },
        maxVehicles: q.maxVehicles,
      },
      { paused: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, live]);

  const update = (bus = transit.bus, mrt = transit.mrt) => setTransit({ bus, mrt });

  const onGround = (x: number, y: number) => {
    if (!draft) return;
    if (draft.kind === 'bus') {
      const n = nearestNode(live, x, y, 30);
      if (!n) return;
      const stops =
        draft.stops[draft.stops.length - 1] === n.id ? draft.stops.slice(0, -1) : [...draft.stops, n.id];
      setDraft({ kind: 'bus', stops });
    } else setDraft({ kind: 'mrt', stations: [...draft.stations, { x: Math.round(x), y: Math.round(y) }] });
  };

  const finish = () => {
    if (!draft) return;
    if (draft.kind === 'bus' && draft.stops.length >= 2)
      update([
        ...transit.bus,
        {
          id: nextId(transit.bus),
          name: `K${transit.bus.length + 1}`,
          stops: draft.stops,
          headway: 300,
          dedicated: false,
        },
      ]);
    if (draft.kind === 'mrt' && draft.stations.length >= 2)
      update(transit.bus, [
        ...transit.mrt,
        {
          id: nextId(transit.mrt),
          name: `MRT ${transit.mrt.length + 1}`,
          stations: draft.stations,
          headway: 360,
        },
      ]);
    setDraft(null);
  };

  const compare = () => {
    const base = {
      city: { ...live, transit: { bus: [], mrt: [] } },
      seed: live.seed ?? 1,
      startHour: 6.75,
      demand: { kind: 'zones' as const, peakPerHour: COMPARE_DEMAND },
      maxVehicles: 2600,
    };
    cmp.run([base, { ...base, city: live }], 3600);
  };

  const canFinish = draft && (draft.kind === 'bus' ? draft.stops.length >= 2 : draft.stations.length >= 2);
  const hasLines = transit.bus.length + transit.mrt.length > 0;

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem-3.5rem)] flex-1 overflow-hidden xl:min-h-[calc(100dvh-3.5rem)]">
      <h1 className="sr-only">{t('transit.title')}</h1>
      {webgl ? (
        <ErrorBoundary kind="webgl">
          <CityCanvas bounds={net.bounds} controller={c} onGroundClick={onGround} fit={0.8}>
            <StaticCity doc={live} net={net} decor={decor} />
            <TransitStatic doc={live} net={net} />
            <Signals c={c} net={net} />
            <Heatmap c={c} net={net} visible={heatmap} />
            <Vehicles c={c} />
            <Pedestrians c={c} />
            <Trains c={c} />
            <DraftOverlay draft={draft} doc={live} />
          </CityCanvas>
        </ErrorBoundary>
      ) : (
        <p className="p-6">{t('errors.webgl')}</p>
      )}
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
        <TimeControls c={c} />
        {draft && (
          <div
            className="max-w-xs border-2 border-line-strong bg-surface p-2 text-sm shadow-[3px_3px_0_var(--fs-line-strong)]"
            data-testid="transit-draft"
          >
            <p>{draft.kind === 'bus' ? t('transit.tapStops') : t('transit.tapStations')}</p>
            <p className="num mt-1 text-xs text-ink-2">
              {t('transit.selectedCount', {
                n: draft.kind === 'bus' ? draft.stops.length : draft.stations.length,
              })}
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="solid" onClick={finish} disabled={!canFinish} testId="transit-finish">
                <Check size={16} aria-hidden /> {t('transit.finish')}
              </Button>
              <Button onClick={() => setDraft(null)}>
                <X size={16} aria-hidden /> {t('transit.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <SidePanel
        title={t('transit.title')}
        code="M4"
        summary={stats ? <ModeShareBar counts={stats.modeCounts} /> : null}
      >
        <Section title={t('transit.lines')}>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDraft({ kind: 'bus', stops: [] })} testId="add-bus" disabled={!!draft}>
              <Bus size={16} aria-hidden /> {t('transit.addBus')}
            </Button>
            <Button
              onClick={() => setDraft({ kind: 'mrt', stations: [] })}
              testId="add-mrt"
              disabled={!!draft}
            >
              <TrainFront size={16} aria-hidden /> {t('transit.addMrt')}
            </Button>
          </div>
          <p className="station-label mt-3">{t('transit.presets')}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              testId="preset-brt"
              onClick={() => {
                const l = presetBrt(live);
                if (l) update([...transit.bus, l]);
              }}
            >
              <Sparkles size={14} aria-hidden /> {t('transit.presetBrt')}
            </Button>
            <Button
              variant="ghost"
              testId="preset-mrt"
              onClick={() => {
                const l = presetMrt(live);
                if (l) update(transit.bus, [...transit.mrt, l]);
              }}
            >
              <Sparkles size={14} aria-hidden /> {t('transit.presetMrt')}
            </Button>
          </div>
          {!hasLines && <p className="mt-3 text-sm text-ink-2">{t('transit.noLines')}</p>}
          <ul className="mt-3 space-y-2" data-testid="transit-lines">
            {transit.bus.map((l, i) => (
              <li key={`b${l.id}`} className="border-l-4 border-accent bg-surface-2/50 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <Bus size={14} aria-hidden />
                  <span className="font-semibold">{l.name}</span>
                  <span className="num text-xs text-ink-2">
                    {t('transit.stopsCount', { n: l.stops.length })}
                  </span>
                  <button
                    type="button"
                    aria-label={t('transit.remove')}
                    className="ml-auto p-1 hover:bg-surface-2"
                    onClick={() => update(transit.bus.filter((_, k) => k !== i))}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
                <Slider
                  label={t('transit.headway')}
                  value={Math.round(l.headway / 60)}
                  min={2}
                  max={30}
                  step={1}
                  onChange={(v) =>
                    update(transit.bus.map((x, k) => (k === i ? { ...x, headway: v * 60 } : x)))
                  }
                  format={(v) => t('transit.every', { n: v })}
                />
                <Toggle
                  label={t('transit.dedicated')}
                  checked={l.dedicated}
                  onChange={(v) => update(transit.bus.map((x, k) => (k === i ? { ...x, dedicated: v } : x)))}
                />
                {stats && (
                  <p className="num text-xs text-ink-2">
                    {t('transit.riders')}: {fmtNum(stats.lineRiders[i] ?? 0, lang)}
                  </p>
                )}
              </li>
            ))}
            {transit.mrt.map((l, i) => (
              <li key={`m${l.id}`} className="border-l-4 border-series-b bg-surface-2/50 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <TrainFront size={14} aria-hidden />
                  <span className="font-semibold">{l.name}</span>
                  <span className="num text-xs text-ink-2">
                    {t('transit.stationsCount', { n: l.stations.length })}
                  </span>
                  <button
                    type="button"
                    aria-label={t('transit.remove')}
                    className="ml-auto p-1 hover:bg-surface-2"
                    onClick={() =>
                      update(
                        transit.bus,
                        transit.mrt.filter((_, k) => k !== i),
                      )
                    }
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
                <Slider
                  label={t('transit.headway')}
                  value={Math.round(l.headway / 60)}
                  min={2}
                  max={30}
                  step={1}
                  onChange={(v) =>
                    update(
                      transit.bus,
                      transit.mrt.map((x, k) => (k === i ? { ...x, headway: v * 60 } : x)),
                    )
                  }
                  format={(v) => t('transit.every', { n: v })}
                />
                {stats && (
                  <p className="num text-xs text-ink-2">
                    {t('transit.riders')}: {fmtNum(stats.lineRiders[transit.bus.length + i] ?? 0, lang)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t('transit.modeShare')}>
          {stats && <ModeShareBar counts={stats.modeCounts} testId="mode-share" />}
          <p className="mt-2 text-xs text-ink-2">{t('transit.liveNote')}</p>
          <Toggle label={t('sim.heatmap')} checked={heatmap} onChange={setHeatmap} />
        </Section>

        <Section title={t('analytics.summary')}>
          <p className="mb-2 text-xs text-ink-2">{t('transit.compareHint')}</p>
          <Button onClick={compare} disabled={cmp.running} testId="transit-compare-run">
            <Scale size={16} aria-hidden />{' '}
            {cmp.running
              ? t('analytics.running', { pct: Math.min(...(cmp.progress ?? [0])) })
              : t('transit.compare')}
          </Button>
          {cmp.error && <p className="mt-2 text-xs text-accent">{cmp.error}</p>}
          {cmp.done && cmp.results && (
            <div className="mt-3">
              <CompareTable base={summarize(cmp.results[0]!)} cur={summarize(cmp.results[1]!)} />
            </div>
          )}
        </Section>
      </SidePanel>
    </div>
  );
}
