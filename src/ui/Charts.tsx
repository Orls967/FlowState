import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';

export interface Series {
  name: string;
  /** warna penanda (token CSS) — teks tetap memakai warna tinta */
  color: string;
  points: { x: number; y: number }[];
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const M = { top: 12, right: 64, bottom: 30, left: 52 };

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {series.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-[3px] w-4 rounded-full"
            style={{ background: s.color }}
          />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

function ChartFrame({ title, children, table }: { title: string; children: ReactNode; table: ReactNode }) {
  const { t } = useTranslation();
  return (
    <figure className="border-2 border-line-strong bg-surface p-3">
      <figcaption className="mb-1 font-display text-sm font-semibold">{title}</figcaption>
      {children}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-ink-2">{t('analytics.table')}</summary>
        <div className="mt-1 max-h-48 overflow-auto">{table}</div>
      </details>
    </figure>
  );
}

/** Grafik garis multi-seri dengan crosshair + tooltip, legenda, label langsung di ujung garis. */
export function LineChart({
  title,
  series,
  xFormat,
  yFormat,
  xLabel,
  height = 200,
}: {
  title: string;
  series: Series[];
  xFormat: (v: number) => string;
  yFormat: (v: number) => string;
  xLabel: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x = scaleLinear()
    .domain([Math.min(...xs, 0), Math.max(...xs, 1)])
    .range([M.left, width - M.right]);
  const y = scaleLinear()
    .domain([0, Math.max(...ys, 1) * 1.08])
    .nice()
    .range([height - M.bottom, M.top]);
  const path = line<{ x: number; y: number }>()
    .x((p) => x(p.x))
    .y((p) => y(p.y));
  const xTicks = x.ticks(Math.max(2, Math.floor(width / 90)));
  const yTicks = y.ticks(4);
  const hx = hover !== null ? x.invert(hover) : null;
  const nearest = (s: Series) => {
    if (hx === null || !s.points.length) return null;
    let best = s.points[0];
    for (const p of s.points) if (Math.abs(p.x - hx) < Math.abs(best.x - hx)) best = p;
    return best;
  };
  const table = (
    <table className="w-full">
      <thead>
        <tr>
          <th className="text-left font-normal text-ink-2">{xLabel}</th>
          {series.map((s) => (
            <th key={s.name} className="text-left">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="num">
        {(series[0]?.points ?? [])
          .filter((_, i, arr) => i % Math.max(1, Math.ceil(arr.length / 24)) === 0)
          .map((p) => (
            <tr key={p.x}>
              <td>{xFormat(p.x)}</td>
              {series.map((s) => {
                const q = s.points.find((z) => z.x === p.x);
                return <td key={s.name}>{q ? yFormat(q.y) : '–'}</td>;
              })}
            </tr>
          ))}
      </tbody>
    </table>
  );
  return (
    <ChartFrame title={title} table={table}>
      <Legend series={series} />
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={title}
          className="block touch-none"
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - r.left;
            setHover(px >= M.left && px <= width - M.right ? px : null);
          }}
          onPointerLeave={() => setHover(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--fs-line)"
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : '2 3'}
              />
              <text
                x={M.left - 6}
                y={y(v)}
                dy="0.32em"
                textAnchor="end"
                className="num fill-ink-2 text-[10px]"
              >
                {yFormat(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text
              key={v}
              x={x(v)}
              y={height - M.bottom + 16}
              textAnchor="middle"
              className="num fill-ink-2 text-[10px]"
            >
              {xFormat(v)}
            </text>
          ))}
          {series.map((s) => (
            <g key={s.name}>
              <path
                d={path(s.points) ?? ''}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.points.length > 0 && (
                <text
                  x={x(s.points[s.points.length - 1].x) + 6}
                  y={y(s.points[s.points.length - 1].y)}
                  dy="0.32em"
                  className="fill-ink text-[10px] font-semibold"
                >
                  {s.name}
                </text>
              )}
            </g>
          ))}
          {hover !== null && (
            <g>
              <line
                x1={hover}
                x2={hover}
                y1={M.top}
                y2={height - M.bottom}
                stroke="var(--fs-ink-2)"
                strokeWidth={1}
              />
              {series.map((s) => {
                const p = nearest(s);
                return p ? (
                  <circle
                    key={s.name}
                    cx={x(p.x)}
                    cy={y(p.y)}
                    r={4.5}
                    fill={s.color}
                    stroke="var(--fs-surface)"
                    strokeWidth={2}
                  />
                ) : null;
              })}
            </g>
          )}
        </svg>
        {hover !== null && hx !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 border-2 border-line-strong bg-paper px-2 py-1 text-xs shadow-[2px_2px_0_var(--fs-line-strong)]"
            style={{ left: Math.min(hover + 10, width - 150) }}
          >
            <div className="num text-ink-2">{xFormat(hx)}</div>
            {series.map((s) => {
              const p = nearest(s);
              return (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span>{s.name}</span>
                  <span className="num ml-auto pl-2 font-semibold">{p ? yFormat(p.y) : '–'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

/** Diagram pencar (diagram fundamental): titik kecil semi-transparan + tooltip titik terdekat. */
export function ScatterChart({
  title,
  series,
  xLabel,
  yLabel,
  height = 240,
}: {
  title: string;
  series: Series[];
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ s: number; i: number } | null>(null);
  const all = series.flatMap((s) => s.points);
  const x = scaleLinear()
    .domain([0, Math.max(10, ...all.map((p) => p.x)) * 1.05])
    .nice()
    .range([M.left, width - 16]);
  const y = scaleLinear()
    .domain([0, Math.max(100, ...all.map((p) => p.y)) * 1.05])
    .nice()
    .range([height - M.bottom - 6, M.top]);
  const thinned = useMemo(
    () =>
      series.map((s) => ({
        ...s,
        points:
          s.points.length > 900
            ? s.points.filter((_, i) => i % Math.ceil(s.points.length / 900) === 0)
            : s.points,
      })),
    [series],
  );
  const table = (
    <table className="w-full">
      <thead>
        <tr>
          <th className="text-left">{''}</th>
          <th className="text-left font-normal text-ink-2">{xLabel}</th>
          <th className="text-left font-normal text-ink-2">{yLabel}</th>
        </tr>
      </thead>
      <tbody className="num">
        {thinned.flatMap((s) =>
          s.points
            .filter((_, i) => i % Math.max(1, Math.ceil(s.points.length / 12)) === 0)
            .map((p, i) => (
              <tr key={`${s.name}${i}`}>
                <td>{s.name}</td>
                <td>{p.x.toFixed(1)}</td>
                <td>{Math.round(p.y)}</td>
              </tr>
            )),
        )}
      </tbody>
    </table>
  );
  const hp = hover ? thinned[hover.s]?.points[hover.i] : null;
  return (
    <ChartFrame title={title} table={table}>
      <Legend series={series} />
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={title}
          className="block touch-none"
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - r.left;
            const py = e.clientY - r.top;
            let best: { s: number; i: number } | null = null;
            let bd = 14;
            thinned.forEach((s, si) =>
              s.points.forEach((p, i) => {
                const d = Math.hypot(x(p.x) - px, y(p.y) - py);
                if (d < bd) {
                  bd = d;
                  best = { s: si, i };
                }
              }),
            );
            setHover(best);
          }}
          onPointerLeave={() => setHover(null)}
        >
          {y.ticks(4).map((v) => (
            <g key={v}>
              <line
                x1={M.left}
                x2={width - 16}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--fs-line)"
                strokeDasharray={v === 0 ? undefined : '2 3'}
              />
              <text
                x={M.left - 6}
                y={y(v)}
                dy="0.32em"
                textAnchor="end"
                className="num fill-ink-2 text-[10px]"
              >
                {v}
              </text>
            </g>
          ))}
          {x.ticks(5).map((v) => (
            <text
              key={v}
              x={x(v)}
              y={height - M.bottom + 10}
              textAnchor="middle"
              className="num fill-ink-2 text-[10px]"
            >
              {v}
            </text>
          ))}
          <text x={width - 16} y={height - 4} textAnchor="end" className="fill-ink-2 text-[10px]">
            {xLabel} →
          </text>
          <text x={4} y={10} className="fill-ink-2 text-[10px]">
            ↑ {yLabel}
          </text>
          {thinned.map((s) => (
            <g key={s.name} fill={s.color} fillOpacity={0.55}>
              {s.points.map((p, i) => (
                <circle key={i} cx={x(p.x)} cy={y(p.y)} r={2.6} />
              ))}
            </g>
          ))}
          {hp && hover && (
            <circle
              cx={x(hp.x)}
              cy={y(hp.y)}
              r={5}
              fill={thinned[hover.s].color}
              stroke="var(--fs-surface)"
              strokeWidth={2}
            />
          )}
        </svg>
        {hp && hover && (
          <div
            className="pointer-events-none absolute top-1 z-10 border-2 border-line-strong bg-paper px-2 py-1 text-xs"
            style={{ left: Math.min(x(hp.x) + 10, width - 150) }}
          >
            <div className="font-semibold">{thinned[hover.s].name}</div>
            <div className="num">
              {xLabel}: {hp.x.toFixed(1)}
            </div>
            <div className="num">
              {yLabel}: {Math.round(hp.y)}
            </div>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
