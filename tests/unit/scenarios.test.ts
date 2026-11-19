import { describe, expect, it } from 'vitest';
import { Simulation, type LiveStats } from '../../src/lib/sim/engine';
import { SCENARIO_BY_ID, SCENARIOS } from '../../src/content/scenarios';
import { PHENOMENA } from '../../src/content/phenomena';

/** Rata-rata metrik setelah masa pemanasan. */
function run(id: string, variant: string, duration: number): Record<keyof LiveStats, number> {
  const sc = SCENARIO_BY_ID.get(id)!;
  const sim = new Simulation(sc.build(variant, sc.slider?.value ?? 0));
  const acc: Record<string, number> = {};
  let n = 0;
  const steps = Math.round((sc.warmup + duration) / sim.dt);
  for (let i = 0; i < steps; i++) {
    sim.step();
    if (sim.t > sc.warmup && i % 25 === 0) {
      const s = sim.liveStats();
      for (const [k, v] of Object.entries(s)) if (typeof v === 'number') acc[k] = (acc[k] ?? 0) + v;
      n++;
    }
  }
  const last = sim.liveStats();
  const out: Record<string, number> = {};
  for (const k of Object.keys(acc)) out[k] = acc[k] / n;
  out.stopsPerVehicle = last.stopsPerVehicle;
  return out as Record<keyof LiveStats, number>;
}

describe('skenario Lab memperlihatkan fenomenanya', () => {
  it('setiap skenario punya konten dwibahasa yang cocok', () => {
    for (const sc of SCENARIOS) {
      const ph = PHENOMENA.find((p) => p.id === sc.id);
      expect(ph, sc.id).toBeDefined();
      expect(ph!.variants.map((v) => v.key).sort()).toEqual([...sc.variants].sort());
    }
  });
  it('Sugiyama: pengemudi "manusia" memunculkan gelombang, pengemudi halus tidak', () => {
    const human = run('sugiyama', 'human', 600);
    const smooth = run('sugiyama', 'smooth', 600);
    expect(human.speedStd).toBeGreaterThan(1.5);
    expect(smooth.speedStd).toBeLessThan(human.speedStd / 3);
  });
  it('Braess: jalan pintas memperlambat waktu tempuh rata-rata', () => {
    const without = run('braess', 'without', 900);
    const withS = run('braess', 'with', 900);
    expect(withS.meanTravelTime).toBeGreaterThan(without.meanTravelTime * 1.03);
  });
  it('zipper: antrean lebih pendek daripada merge awal', () => {
    const early = run('zipper', 'early', 900);
    const zip = run('zipper', 'zipper', 900);
    expect(zip.queueLength).toBeLessThan(early.queueLength);
  });
  it('gelombang hijau: lebih sedikit berhenti & tundaan', () => {
    const unc = run('green-wave', 'uncoordinated', 900);
    const coo = run('green-wave', 'coordinated', 900);
    expect(coo.stopsPerVehicle).toBeLessThan(unc.stopsPerVehicle);
    expect(coo.meanDelay).toBeLessThan(unc.meanDelay);
  });
  it('bundaran: tundaan lebih kecil pada arus sedang', () => {
    const sig = run('roundabout', 'signal', 900);
    const rb = run('roundabout', 'roundabout', 900);
    expect(rb.meanDelay).toBeLessThan(sig.meanDelay);
  });
});
