import { describe, expect, it } from 'vitest';
import { SimRuntime } from '../../src/workers/runtime';
import type { FromWorker } from '../../src/lib/sim/protocol';
import { gridCity } from '../../src/lib/city/builders';

describe('runtime worker', () => {
  it('mode headless mengirim progres lalu hasil akhir', async () => {
    const city = gridCity(4, 4, 120);
    city.nodes.forEach((n, i) => (n.zone = i % 2 ? 'home' : 'office'));
    const msgs: FromWorker[] = [];
    const done = new Promise<FromWorker>((resolve) => {
      const rt = new SimRuntime((m) => {
        msgs.push(m);
        if (m.type === 'headlessDone') resolve(m);
      });
      rt.handle({
        type: 'headless',
        duration: 600,
        config: { city, seed: 5, demand: { kind: 'zones', peakPerHour: 2000 } },
      });
    });
    const res = await done;
    expect(msgs.some((m) => m.type === 'progress')).toBe(true);
    if (res.type !== 'headlessDone') throw new Error();
    expect(res.samples.length).toBeGreaterThan(10);
    expect(res.densities.length).toBeGreaterThan(0);
  });

  it('init mengirim ready + frame typed array dengan stride 6', () => {
    const msgs: FromWorker[] = [];
    const rt = new SimRuntime((m) => msgs.push(m));
    const city = gridCity(3, 3, 100);
    rt.handle({ type: 'init', config: { city, seed: 1, demand: { kind: 'none' } }, speed: 1, paused: true });
    rt.handle({ type: 'dispose' });
    expect(msgs[0].type).toBe('ready');
    const frame = msgs.find((m) => m.type === 'frame');
    expect(frame && frame.type === 'frame' && frame.buf instanceof Float32Array).toBe(true);
  });
});
