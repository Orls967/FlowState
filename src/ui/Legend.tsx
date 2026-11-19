import { useTranslation } from 'react-i18next';
import { useSettings } from '../store/settings';
import { PRESETS } from '../scene/themePresets';

export function DensityLegend() {
  const { t } = useTranslation();
  const theme = useSettings((s) => s.theme);
  const [a, b, c] = PRESETS[theme].density;
  return (
    <div className="text-xs">
      <div
        className="h-2.5 w-full border border-line-strong"
        style={{ background: `linear-gradient(90deg, ${a}, ${b}, ${c})` }}
      />
      <div className="mt-1 flex justify-between text-ink-2">
        <span>
          {t('sim.densityLow')} <span className="num">0</span>
        </span>
        <span className="num">35</span>
        <span>
          <span className="num">90+</span> {t('sim.units.vehKm')} · {t('sim.densityHigh')}
        </span>
      </div>
    </div>
  );
}
