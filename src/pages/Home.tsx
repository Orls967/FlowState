import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { MODULES } from '../ui/modules';

/** Peta modul bergaya diagram jalur MRT: garis tegas, stasiun bulat, label rapi. */
function ModuleRouteMap() {
  const { t } = useTranslation();
  const mains = MODULES.filter((m) => m.main);
  // Titik stasiun di sepanjang jalur bersudut 45° (konvensi peta transit).
  const pts: [number, number][] = [
    [40, 60],
    [140, 60],
    [210, 130],
    [210, 220],
    [300, 310],
    [420, 310],
  ];
  const path = `M ${pts.map((p) => p.join(' ')).join(' L ')}`;
  return (
    <figure className="w-full">
      <figcaption className="station-label mb-2">{t('home.routeTitle')}</figcaption>
      <svg viewBox="0 0 520 400" className="w-full" role="img" aria-label={t('home.routeTitle')}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--fs-grid)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="520" height="400" fill="url(#grid)" />
        <path d={path} fill="none" stroke="var(--fs-line-strong)" strokeWidth="12" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="var(--fs-accent)" strokeWidth="6" strokeLinejoin="round" />
        {mains.map((m, i) => {
          const [x, y] = pts[i];
          // Penempatan label per stasiun agar tidak menimpa garis.
          const place = (['top', 'top', 'right', 'left', 'below', 'top'] as const)[i];
          const lx = place === 'right' ? x + 24 : place === 'left' ? x - 24 : x;
          const ly = place === 'top' ? y - 24 : place === 'below' ? y + 36 : y + 5;
          const anchor = place === 'right' ? 'start' : place === 'left' ? 'end' : 'middle';
          return (
            <Link key={m.key} to={m.path} aria-label={t(`nav.${m.key}`)}>
              <g className="cursor-pointer [&:hover_circle]:fill-[var(--fs-accent-soft)]">
                <circle
                  cx={x}
                  cy={y}
                  r="13"
                  fill="var(--fs-paper)"
                  stroke="var(--fs-line-strong)"
                  strokeWidth="5"
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  fill="var(--fs-ink)"
                  style={{ font: '600 15px var(--font-display)' }}
                >
                  {t(`nav.${m.key}`)}
                </text>
                <text
                  x={lx}
                  y={place === 'top' ? y + 36 : place === 'below' ? y + 52 : y + 22}
                  textAnchor={anchor}
                  fill="var(--fs-ink-2)"
                  style={{ font: '400 11px var(--font-mono)' }}
                >
                  {m.code}
                </text>
              </g>
            </Link>
          );
        })}
      </svg>
    </figure>
  );
}

export default function Home() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:py-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="station-label">{t('home.kicker')}</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-[1.05] sm:text-5xl">
            {t('home.title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">{t('home.lead')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/city"
              className="inline-flex items-center gap-2 bg-accent px-4 py-3 font-semibold text-on-accent shadow-[3px_3px_0_var(--fs-line-strong)] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_var(--fs-line-strong)]"
            >
              {t('home.start')} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              to="/lab/sugiyama"
              className="inline-flex items-center gap-2 border-2 border-line-strong px-4 py-2.5 font-semibold hover:bg-surface-2"
            >
              {t('home.labCta')}
            </Link>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 border-y-2 border-line-strong">
            {[
              ['2.000+', t('home.facts.agents')],
              ['500+', t('home.facts.mobile')],
              ['100%', t('home.facts.client')],
            ].map(([n, label], i) => (
              <div key={label} className={`py-3 ${i > 0 ? 'border-l-2 border-line pl-3' : ''}`}>
                <dt className="sr-only">{label}</dt>
                <dd className="num text-2xl font-semibold">{n}</dd>
                <dd className="text-xs text-ink-2">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ModuleRouteMap />
      </section>

      <section className="mt-14" aria-labelledby="modules-h">
        <h2 id="modules-h" className="station-label">
          {t('nav.modules')}
        </h2>
        <ol className="mt-3 grid border-t-2 border-line-strong md:grid-cols-2 xl:grid-cols-3">
          {MODULES.filter((m) => m.main).map((m) => {
            const Icon = m.icon;
            return (
              <li
                key={m.key}
                className="border-b-2 border-line md:odd:border-r-2 xl:border-r-2 xl:[&:nth-child(3n)]:border-r-0"
              >
                <Link to={m.path} className="group flex gap-4 p-4 hover:bg-surface">
                  <span className="num flex h-10 w-10 shrink-0 items-center justify-center bg-ink text-sm font-semibold text-paper group-hover:bg-accent group-hover:text-on-accent">
                    {m.code}
                  </span>
                  <span>
                    <span className="flex items-center gap-2 font-display text-lg font-semibold">
                      <Icon size={18} aria-hidden /> {t(`nav.${m.key}`)}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-2">
                      {t(`home.desc.${m.key as 'city'}`)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-sm text-ink-2">{t('app.educational')}</p>
      </section>
    </div>
  );
}
