/**
 * Intelligent Driver Model (Treiber, Hennecke & Helbing, 2000).
 *   a_IDM = a [ 1 − (v/v0)^δ − (s_star / s)² ],   s_star = s0 + max(0, vT + vΔv / (2√(ab)))
 */
export interface IdmParams {
  v0: number;
  a: number;
  b: number;
  T: number;
  s0: number;
  delta?: number;
}

/** Batas perlambatan fisik (m/s²) — mencegah nilai tak realistis saat situasi darurat. */
export const MAX_DECEL = 9;

export function desiredGap(p: IdmParams, v: number, dv: number): number {
  return p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)));
}

/** Percepatan jalan bebas (tanpa pemimpin). */
export function idmFree(p: IdmParams, v: number): number {
  const delta = p.delta ?? 4;
  const v0 = Math.max(0.1, p.v0);
  return p.a * (1 - Math.pow(v / v0, delta));
}

/**
 * Percepatan IDM.
 * @param gap jarak bersih ke bemper belakang pemimpin (m); Infinity bila tidak ada pemimpin
 * @param vLead kecepatan pemimpin (m/s)
 */
export function idmAccel(p: IdmParams, v: number, gap: number, vLead: number): number {
  const free = idmFree(p, v);
  if (!Number.isFinite(gap)) return Math.max(-MAX_DECEL, free);
  const s = Math.max(gap, 0.01);
  const sStar = desiredGap(p, v, v - vLead);
  const acc = free - p.a * (sStar / s) * (sStar / s);
  return Math.max(-MAX_DECEL, acc);
}

/** Kecepatan setimbang IDM untuk jarak s (dipakai untuk diagram fundamental teoretis & test). */
export function equilibriumSpeed(p: IdmParams, gap: number): number {
  let lo = 0;
  let hi = p.v0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (idmAccel(p, mid, gap, mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Pembaruan balistik satu langkah (Treiber & Kanagaraj 2015) — kecepatan tidak pernah negatif.
 * @returns [jarak tempuh, kecepatan baru]
 */
export function ballisticStep(v: number, acc: number, dt: number): [number, number] {
  const vNew = v + acc * dt;
  if (vNew < 0) {
    // berhenti di tengah langkah
    const ds = acc < 0 ? (-0.5 * v * v) / acc : 0;
    return [Math.max(0, ds), 0];
  }
  return [Math.max(0, v * dt + 0.5 * acc * dt * dt), vNew];
}
