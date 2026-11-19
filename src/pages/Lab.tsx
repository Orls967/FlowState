import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  ChartSpline,
  Eye,
  Hand,
  OctagonAlert,
  PenTool,
  RotateCcw,
} from 'lucide-react';
import { PHENOMENA, PHENOMENON_BY_ID } from '../content/phenomena';
import { SCENARIO_BY_ID, type ScenarioDef } from '../content/scenarios';
import { CityCanvas } from '../scene/CityCanvas';
import { StaticCity } from '../scene/StaticCity';
import { Pedestrians, Signals, Vehicles } from '../scene/DynamicLayers';
import { useSim, useSimController, type SimController } from '../scene/SimController';
import { compileNetwork } from '../lib/sim/network';
import { useSettings } from '../store/settings';
import { useEditorStore } from '../store/editor';
import { PageHeader } from '../ui/PageHeader';
import { RichText } from '../ui/RichText';
import { SpaceTime } from '../ui/SpaceTime';
import { TimeControls } from '../ui/TimeControls';
import { Button, Slider } from '../ui/Panel';
import { ErrorBoundary, hasWebGL } from '../ui/ErrorBoundary';
import { METRICS } from '../ui/metrics';
import { fmtNum } from '../ui/format';
import type { LiveStats } from '../lib/sim/engine';

function LabIndex() {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader code="M3" title={t('lab.title')}>
        <p className="mt-2 max-w-2xl text-ink-2">{t('lab.intro')}</p>
      </PageHeader>
      <ol className="divide-y-2 divide-line border-b-2 border-line-strong">
        {PHENOMENA.map((p) => (
          <li key={p.id}>
            <Link
              to={`/lab/${p.id}`}
              className="group flex items-start gap-4 px-4 py-4 hover:bg-surface sm:px-6"
              data-testid={`lab-item-${p.id}`}
            >
              <span className="num mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-ink text-xs font-semibold group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent">
                {p.code}
              </span>
              <span className="flex-1">
                <span className="block font-display text-lg font-semibold">{p.title[lang]}</span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-2">{p.summary[lang]}</span>
              </span>
              <ArrowRight
                size={18}
                aria-hidden
                className="mt-2 shrink-0 text-ink-2 group-hover:text-accent"
              />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

type Acc = { sums: Partial<Record<string, number>>; n: number };

/** Kumpulkan rata-rata metrik per varian setelah pemanasan. */
function useResults(c: SimController, sc: ScenarioDef, key: string) {
  const stats = useSim(c, (s) => s.stats);
  const [results, setResults] = useState<Record<string, Record<string, number>>>({});
  const acc = useRef<Record<string, Acc>>({});
  useEffect(() => {
    if (!stats || stats.t < sc.warmup) return;
    const a = (acc.current[key] ??= { sums: {}, n: 0 });
    a.n++;
    for (const m of sc.metrics) a.sums[m] = (a.sums[m] ?? 0) + METRICS[m].value(stats);
    if (a.n % 4 === 0 || a.n < 4) {
      const avg: Record<string, number> = {};
      for (const m of sc.metrics) avg[m] = (a.sums[m] ?? 0) / a.n;
      setResults((r) => ({ ...r, [key]: avg }));
    }
  }, [stats, sc, key]);
  return { results, reset: () => ((acc.current = {}), setResults({})) };
}

function LabDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const navigate = useNavigate();
  const ph = PHENOMENON_BY_ID.get(id)!;
  const sc = SCENARIO_BY_ID.get(id)!;
  const [variant, setVariant] = useState(sc.defaultVariant);
  const [level, setLevel] = useState(sc.slider?.value ?? 0);
  const [runId, setRunId] = useState(0);
  const c = useSimController();
  const config = useMemo(() => sc.build(variant, level), [sc, variant, level]);
  const net = useMemo(() => compileNetwork(config.city), [config]);
  const webgl = useMemo(hasWebGL, []);
  const stats = useSim(c, (s) => s.stats);
  const loadEditor = useEditorStore((s) => s.load);
  const resultKey = `${variant}@${level}`;
  const { results, reset } = useResults(c, sc, resultKey);

  useEffect(() => {
    c.init(config, { speed: c.store.getState().speed === 1 ? 4 : c.store.getState().speed, paused: false });
  }, [c, config, runId]);

  const fmt = (m: (typeof sc.metrics)[number], v: number | undefined) =>
    v === undefined ? '–' : METRICS[m].format(v, lang, t);
  const levelLabel = sc.slider?.kind === 'vehicles' ? t('sim.vehicles') : t('sim.demand');
  const levelFmt = (v: number) =>
    sc.slider?.kind === 'vehicles' ? fmtNum(v, lang) : `${fmtNum(v, lang)} ${t('sim.units.vehH')}`;

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(22rem,30rem)_1fr]">
      <article className="order-2 border-line-strong px-4 py-4 sm:px-6 lg:order-1 lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-r-2">
        <Link to="/lab" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> {t('lab.back')}
        </Link>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="num border-2 border-line-strong px-1.5 text-xs font-semibold">{ph.code}</span>
          <h1 className="font-display text-2xl font-semibold leading-tight">{ph.title[lang]}</h1>
        </div>
        <RichText text={ph.summary[lang]} className="mt-3 leading-relaxed text-ink-2" />

        <section className="mt-5" aria-labelledby="variant-h">
          <h2 id="variant-h" className="station-label mb-2">
            {t('lab.variant')}
          </h2>
          <div role="radiogroup" aria-labelledby="variant-h" className="flex border-2 border-line-strong">
            {ph.variants.map((v) => (
              <button
                key={v.key}
                type="button"
                role="radio"
                aria-checked={variant === v.key}
                data-testid={`variant-${v.key}`}
                onClick={() => setVariant(v.key)}
                className={`flex-1 px-2 py-2 text-sm font-semibold ${variant === v.key ? 'bg-ink text-paper' : 'hover:bg-surface-2'}`}
              >
                {v.label[lang]}
              </button>
            ))}
          </div>
          {sc.slider && (
            <Slider
              label={levelLabel}
              value={level}
              min={sc.slider.min}
              max={sc.slider.max}
              step={sc.slider.step}
              onChange={setLevel}
              format={levelFmt}
            />
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {sc.brake && (
              <Button variant="solid" onClick={() => c.brake()} testId="brake-now">
                <OctagonAlert size={16} aria-hidden /> {t('lab.brakeNow')}
              </Button>
            )}
            <Button
              onClick={() => {
                reset();
                setRunId((r) => r + 1);
              }}
            >
              <RotateCcw size={16} aria-hidden /> {t('sim.reset')}
            </Button>
          </div>
        </section>

        <section className="mt-5" aria-labelledby="results-h">
          <h2 id="results-h" className="station-label mb-2">
            {t('lab.results')}
          </h2>
          {stats && stats.t < sc.warmup && (
            <p className="num mb-2 text-xs text-ink-2" data-testid="warming-up">
              {t('lab.warmingUp', { s: Math.ceil(sc.warmup - stats.t) })}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" data-testid="results-table">
              <thead>
                <tr className="border-b-2 border-line-strong text-left">
                  <th className="py-1 pr-2 font-normal text-ink-2">{t('lab.metrics')}</th>
                  {ph.variants.map((v) => (
                    <th
                      key={v.key}
                      className={`py-1 pr-2 font-semibold ${v.key === variant ? 'text-accent' : ''}`}
                    >
                      {v.label[lang]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sc.metrics.map((m) => {
                  const vals = ph.variants.map((v) => results[`${v.key}@${level}`]?.[m]);
                  const defined = vals.filter((x): x is number => x !== undefined);
                  const best =
                    defined.length > 1
                      ? METRICS[m].lowerIsBetter
                        ? Math.min(...defined)
                        : Math.max(...defined)
                      : undefined;
                  return (
                    <tr key={m} className="border-b border-line">
                      <td className="py-1.5 pr-2 text-ink-2">{METRICS[m].label(t)}</td>
                      {vals.map((v, i) => (
                        <td
                          key={i}
                          className={`num py-1.5 pr-2 ${v !== undefined && v === best ? 'font-semibold' : ''}`}
                        >
                          {fmt(m, v)}
                          {v !== undefined && v === best && <span className="ml-1 text-accent">●</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-ink-2">{t('lab.resultsHint')}</p>
        </section>

        <section className="mt-5" aria-labelledby="steps-h">
          <h2 id="steps-h" className="station-label mb-2">
            {t('lab.steps')}
          </h2>
          <ol className="relative ml-3 border-l-[3px] border-ink">
            {ph.steps.map((s, i) => (
              <li key={i} className="relative mb-3 pl-5 last:mb-0">
                <span
                  aria-hidden
                  className={`absolute -left-[0.6rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-[3px] border-ink ${s.kind === 'try' ? 'bg-accent' : 'bg-paper'}`}
                />
                <span className="station-label flex items-center gap-1">
                  {s.kind === 'try' ? <Hand size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
                  {t(s.kind === 'try' ? 'lab.try' : 'lab.observe')}
                </span>
                <RichText text={s.text[lang]} className="mt-0.5 text-sm leading-relaxed" />
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5" aria-labelledby="why-h">
          <h2 id="why-h" className="station-label mb-2">
            {t('lab.why')}
          </h2>
          <RichText text={ph.why[lang]} className="text-sm leading-relaxed" />
        </section>
        <section className="mt-4 border-l-4 border-accent bg-surface p-3" aria-labelledby="caveat-h">
          <h2 id="caveat-h" className="station-label mb-1">
            {t('lab.caveat')}
          </h2>
          <RichText text={ph.caveat[lang]} className="text-sm leading-relaxed" />
          {ph.source && (
            <p className="mt-2 text-xs text-ink-2">
              {t('lab.source')}: {ph.source}
            </p>
          )}
        </section>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button
            onClick={() => {
              loadEditor(config.city);
              navigate('/editor');
            }}
            testId="open-editor"
          >
            <PenTool size={16} aria-hidden /> {t('lab.openEditor')}
          </Button>
          <Button
            onClick={() => navigate(`/analytics?lab=${id}&v=${variant}&level=${level}`)}
            testId="open-analytics"
          >
            <ChartSpline size={16} aria-hidden /> {t('lab.openAnalytics')}
          </Button>
        </div>
      </article>

      <div className="relative order-1 flex min-h-[55dvh] flex-col lg:order-2 lg:min-h-[calc(100dvh-3.5rem)]">
        <div className="relative min-h-[42dvh] flex-1">
          {webgl ? (
            <ErrorBoundary kind="webgl">
              <CityCanvas bounds={net.bounds} controller={c} hour={12} fit={1}>
                <StaticCity doc={config.city} net={net} decor={null} />
                <Signals c={c} net={net} />
                <Vehicles c={c} />
                <Pedestrians c={c} />
              </CityCanvas>
            </ErrorBoundary>
          ) : (
            <p className="p-6">{t('errors.webgl')}</p>
          )}
          <div className="absolute left-3 top-3 z-10">
            <TimeControls c={c} showClock={false} />
          </div>
          <LiveMetrics c={c} sc={sc} />
        </div>
        {sc.spaceTime && (
          <div className="border-t-2 border-line-strong p-3">
            <SpaceTime c={c} />
          </div>
        )}
      </div>
    </div>
  );
}

function LiveMetrics({ c, sc }: { c: SimController; sc: ScenarioDef }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const stats = useSim(c, (s) => s.stats);
  return (
    <dl
      className="absolute bottom-3 left-3 right-3 z-10 grid grid-cols-2 gap-2 sm:right-auto sm:flex sm:flex-wrap"
      data-testid="live-metrics"
    >
      {sc.metrics.map((m) => (
        <div key={m} className="border-2 border-line-strong bg-surface px-2 py-1">
          <dt className="text-[0.68rem] text-ink-2">{METRICS[m].label(t)}</dt>
          <dd className="num text-sm font-semibold">
            {stats ? METRICS[m].format(METRICS[m].value(stats as LiveStats), lang, t) : '–'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function Lab() {
  const { id } = useParams();
  if (id && PHENOMENON_BY_ID.has(id) && SCENARIO_BY_ID.has(id)) return <LabDetail key={id} id={id} />;
  return <LabIndex />;
}
