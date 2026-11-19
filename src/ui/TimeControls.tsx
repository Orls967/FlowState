import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from 'lucide-react';
import type { SimController } from '../scene/SimController';
import { useSim } from '../scene/SimController';
import { fmtClock } from './format';

const SPEEDS = [1, 4, 16] as const;

export function TimeControls({ c, showClock = true }: { c: SimController; showClock?: boolean }) {
  const { t } = useTranslation();
  const paused = useSim(c, (s) => s.paused);
  const speed = useSim(c, (s) => s.speed);
  const hour = useSim(c, (s) => s.stats?.hour ?? null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'BUTTON') {
        e.preventDefault();
        c.setPaused(!c.store.getState().paused);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [c]);
  return (
    <div className="flex items-stretch border-2 border-line-strong bg-surface shadow-[3px_3px_0_var(--fs-line-strong)]">
      {showClock && (
        <div className="flex items-center gap-2 border-r-2 border-line-strong px-3" aria-live="off">
          <span className="sr-only">{t('sim.time')}</span>
          <span className="num text-lg font-semibold" data-testid="sim-clock">
            {hour !== null ? fmtClock(hour) : '--:--'}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={() => c.setPaused(!paused)}
        aria-label={paused ? t('sim.play') : t('sim.pause')}
        data-testid="play-pause"
        className="flex h-11 w-11 items-center justify-center border-r-2 border-line-strong hover:bg-surface-2"
      >
        {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
      </button>
      <div role="radiogroup" aria-label={t('sim.speed')} className="flex">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            onClick={() => c.setSpeed(s)}
            className={`num min-w-11 px-2 text-sm font-semibold ${speed === s ? 'bg-ink text-paper' : 'hover:bg-surface-2'}`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
