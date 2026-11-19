import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crosshair, Dices, PenTool, ChartSpline, X } from 'lucide-react';
import { CityCanvas } from '../scene/CityCanvas';
import { StaticCity } from '../scene/StaticCity';
import {
  Heatmap,
  Pedestrians,
  RouteLine,
  SelectionMarker,
  Signals,
  Trains,
  TransitStatic,
  Vehicles,
} from '../scene/DynamicLayers';
import { useSim, useSimController, type SimController } from '../scene/SimController';
import { QUALITY } from '../scene/context';
import { buildDecor } from '../lib/city/decor';
import { compileNetwork } from '../lib/sim/network';
import { VEHICLE_KEYS } from '../lib/sim/vehicles';
import { useSettings } from '../store/settings';
import { useCityStore } from '../store/city';
import { useEditorStore } from '../store/editor';
import { SidePanel, Section, Stat, Toggle, Slider, Button } from '../ui/Panel';
import { TimeControls } from '../ui/TimeControls';
import { DensityLegend } from '../ui/Legend';
import { ErrorBoundary, hasWebGL } from '../ui/ErrorBoundary';
import { fmtClock, fmtDuration, fmtNum, kmh } from '../ui/format';
import type { CitySize } from '../lib/city/generator';

function SelectedCard({ c }: { c: SimController }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const sel = useSim(c, (s) => s.selected);
  const followId = useSim(c, (s) => s.followId);
  if (!sel) return <p className="text-sm text-ink-2">{t('sim.tapVehicle')}</p>;
  return (
    <div data-testid="selected-vehicle" className="border-2 border-line-strong p-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {t(`sim.vehicleTypes.${VEHICLE_KEYS[sel.type]}`)}{' '}
          <span className="num text-xs text-ink-2">#{sel.id}</span>
        </span>
        <button
          type="button"
          aria-label={t('search.close')}
          onClick={() => c.select(null)}
          className="p-1 hover:bg-surface-2"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-2">{t('sim.meanSpeed')}</dt>
        <dd className="num text-right">
          {fmtNum(kmh(sel.speed), lang)} {t('sim.units.kmh')}
        </dd>
        <dt className="text-ink-2">{t('sim.elapsed')}</dt>
        <dd className="num text-right">{fmtDuration(sel.elapsed)}</dd>
        <dt className="text-ink-2">{t('sim.eta')}</dt>
        <dd className="num text-right">{fmtDuration(sel.eta)}</dd>
        <dt className="text-ink-2">{t('sim.distanceLeft')}</dt>
        <dd className="num text-right">
          {fmtNum(sel.distanceLeft / 1000, lang, 2)} {t('sim.units.km')}
        </dd>
        <dt className="text-ink-2">{t('sim.reroutes')}</dt>
        <dd className="num text-right">{sel.reroutes}</dd>
      </dl>
      <div className="mt-2">
        <Button
          variant={followId === sel.id ? 'solid' : 'outline'}
          onClick={() => c.setFollow(followId !== sel.id)}
          testId="follow-button"
        >
          <Crosshair size={16} aria-hidden /> {followId === sel.id ? t('sim.unfollow') : t('sim.follow')}
        </Button>
      </div>
    </div>
  );
}

function StatsGrid({ c }: { c: SimController }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const st = useSim(c, (s) => s.stats);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label={t('sim.vehicles')} value={st ? fmtNum(st.active, lang) : '–'} testId="stat-vehicles" />
      <Stat
        label={t('sim.meanSpeed')}
        value={st ? fmtNum(kmh(st.meanSpeed), lang) : '–'}
        unit={t('sim.units.kmh')}
      />
      <Stat label={t('sim.stopped')} value={st ? fmtNum(st.stopped, lang) : '–'} />
      <Stat label={t('sim.trips')} value={st ? fmtNum(st.tripsDone, lang) : '–'} />
      <Stat
        label={t('lab.meanTravelTime')}
        value={st ? fmtDuration(st.meanTravelTime) : '–'}
        unit={t('sim.units.min')}
      />
      <Stat
        label={t('lab.throughput')}
        value={st ? fmtNum(st.throughput, lang) : '–'}
        unit={t('sim.units.vehH')}
      />
    </div>
  );
}

export default function LiveCity() {
  const { t } = useTranslation();
  const quality = useSettings((s) => s.quality);
  const lang = useSettings((s) => s.lang);
  const { seed, size, live, setLive } = useCityStore();
  const loadEditor = useEditorStore((s) => s.load);
  const c = useSimController();
  const [heatmap, setHeatmap] = useState(false);
  const [demand, setDemand] = useState(1);
  const [seedInput, setSeedInput] = useState(String(seed));
  const mode = useSim(c, (s) => s.mode);
  const err = useSim(c, (s) => s.error);
  const hour = useSim(c, (s) => s.stats?.hour ?? 7);
  const webgl = useMemo(hasWebGL, []);
  const net = useMemo(() => compileNetwork(live), [live]);
  const decor = useMemo(() => buildDecor(live), [live]);
  const q = QUALITY[quality];

  useEffect(() => {
    c.init({
      city: live,
      seed: live.seed ?? 1,
      startHour: 6.6,
      demand: { kind: 'zones', peakPerHour: q.demand * demand },
      maxVehicles: q.maxVehicles,
    });
    // permintaan & batas kendaraan diperbarui lewat params tanpa mengulang simulasi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, live]);
  useEffect(() => {
    c.params({ peakPerHour: q.demand * demand, maxVehicles: q.maxVehicles });
  }, [c, q, demand]);

  const onPick = (x: number, y: number) => {
    const id = c.pick(x, y, 10);
    c.select(id, false);
  };

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem-3.5rem)] flex-1 overflow-hidden xl:min-h-[calc(100dvh-3.5rem)]">
      <h1 className="sr-only">{t('nav.city')}</h1>
      {webgl ? (
        <ErrorBoundary kind="webgl">
          <CityCanvas bounds={net.bounds} controller={c} onGroundClick={onPick}>
            <StaticCity doc={live} net={net} decor={decor} />
            <TransitStatic doc={live} net={net} />
            <Signals c={c} net={net} />
            <Heatmap c={c} net={net} visible={heatmap} />
            <Vehicles c={c} />
            <Pedestrians c={c} />
            <Trains c={c} />
            <SelectionMarker c={c} />
            <RouteLine c={c} />
          </CityCanvas>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary kind="webgl">
          <WebGLMissing />
        </ErrorBoundary>
      )}
      <div className="absolute left-3 top-3 z-10 w-fit max-w-[calc(100%-1.5rem)]">
        <TimeControls c={c} />
        {mode === 'main' && <p className="mt-2 max-w-xs bg-surface p-2 text-xs">{t('sim.noWorker')}</p>}
        {err && <p className="mt-2 max-w-xs bg-surface p-2 text-xs text-accent">{err}</p>}
      </div>
      <SidePanel
        title={t('nav.city')}
        code="M1"
        summary={
          <div className="flex items-center justify-between text-sm">
            <span className="num">{fmtClock(hour)}</span>
            <span>{t('sim.tapVehicle')}</span>
          </div>
        }
      >
        <Section title={t('sim.selected')}>
          <SelectedCard c={c} />
        </Section>
        <Section title={t('analytics.summary')}>
          <StatsGrid c={c} />
        </Section>
        <Section title={t('settings.settings')}>
          <Toggle label={t('sim.heatmap')} checked={heatmap} onChange={setHeatmap} testId="toggle-heatmap" />
          {heatmap && <DensityLegend />}
          <Slider
            label={t('sim.demand')}
            value={demand}
            min={0.25}
            max={2}
            step={0.25}
            onChange={setDemand}
            format={(v) => `${fmtNum(v, lang, 2)}×`}
          />
        </Section>
        <Section title={t('sim.newCity')}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="block text-ink-2">{t('sim.seed')}</span>
              <input
                value={seedInput}
                inputMode="numeric"
                onChange={(e) => setSeedInput(e.target.value.replace(/\D/g, '').slice(0, 9))}
                className="num mt-1 h-9 w-28 border-2 border-line-strong bg-paper px-2"
              />
            </label>
            <select
              value={size}
              aria-label={t('sim.newCity')}
              onChange={(e) => setLive(Number(seedInput) || 1, e.target.value as CitySize)}
              className="h-9 border-2 border-line-strong bg-paper px-2 text-sm"
            >
              <option value="small">S</option>
              <option value="medium">M</option>
              <option value="large">L</option>
            </select>
            <Button onClick={() => setLive(Number(seedInput) || 1)}>{t('sim.newCity')}</Button>
            <Button
              variant="ghost"
              title={t('sim.newCity')}
              onClick={() => {
                const s = Math.floor(Math.random() * 99999) + 1;
                setSeedInput(String(s));
                setLive(s);
              }}
            >
              <Dices size={16} aria-hidden />
            </Button>
          </div>
        </Section>
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Link
            to="/editor"
            onClick={() => loadEditor(live)}
            className="inline-flex items-center gap-1.5 border-2 border-line-strong px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
          >
            <PenTool size={16} aria-hidden /> {t('lab.openEditor')}
          </Link>
          <Link
            to="/analytics?src=live"
            className="inline-flex items-center gap-1.5 border-2 border-line-strong px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
          >
            <ChartSpline size={16} aria-hidden /> {t('lab.openAnalytics')}
          </Link>
        </div>
      </SidePanel>
    </div>
  );
}

function WebGLMissing(): never {
  throw new Error('WebGL not available');
}
