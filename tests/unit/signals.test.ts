import { describe, expect, it } from 'vitest';
import {
  phaseAt,
  cycleLength,
  stateForPhase,
  SignalState,
  greenWaveOffsets,
} from '../../src/lib/sim/signals';
import { compileNetwork } from '../../src/lib/sim/network';
import { CityBuilder } from '../../src/lib/city/builders';

describe('lampu lalu lintas', () => {
  const plan = { greens: [30, 20], offset: 0, yellow: 3, allRed: 2 };
  it('panjang siklus', () => {
    expect(cycleLength(plan)).toBe(60);
  });
  it('urutan hijau → kuning → semua merah per fase', () => {
    expect(phaseAt(plan, 0)).toMatchObject({ phase: 0, state: SignalState.Green });
    expect(phaseAt(plan, 31)).toMatchObject({ phase: 0, state: SignalState.Yellow });
    expect(phaseAt(plan, 34)).toMatchObject({ phase: 0, state: SignalState.Red });
    expect(phaseAt(plan, 36)).toMatchObject({ phase: 1, state: SignalState.Green });
    expect(phaseAt(plan, 56)).toMatchObject({ phase: 1, state: SignalState.Yellow });
    expect(phaseAt(plan, 61)).toMatchObject({ phase: 0, state: SignalState.Green });
  });
  it('hanya satu fase hijau dalam satu waktu', () => {
    for (let t = 0; t < 120; t += 0.5) {
      const info = phaseAt(plan, t);
      const greens = [0, 1].filter((p) => stateForPhase(info, p) === SignalState.Green);
      expect(greens.length).toBeLessThanOrEqual(1);
    }
  });
  it('offset menggeser siklus', () => {
    const shifted = { ...plan, offset: 10 };
    expect(phaseAt(shifted, 0).remaining).toBeCloseTo(20, 6);
  });
  it('offset gelombang hijau: simpang hilir mulai hijau d/v detik kemudian', () => {
    const offs = greenWaveOffsets([0, 200, 400], 12.5, 60);
    for (let i = 0; i < 3; i++) {
      const start = (i * 200) / 12.5;
      expect(phaseAt({ ...plan, offset: offs[i] }, start + 0.01).state).toBe(SignalState.Green);
      expect(phaseAt({ ...plan, offset: offs[i] }, start - 0.5).state).not.toBe(SignalState.Green);
    }
  });
  it('fase otomatis mengelompokkan pendekat berhadapan (simpang 4 kaki = 2 fase)', () => {
    const b = new CityBuilder();
    const c = b.node(0, 0, { control: 'signal' });
    const n = b.node(0, 100);
    const s = b.node(0, -100);
    const e = b.node(100, 0);
    const w = b.node(-100, 0);
    for (const x of [n, s, e, w]) b.road(c, x);
    const net = compileNetwork(b.build());
    const node = net.nodes[net.nodeIndexById.get(c)!];
    expect(node.phases.length).toBe(2);
    for (const ph of node.phases) {
      expect(ph.length).toBe(2);
      const [l1, l2] = ph.map((li) => net.links[li]);
      expect(l1.dx * l2.dx + l1.dy * l2.dy).toBeCloseTo(-1, 3);
    }
  });
});
