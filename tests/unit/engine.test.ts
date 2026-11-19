import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/lib/sim/engine';
import { CityBuilder, gridCity, ringCity } from '../../src/lib/city/builders';
import { Rng } from '../../src/lib/sim/rng';

function zonedGrid() {
  const city = gridCity(5, 5, 120, { lanes: 2 });
  city.nodes.forEach((n, i) => {
    n.zone = i % 3 === 0 ? 'home' : i % 3 === 1 ? 'office' : 'mall';
  });
  city.nodes[12].control = 'signal';
  city.nodes[6].control = 'roundabout';
  city.nodes[8].crosswalk = true;
  return city;
}

describe('RNG', () => {
  it('seed sama → urutan sama; seed beda → beda', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const sa = Array.from({ length: 10 }, () => a.next());
    expect(Array.from({ length: 10 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 10 }, () => c.next())).not.toEqual(sa);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('Simulasi', () => {
  it('deterministik: seed sama menghasilkan keadaan identik', () => {
    const run = (seed: number) => {
      const sim = new Simulation({
        city: zonedGrid(),
        seed,
        demand: { kind: 'zones', peakPerHour: 3000 },
        startHour: 7,
      });
      for (let i = 0; i < 1500; i++) sim.step();
      return { hash: sim.stateHash(), done: sim.tripsDone, active: sim.active };
    };
    const a = run(7);
    const b = run(7);
    const c = run(8);
    expect(a).toEqual(b);
    expect(a.active).toBeGreaterThan(5);
    expect(c.hash).not.toBe(a.hash);
  });

  it('kendaraan menyelesaikan perjalanan dan tidak saling tumpang tindih di lajur', () => {
    const sim = new Simulation({
      city: zonedGrid(),
      seed: 3,
      demand: { kind: 'zones', peakPerHour: 3000 },
      startHour: 7,
    });
    for (let i = 0; i < 3000; i++) {
      sim.step();
      if (i % 100 === 0) {
        for (const link of sim.laneVeh)
          for (const lane of link)
            for (let k = 1; k < lane.length; k++) {
              const lead = sim.vehicles[lane[k - 1]]!;
              const fol = sim.vehicles[lane[k]]!;
              expect(lead.s).toBeGreaterThanOrEqual(fol.s);
            }
      }
    }
    expect(sim.tripsDone).toBeGreaterThan(20);
    const st = sim.liveStats();
    expect(st.meanTravelTime).toBeGreaterThan(0);
    for (const u of sim.vehicles) if (u) expect(Number.isFinite(u.x + u.y + u.s + u.v)).toBe(true);
  });

  it('kendaraan berhenti saat lampu merah', () => {
    const b = new CityBuilder();
    const w = b.node(-300, 0);
    const c = b.node(0, 0, { control: 'signal', greens: [20, 40] });
    const e = b.node(300, 0);
    const n = b.node(0, 300);
    const s = b.node(0, -300);
    b.road(w, c);
    b.road(c, e);
    b.road(n, c);
    b.road(c, s);
    const sim = new Simulation({
      city: b.build(),
      seed: 1,
      demand: { kind: 'flows', flows: [{ from: w, to: e, rate: 900 }] },
      rerouting: false,
    });
    const cNode = sim.net.nodes[sim.net.nodeIndexById.get(c)!];
    const inW = sim.net.links.find((l) => l.from === sim.net.nodeIndexById.get(w))!;
    let violations = 0;
    let stoppedAtRed = 0;
    for (let i = 0; i < 3000; i++) {
      const before = sim.exitCount[inW.index];
      sim.step();
      const st = sim.signalStates()[inW.index];
      if (sim.exitCount[inW.index] > before && st === 0) {
        // lewat saat merah hanya boleh bila sudah berkomitmen di akhir kuning (≤ 2 dtk semua-merah)
        const info = cNode.cycle;
        if (info > 0) violations++;
      }
      if (st === 0)
        for (const lane of sim.laneVeh[inW.index])
          if (lane.length && sim.vehicles[lane[0]]!.v < 0.1) stoppedAtRed++;
    }
    expect(stoppedAtRed).toBeGreaterThan(0);
    expect(violations).toBeLessThan(15);
    expect(sim.tripsDone).toBeGreaterThan(10);
  });

  it('gelombang macet muncul di jalan melingkar padat (Sugiyama)', () => {
    const { city, nodeIds } = ringCity(230);
    const sim = new Simulation({
      city,
      seed: 11,
      demand: { kind: 'none' },
      ring: { nodeIds, count: 22 },
      noise: 0.3,
      idm: { v0: 12, a: 0.6, b: 1.5, T: 1.5, s0: 2 },
      transit: false,
    });
    let minSpeed = Infinity;
    let maxSpeed = 0;
    for (let i = 0; i < 6000; i++) {
      sim.step();
      if (i > 4000)
        for (const u of sim.vehicles) {
          if (!u) continue;
          minSpeed = Math.min(minSpeed, u.v);
          maxSpeed = Math.max(maxSpeed, u.v);
        }
    }
    expect(sim.active).toBe(22);
    expect(maxSpeed - minSpeed).toBeGreaterThan(2.5);
  });
});
