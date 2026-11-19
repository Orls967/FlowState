import { describe, expect, it } from 'vitest';
import { generateCity } from '../../src/lib/city/generator';
import { presetBrt, presetMrt, applyDedicatedLanes } from '../../src/lib/city/transit';
import { CityDocSchema } from '../../src/lib/city/schema';
import { Simulation } from '../../src/lib/sim/engine';

describe('angkutan umum', () => {
  const base = generateCity(4, 'small');
  const brt = presetBrt(base)!;
  const withBrt = { ...base, transit: { bus: [brt], mrt: [] } };
  const mrt = presetMrt(withBrt)!;
  const city = applyDedicatedLanes({ ...base, transit: { bus: [brt], mrt: [mrt] } });

  it('contoh jalur valid & lajur BRT ditandai', () => {
    expect(brt.stops.length).toBeGreaterThanOrEqual(2);
    expect(mrt.stations.length).toBeGreaterThanOrEqual(2);
    expect(CityDocSchema.safeParse(city).success).toBe(true);
    expect(city.roads.some((r) => r.busLane)).toBe(true);
  });

  it('sebagian perjalanan beralih ke bus/MRT dan kendaraan pribadi berkurang', () => {
    const run = (doc: typeof city) => {
      const sim = new Simulation({
        city: doc,
        seed: 9,
        startHour: 7,
        demand: { kind: 'zones', peakPerHour: 6000 },
      });
      for (let i = 0; i < 6000; i++) sim.step();
      return sim.liveStats();
    };
    const without = run(base);
    const withT = run(city);
    expect(without.modeCounts[2] + without.modeCounts[3]).toBe(0);
    expect(withT.modeCounts[2] + withT.modeCounts[3]).toBeGreaterThan(0);
    expect(withT.modeCounts[0] + withT.modeCounts[1]).toBeLessThan(
      without.modeCounts[0] + without.modeCounts[1],
    );
    // bus benar-benar beroperasi di jaringan
    expect(withT.lineRiders.length).toBe(2);
  });
});
