import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Square } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { LineChart, ScatterChart } from '../ui/Charts';
import { Slider, Toggle, Button } from '../ui/Panel';
import { DensityLegend } from '../ui/Legend';
import { ErrorBoundary, hasWebGL } from '../ui/ErrorBoundary';
import { fmtClock, fmtDuration, fmtNum, kmh } from '../ui/format';
import { CityCanvas } from '../scene/CityCanvas';
import { StaticCity } from '../scene/StaticCity';
import { StaticHeatmap } from '../scene/DynamicLayers';
import { useHeadlessRuns, summarize, type RunSummary } from '../scene/headless';
import { compileNetwork } from '../lib/sim/network';
import { generateCity } from '../lib/city/generator';
import type { CityDoc } from '../lib/city/schema';
import type { SimConfig } from '../lib/sim/engine';
import { SCENARIO_BY_ID } from '../content/scenarios';
import { PHENOMENON_BY_ID } from '../content/phenomena';
import { useCityStore } from '../store/city';
import { useEditorStore } from '../store/editor';
import { useSettings } from '../store/settings';

type Source = 'generated' | 'editor' | 'live' | 'lab';

interface ScenarioSettings {
  source: Source;
  seed: number;
  demand: number;
  transit: boolean;
  green: number;
  /** varian skenario Lab (bila source = lab) */
  variant: string;
}

const BASE_DEMAND = 20000;
const DURATIONS = [1800, 3600, 7200];

function ScenarioCard({
  label,
  color,
  value,
  onChange,
  labId,
  testId,
}: {
  label: string;
  color: string;
  value: ScenarioSettings;
  onChange: (v: ScenarioSettings) => void;
  labId: string | null;
  testId: string;
}) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const ph = labId ? PHENOMENON_BY_ID.get(labId) : undefined;
  const set = (patch: Partial<ScenarioSettings>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="border-2 border-line-strong bg-surface p-3" data-testid={testId}>
      <legend className="flex items-center gap-2 px-1 font-display font-semibold">
        <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
        {label}
      </legend>
      <label className="block text-sm">
        <span className="text-ink-2">{t('analytics.source')}</span>
        <select
          value={value.source}
          onChange={(e) => set({ source: e.target.value as Source })}
          className="mt-1 h-9 w-full border-2 border-line-strong bg-paper px-2"
        >
          <option value="live">{t('analytics.sources.live')}</option>
          <option value="generated">{t('analytics.sources.generated')}</option>
          <option value="editor">{t('analytics.sources.editor')}</option>
          {ph && <option value="lab">{`${t('analytics.labSource')}: ${ph.title[lang]}`}</option>}
        </select>
      </label>
      {value.source === 'generated' && (
        <label className="mt-2 block text-sm">
          <span className="text-ink-2">{t('sim.seed')}</span>
          <input
            inputMode="numeric"
            value={value.seed}
            onChange={(e) => set({ seed: Number(e.target.value.replace(/\D/g, '').slice(0, 9)) || 1 })}
            className="num mt-1 h-9 w-full border-2 border-line-strong bg-paper px-2"
          />
        </label>
      )}
      {value.source === 'lab' && ph && (
        <label className="mt-2 block text-sm">
          <span className="text-ink-2">{t('lab.variant')}</span>
          <select
            value={value.variant}
            onChange={(e) => set({ variant: e.target.value })}
            className="mt-1 h-9 w-full border-2 border-line-strong bg-paper px-2"
          >
            {ph.variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label[lang]}
              </option>
            ))}
          </select>
        </label>
      )}
      <Slider
        label={t('analytics.demandMult')}
        value={value.demand}
        min={0.5}
        max={2}
        step={0.1}
        onChange={(v) => set({ demand: v })}
        format={(v) => `${fmtNum(v, lang, 1)}×`}
      />
      <Slider
        label={t('analytics.signalScale')}
        value={value.green}
        min={0.6}
        max={1.6}
        step={0.1}
        onChange={(v) => set({ green: v })}
        format={(v) => `${fmtNum(v, lang, 1)}×`}
      />
      {value.source !== 'lab' && (
        <Toggle
          label={t('analytics.transitOn')}
          checked={value.transit}
          onChange={(v) => set({ transit: v })}
        />
      )}
    </fieldset>
  );
}

function SummaryTable({ a, b }: { a: RunSummary; b: RunSummary }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const rows: { label: string; va: number; vb: number; fmt: (v: number) => string; lower: boolean }[] = [
    {
      label: t('analytics.travelTime'),
      va: a.meanTravelTime,
      vb: b.meanTravelTime,
      fmt: fmtDuration,
      lower: true,
    },
    {
      label: t('sim.meanSpeed'),
      va: kmh(a.meanSpeed),
      vb: kmh(b.meanSpeed),
      fmt: (v) => `${fmtNum(v, lang, 1)} ${t('sim.units.kmh')}`,
      lower: false,
    },
    {
      label: t('analytics.throughput'),
      va: a.throughput,
      vb: b.throughput,
      fmt: (v) => `${fmtNum(v, lang)} ${t('sim.units.vehH')}`,
      lower: false,
    },
    { label: t('analytics.queue'), va: a.stopped, vb: b.stopped, fmt: (v) => fmtNum(v, lang), lower: true },
    {
      label: t('transit.density'),
      va: a.meanDensity,
      vb: b.meanDensity,
      fmt: (v) => `${fmtNum(v, lang, 1)} ${t('sim.units.vehKm')}`,
      lower: true,
    },
    {
      label: `${t('transit.emissions')} (${t('transit.perTrip')})`,
      va: a.emissionsPerTrip,
      vb: b.emissionsPerTrip,
      fmt: (v) => fmtNum(v, lang, 3),
      lower: true,
    },
  ];
  return (
    <div className="overflow-x-auto border-2 border-line-strong bg-surface p-3">
      <table className="w-full text-sm" data-testid="analytics-summary">
        <thead>
          <tr className="border-b-2 border-line-strong text-left">
            <th className="py-1 pr-2 font-normal text-ink-2">{t('analytics.metric')}</th>
            <th className="py-1 pr-2">{t('analytics.scenarioA')}</th>
            <th className="py-1 pr-2">{t('analytics.scenarioB')}</th>
            <th className="py-1">{t('analytics.delta')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.va ? ((r.vb - r.va) / Math.abs(r.va)) * 100 : 0;
            const better = r.lower ? pct < 0 : pct > 0;
            return (
              <tr key={r.label} className="border-b border-line">
                <td className="py-1.5 pr-2 text-ink-2">{r.label}</td>
                <td className="num py-1.5 pr-2">{r.fmt(r.va)}</td>
                <td className="num py-1.5 pr-2">{r.fmt(r.vb)}</td>
                <td className="num py-1.5">
                  {Math.abs(pct) < 0.5 ? '≈' : `${pct > 0 ? '+' : ''}${fmtNum(pct, lang, 0)}%`}{' '}
                  {Math.abs(pct) >= 0.5 && (
                    <span className="text-xs text-ink-2">
                      ({better ? t('analytics.better') : t('analytics.worse')})
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  const [params] = useSearchParams();
  const live = useCityStore((s) => s.live);
  const liveSeed = useCityStore((s) => s.seed);
  const editorDoc = useEditorStore((s) => s.doc);
  const labId = params.get('lab') && SCENARIO_BY_ID.has(params.get('lab')!) ? params.get('lab') : null;
  const labLevel = Number(params.get('level')) || SCENARIO_BY_ID.get(labId ?? '')?.slider?.value || 0;
  const src = params.get('src');
  const initial = (): [ScenarioSettings, ScenarioSettings] => {
    const base: ScenarioSettings = {
      source: src === 'editor' ? 'editor' : 'live',
      seed: liveSeed,
      demand: 1,
      transit: true,
      green: 1,
      variant: '',
    };
    if (labId) {
      const sc = SCENARIO_BY_ID.get(labId)!;
      const v = params.get('v') ?? sc.defaultVariant;
      const other = sc.variants.find((x) => x !== v) ?? v;
      return [
        { ...base, source: 'lab', variant: v },
        { ...base, source: 'lab', variant: other },
      ];
    }
    return [base, { ...base, demand: 1.3 }];
  };
  const [[a, b], setAB] = useState<[ScenarioSettings, ScenarioSettings]>(initial);
  const [duration, setDuration] = useState(labId ? 1800 : 3600);
  const [startHour, setStartHour] = useState(7);
  const [showHeat, setShowHeat] = useState<0 | 1>(0);
  const runs = useHeadlessRuns();
  const webgl = useMemo(hasWebGL, []);

  const cityFor = (s: ScenarioSettings): CityDoc => {
    let doc: CityDoc =
      s.source === 'editor' ? editorDoc : s.source === 'generated' ? generateCity(s.seed, 'medium') : live;
    if (!s.transit) doc = { ...doc, transit: { bus: [], mrt: [] } };
    return doc;
  };
  const configFor = (s: ScenarioSettings): SimConfig => {
    if (s.source === 'lab' && labId) {
      const sc = SCENARIO_BY_ID.get(labId)!;
      const cfg = sc.build(s.variant || sc.defaultVariant, labLevel);
      if (cfg.demand.kind === 'flows')
        cfg.demand = {
          kind: 'flows',
          flows: cfg.demand.flows.map((f) => ({ ...f, rate: f.rate * s.demand })),
        };
      return { ...cfg, greenScale: s.green };
    }
    const city = cityFor(s);
    return {
      city,
      seed: city.seed ?? 1,
      startHour,
      demand: { kind: 'zones', peakPerHour: BASE_DEMAND * s.demand },
      maxVehicles: 2600,
      greenScale: s.green,
    };
  };

  const [ran, setRan] = useState<{ configs: SimConfig[]; startHour: number } | null>(null);
  const start = () => {
    const configs = [configFor(a), configFor(b)];
    setRan({ configs, startHour: labId ? 0 : startHour });
    runs.run(configs, duration);
  };

  const colors = ['var(--fs-series-a)', 'var(--fs-series-b)'];
  const names = [t('analytics.scenarioA'), t('analytics.scenarioB')];
  const results =
    runs.done && runs.results ? (runs.results as NonNullable<(typeof runs.results)[number]>[]) : null;
  const xFmt = (sec: number) => (ran && !labId ? fmtClock(ran.startHour + sec / 3600) : fmtDuration(sec));
  const series = (
    f: (s: { t: number; meanTravelTime: number; throughput: number; stopped: number }) => number,
    skipZero = false,
  ) =>
    results!.map((r, i) => ({
      name: names[i],
      color: colors[i],
      points: r.samples.filter((s) => !skipZero || f(s) > 0).map((s) => ({ x: s.t, y: f(s) })),
    }));
  const heatNet = useMemo(() => (ran ? compileNetwork(ran.configs[showHeat].city) : null), [ran, showHeat]);
  const pct = runs.progress ? Math.min(...runs.progress) : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-8">
      <PageHeader code="M5" title={t('analytics.title')}>
        <p className="mt-2 max-w-3xl text-sm text-ink-2">{t('analytics.empty')}</p>
      </PageHeader>
      <div className="grid gap-4 px-4 pt-4 sm:px-6 md:grid-cols-2 xl:grid-cols-[1fr_1fr_18rem]">
        <ScenarioCard
          label={names[0]}
          color={colors[0]}
          value={a}
          onChange={(v) => setAB([v, b])}
          labId={labId}
          testId="scenario-a"
        />
        <ScenarioCard
          label={names[1]}
          color={colors[1]}
          value={b}
          onChange={(v) => setAB([a, v])}
          labId={labId}
          testId="scenario-b"
        />
        <div className="flex flex-col gap-3 border-2 border-line-strong bg-surface p-3 md:col-span-2 xl:col-span-1">
          <label className="text-sm">
            <span className="text-ink-2">{t('analytics.duration')}</span>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 h-9 w-full border-2 border-line-strong bg-paper px-2"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {t('analytics.minutes', { n: d / 60 })}
                </option>
              ))}
            </select>
          </label>
          {!labId && (
            <label className="text-sm">
              <span className="text-ink-2">{t('analytics.startHour')}</span>
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="mt-1 h-9 w-full border-2 border-line-strong bg-paper px-2"
              >
                {[6, 7, 8, 10, 12, 16, 17, 18, 20].map((h) => (
                  <option key={h} value={h}>
                    {fmtClock(h)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {runs.running ? (
            <Button onClick={runs.stop} testId="analytics-stop">
              <Square size={16} aria-hidden /> {t('analytics.running', { pct })}
            </Button>
          ) : (
            <Button variant="solid" onClick={start} testId="analytics-run">
              <Play size={16} aria-hidden /> {t('analytics.run')}
            </Button>
          )}
          {runs.running && (
            <div
              className="h-2 w-full border border-line-strong"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          )}
          {runs.error && <p className="text-xs text-accent">{runs.error}</p>}
          <p className="text-xs text-ink-2">{t('analytics.note')}</p>
        </div>
      </div>

      {results && ran && (
        <div className="grid gap-4 px-4 pt-6 sm:px-6 lg:grid-cols-2" data-testid="analytics-results">
          <div className="lg:col-span-2">
            <SummaryTable
              a={summarize(results[0], labId ? 300 : 900)}
              b={summarize(results[1], labId ? 300 : 900)}
            />
          </div>
          <LineChart
            title={t('analytics.travelTime')}
            xLabel={t('analytics.time')}
            series={series((s) => s.meanTravelTime, true)}
            xFormat={xFmt}
            yFormat={(v) => fmtDuration(v)}
          />
          <LineChart
            title={t('analytics.throughput')}
            xLabel={t('analytics.time')}
            series={series((s) => s.throughput)}
            xFormat={xFmt}
            yFormat={(v) => fmtNum(v, lang)}
          />
          <LineChart
            title={t('analytics.queue')}
            xLabel={t('analytics.time')}
            series={series((s) => s.stopped)}
            xFormat={xFmt}
            yFormat={(v) => fmtNum(v, lang)}
          />
          <ScatterChart
            title={t('analytics.fundamental')}
            xLabel={`${t('analytics.density')} (${t('sim.units.vehKm')})`}
            yLabel={`${t('analytics.flow')} (${t('sim.units.vehH')})`}
            series={results.map((r, i) => ({
              name: names[i],
              color: colors[i],
              points: r.fd.map((p) => ({ x: p.k, y: p.q })),
            }))}
          />
          <section
            className="border-2 border-line-strong bg-surface p-3 lg:col-span-2"
            aria-labelledby="heat-h"
          >
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 id="heat-h" className="font-display text-sm font-semibold">
                {t('analytics.heatmapOf', { name: names[showHeat] })} ·{' '}
                <span className="font-normal text-ink-2">{t('analytics.heatmapEnd')}</span>
              </h2>
              <div
                role="radiogroup"
                aria-label={t('analytics.show')}
                className="ml-auto flex border-2 border-line-strong"
              >
                {[0, 1].map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={showHeat === k}
                    onClick={() => setShowHeat(k as 0 | 1)}
                    className={`px-3 py-1 text-sm font-semibold ${showHeat === k ? 'bg-ink text-paper' : 'hover:bg-surface-2'}`}
                  >
                    {names[k]}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative h-[52vh] min-h-72">
              {webgl && heatNet ? (
                <ErrorBoundary kind="webgl">
                  <CityCanvas
                    key={`${showHeat}-${theme}`}
                    bounds={heatNet.bounds}
                    hour={theme === 'dark' ? 22 : 12}
                    fit={0.9}
                    testId="analytics-canvas"
                  >
                    <StaticCity doc={ran.configs[showHeat].city} net={heatNet} decor={null} />
                    <StaticHeatmap net={heatNet} densities={results[showHeat].densities} />
                  </CityCanvas>
                </ErrorBoundary>
              ) : (
                <p className="p-4">{t('errors.webgl')}</p>
              )}
            </div>
            <div className="mt-2 max-w-md">
              <DensityLegend />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
