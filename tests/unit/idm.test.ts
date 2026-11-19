import { describe, expect, it } from 'vitest';
import {
  idmAccel,
  idmFree,
  equilibriumSpeed,
  ballisticStep,
  desiredGap,
  MAX_DECEL,
} from '../../src/lib/sim/idm';
import { mobilDecision } from '../../src/lib/sim/mobil';

const P = { v0: 30, a: 1, b: 1.5, T: 1.5, s0: 2 };

describe('IDM', () => {
  it('berakselerasi penuh dari diam di jalan bebas', () => {
    expect(idmFree(P, 0)).toBeCloseTo(P.a, 6);
    expect(idmAccel(P, 0, Infinity, 0)).toBeCloseTo(P.a, 6);
  });
  it('percepatan nol pada kecepatan diinginkan', () => {
    expect(idmFree(P, P.v0)).toBeCloseTo(0, 6);
  });
  it('mengerem saat mendekati kendaraan berhenti', () => {
    expect(idmAccel(P, 15, 20, 0)).toBeLessThan(-P.b);
  });
  it('perlambatan dibatasi secara fisik', () => {
    expect(idmAccel(P, 30, 0.1, 0)).toBeGreaterThanOrEqual(-MAX_DECEL);
  });
  it('jarak diinginkan = s0 + vT saat Δv = 0', () => {
    expect(desiredGap(P, 10, 0)).toBeCloseTo(2 + 15, 6);
  });
  it('kecepatan setimbang naik monoton terhadap jarak', () => {
    const a = equilibriumSpeed(P, 10);
    const b = equilibriumSpeed(P, 30);
    const c = equilibriumSpeed(P, 100);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(P.v0);
    expect(idmAccel(P, b, 30, b)).toBeCloseTo(0, 3);
  });
  it('pembaruan balistik tidak membuat kecepatan negatif', () => {
    const [ds, v] = ballisticStep(1, -9, 0.5);
    expect(v).toBe(0);
    expect(ds).toBeCloseTo(1 / 18, 6);
  });
  it('pengikut tidak menabrak pemimpin yang berhenti mendadak', () => {
    let s = 0;
    let v = 15;
    const lead = 60;
    for (let i = 0; i < 400; i++) {
      const acc = idmAccel(P, v, lead - 4.5 - s, 0);
      const [ds, nv] = ballisticStep(v, acc, 0.2);
      s += ds;
      v = nv;
    }
    expect(lead - 4.5 - s).toBeGreaterThan(0.5);
    expect(v).toBeLessThan(0.05);
  });
});

describe('MOBIL', () => {
  const base = {
    accSelf: -1,
    accSelfNew: 0.5,
    accNewFollower: 0,
    accNewFollowerAfter: -0.5,
    accOldFollower: -0.5,
    accOldFollowerAfter: 0.2,
    politeness: 0.3,
    threshold: 0.1,
    bias: 0,
    bSafe: 4,
  };
  it('pindah bila menguntungkan & aman', () => {
    expect(mobilDecision(base).change).toBe(true);
  });
  it('tidak pindah bila pengikut baru harus mengerem berbahaya', () => {
    const r = mobilDecision({ ...base, accNewFollowerAfter: -6 });
    expect(r.safe).toBe(false);
    expect(r.change).toBe(false);
  });
  it('kesopanan tinggi menahan pindah yang merugikan orang lain', () => {
    const selfish = mobilDecision({ ...base, accSelfNew: -0.7, accNewFollowerAfter: -2, politeness: 0 });
    const polite = mobilDecision({ ...base, accSelfNew: -0.7, accNewFollowerAfter: -2, politeness: 1 });
    expect(selfish.change).toBe(true);
    expect(polite.change).toBe(false);
  });
});
