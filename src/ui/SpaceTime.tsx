import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { scaleLinear } from 'd3-scale';
import { interpolateLab } from 'd3-interpolate';
import type { SimController } from '../scene/SimController';
import { useSettings } from '../store/settings';
import { PRESETS } from '../scene/themePresets';

const WINDOW = 300; // detik simulasi yang ditampilkan

/**
 * Diagram ruang–waktu bergulir: sumbu x = waktu (jendela 5 menit, menimpa seperti osiloskop),
 * sumbu y = posisi di koridor, warna = kecepatan (lambat = gelap/merah).
 */
export function SpaceTime({ c }: { c: SimController }) {
  const { t } = useTranslation();
  const theme = useSettings((s) => s.theme);
  const ref = useRef<HTMLCanvasElement>(null);
  const lastX = useRef(-1);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const preset = PRESETS[theme];
    const [fast, mid, slow] = preset.density;
    const color = scaleLinear<string>()
      .domain([0, 4, 12])
      .range([slow, mid, fast])
      .interpolate(interpolateLab)
      .clamp(true);
    const W = canvas.width;
    const H = canvas.height;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--fs-surface').trim() || '#fff';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    lastX.current = -1;
    return c.onCorridor((data, len, time) => {
      if (len <= 0) return;
      const x = Math.floor(((time % WINDOW) / WINDOW) * W);
      // hapus pita di depan kursor
      const prev = lastX.current;
      const from = prev < 0 ? x : prev + 1;
      ctx.fillStyle = bg;
      if (from <= x) ctx.fillRect(from, 0, x - from + 6, H);
      else {
        ctx.fillRect(from, 0, W - from, H);
        ctx.fillRect(0, 0, x + 6, H);
      }
      lastX.current = x;
      const w = prev >= 0 && x > prev && x - prev < 40 ? x - prev : 2;
      for (let i = 0; i < data.length; i += 2) {
        const y = H - (data[i] / len) * H;
        ctx.fillStyle = color(data[i + 1]);
        ctx.fillRect(x - w + 1, y - 1.5, w, 3);
      }
      ctx.fillStyle = preset.route;
      ctx.fillRect(x + 1, 0, 1, H);
    });
  }, [c, theme]);
  return (
    <figure className="border-2 border-line-strong bg-surface p-2">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="station-label">{t('lab.spaceTime')}</span>
        <span className="text-[0.7rem] text-ink-2">
          ↑ {t('lab.position')} · → {t('lab.time')} (5 {t('sim.units.min')})
        </span>
      </figcaption>
      <canvas
        ref={ref}
        width={600}
        height={200}
        className="h-36 w-full [image-rendering:pixelated] sm:h-44"
        role="img"
        aria-label={t('lab.spaceTimeHint')}
        data-testid="space-time"
      />
      <p className="mt-1 text-[0.72rem] text-ink-2">{t('lab.spaceTimeHint')}</p>
    </figure>
  );
}
