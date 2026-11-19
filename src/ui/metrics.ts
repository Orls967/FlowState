import type { TFunction } from 'i18next';
import type { LiveStats } from '../lib/sim/engine';
import type { MetricKey } from '../content/scenarios';
import type { Lang } from '../content/types';
import { fmtDuration, fmtNum, kmh } from './format';

export interface MetricDef {
  label: (t: TFunction) => string;
  value: (s: LiveStats) => number;
  format: (v: number, lang: Lang, t: TFunction) => string;
  /** true bila nilai lebih kecil = lebih baik */
  lowerIsBetter: boolean;
}

export const METRICS: Record<MetricKey, MetricDef> = {
  meanTravelTime: {
    label: (t) => t('lab.meanTravelTime'),
    value: (s) => s.meanTravelTime,
    format: (v) => fmtDuration(v),
    lowerIsBetter: true,
  },
  throughput: {
    label: (t) => t('lab.throughput'),
    value: (s) => s.throughput,
    format: (v, l, t) => `${fmtNum(v, l)} ${t('sim.units.vehH')}`,
    lowerIsBetter: false,
  },
  stopped: {
    label: (t) => t('sim.stopped'),
    value: (s) => s.stopped,
    format: (v, l) => fmtNum(v, l, 1),
    lowerIsBetter: true,
  },
  stopsPerVehicle: {
    label: (t) => t('lab.stops'),
    value: (s) => s.stopsPerVehicle,
    format: (v, l) => fmtNum(v, l, 2),
    lowerIsBetter: true,
  },
  meanDelay: {
    label: (t) => t('lab.delay'),
    value: (s) => s.meanDelay,
    format: (v) => fmtDuration(v),
    lowerIsBetter: true,
  },
  speedStd: {
    label: (t) => t('lab.stdSpeed'),
    value: (s) => kmh(s.speedStd),
    format: (v, l, t) => `${fmtNum(v, l, 1)} ${t('sim.units.kmh')}`,
    lowerIsBetter: true,
  },
  meanSpeed: {
    label: (t) => t('sim.meanSpeed'),
    value: (s) => kmh(s.meanSpeed),
    format: (v, l, t) => `${fmtNum(v, l, 1)} ${t('sim.units.kmh')}`,
    lowerIsBetter: false,
  },
  queueLength: {
    label: (t) => t('lab.queue'),
    value: (s) => s.queueLength,
    format: (v, l, t) => `${fmtNum(v, l)} ${t('sim.units.m')}`,
    lowerIsBetter: true,
  },
};
