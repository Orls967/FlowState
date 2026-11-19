import { useCallback, useEffect, useRef, useState } from 'react';
import type { SimConfig, LiveStats, TimeSample } from '../lib/sim/engine';
import type { FdPoint } from '../lib/sim/protocol';
import { createSimHost, type SimHost } from '../workers/simHost';

export interface HeadlessResult {
  samples: TimeSample[];
  fd: FdPoint[];
  stats: LiveStats;
  densities: Float32Array;
}

/** Jalankan beberapa simulasi tanpa tampilan secara paralel (satu Worker per skenario). */
export function useHeadlessRuns() {
  const [progress, setProgress] = useState<number[] | null>(null);
  const [results, setResults] = useState<(HeadlessResult | null)[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hosts = useRef<SimHost[]>([]);

  const stop = useCallback(() => {
    hosts.current.forEach((h) => h.terminate());
    hosts.current = [];
  }, []);
  useEffect(() => stop, [stop]);

  const run = useCallback(
    (configs: SimConfig[], duration: number) => {
      stop();
      setError(null);
      setResults(configs.map(() => null));
      setProgress(configs.map(() => 0));
      configs.forEach((config, i) => {
        const host = createSimHost();
        hosts.current.push(host);
        host.subscribe((m) => {
          if (m.type === 'progress') setProgress((p) => (p ? p.map((v, k) => (k === i ? m.pct : v)) : p));
          else if (m.type === 'headlessDone') {
            setResults((r) =>
              r
                ? r.map((v, k) =>
                    k === i ? { samples: m.samples, fd: m.fd, stats: m.stats, densities: m.densities } : v,
                  )
                : r,
            );
            setProgress((p) => (p ? p.map((v, k) => (k === i ? 100 : v)) : p));
            host.terminate();
          } else if (m.type === 'error') setError(m.message);
        });
        host.post({ type: 'headless', duration, config });
      });
    },
    [stop],
  );

  const running = !!progress && progress.some((p) => p < 100);
  const done = !!results && results.every((r) => r !== null);
  return { run, stop, progress, results, running, done, error };
}

export interface RunSummary {
  meanTravelTime: number;
  meanSpeed: number;
  meanDensity: number;
  meanActive: number;
  stopped: number;
  throughput: number;
  emissionsPerTrip: number;
  modeCounts: readonly number[];
}

/** Ringkas hasil satu jalan: rata-rata sampel setelah `skip` detik pemanasan. */
export function summarize(r: HeadlessResult, skip = 900): RunSummary {
  const ss = r.samples.filter((x) => x.t >= skip);
  const use = ss.length ? ss : r.samples;
  const avg = (f: (x: TimeSample) => number) =>
    use.length ? use.reduce((a, x) => a + f(x), 0) / use.length : 0;
  const withTt = use.filter((x) => x.meanTravelTime > 0);
  return {
    meanTravelTime: withTt.length ? withTt.reduce((a, x) => a + x.meanTravelTime, 0) / withTt.length : 0,
    meanSpeed: avg((x) => x.meanSpeed),
    meanDensity: avg((x) => x.meanDensity),
    meanActive: avg((x) => x.active),
    stopped: avg((x) => x.stopped),
    throughput: avg((x) => x.throughput),
    emissionsPerTrip: r.stats.emissionsPerTrip,
    modeCounts: r.stats.modeCounts,
  };
}
