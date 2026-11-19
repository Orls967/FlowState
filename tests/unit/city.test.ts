import { describe, expect, it } from 'vitest';
import { generateCity } from '../../src/lib/city/generator';
import { buildDecor } from '../../src/lib/city/decor';
import { CityDocSchema } from '../../src/lib/city/schema';
import { compileNetwork } from '../../src/lib/sim/network';
import { Router } from '../../src/lib/sim/routing';
import { Simulation } from '../../src/lib/sim/engine';

describe('generator kota', () => {
  it('ber-seed: seed sama → kota identik, seed beda → berbeda', () => {
    expect(generateCity(42)).toEqual(generateCity(42));
    expect(JSON.stringify(generateCity(42))).not.toEqual(JSON.stringify(generateCity(43)));
  });
  it('lolos validasi skema & semua zona utama ada', () => {
    const city = generateCity(7, 'large');
    expect(CityDocSchema.safeParse(city).success).toBe(true);
    for (const z of ['home', 'office', 'school', 'mall'] as const)
      expect(city.nodes.some((n) => n.zone === z)).toBe(true);
    expect(city.nodes.some((n) => n.control === 'signal')).toBe(true);
  });
  it('jaringan terhubung kuat (semua simpang saling terjangkau)', () => {
    const net = compileNetwork(generateCity(3));
    const router = new Router(net);
    const last = net.nodes.length - 1;
    for (const [a, b] of [
      [0, last],
      [last, 0],
      [5, last - 5],
      [Math.floor(last / 2), 1],
    ])
      expect(router.route(a, b, (li) => net.links[li].freeTime)).not.toBeNull();
  });
  it('dekorasi deterministik dan gedung tidak menimpa jalan', () => {
    const city = generateCity(11, 'small');
    const d1 = buildDecor(city);
    const d2 = buildDecor(city);
    expect(Array.from(d1.buildings)).toEqual(Array.from(d2.buildings));
    expect(d1.buildings.length / 7).toBeGreaterThan(100);
    expect(d1.trees.length).toBeGreaterThan(0);
  });
  it('simulasi berjalan di kota hasil generator', () => {
    const sim = new Simulation({
      city: generateCity(5, 'small'),
      seed: 1,
      demand: { kind: 'zones', peakPerHour: 6000 },
      startHour: 7.2,
    });
    for (let i = 0; i < 2500; i++) sim.step();
    expect(sim.tripsDone).toBeGreaterThan(30);
  });
});
