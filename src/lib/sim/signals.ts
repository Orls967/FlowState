import { ALL_RED_TIME, YELLOW_TIME } from './network';

export const SignalState = { Red: 0, Yellow: 1, Green: 2 } as const;
export type SignalState = (typeof SignalState)[keyof typeof SignalState];

export interface SignalPlan {
  greens: readonly number[];
  offset: number;
  yellow?: number;
  allRed?: number;
}

export function cycleLength(p: SignalPlan): number {
  const y = p.yellow ?? YELLOW_TIME;
  const r = p.allRed ?? ALL_RED_TIME;
  return p.greens.reduce((s, g) => s + g + y + r, 0);
}

export interface PhaseInfo {
  /** fase yang sedang aktif */
  phase: number;
  state: SignalState;
  /** sisa detik pada keadaan sekarang */
  remaining: number;
}

/** Fase aktif pada waktu t (detik). Satu fase = hijau → kuning → semua merah. */
export function phaseAt(p: SignalPlan, t: number): PhaseInfo {
  const y = p.yellow ?? YELLOW_TIME;
  const r = p.allRed ?? ALL_RED_TIME;
  const cycle = cycleLength(p);
  if (cycle <= 0) return { phase: 0, state: SignalState.Green, remaining: Infinity };
  let tc = (((t + p.offset) % cycle) + cycle) % cycle;
  for (let k = 0; k < p.greens.length; k++) {
    const g = p.greens[k];
    if (tc < g) return { phase: k, state: SignalState.Green, remaining: g - tc };
    tc -= g;
    if (tc < y) return { phase: k, state: SignalState.Yellow, remaining: y - tc };
    tc -= y;
    if (tc < r) return { phase: k, state: SignalState.Red, remaining: r - tc };
    tc -= r;
  }
  return { phase: 0, state: SignalState.Green, remaining: 0 };
}

/** Keadaan lampu untuk pendekat yang termasuk fase `linkPhase`. */
export function stateForPhase(info: PhaseInfo, linkPhase: number): SignalState {
  if (linkPhase < 0) return SignalState.Green;
  if (info.phase !== linkPhase) return SignalState.Red;
  return info.state;
}

/** Offset gelombang hijau: tiap simpang hilir menunda mulai hijau sebesar jarak / kecepatan. */
export function greenWaveOffsets(distances: readonly number[], speed: number, cycle: number): number[] {
  // offset dipakai sebagai t + offset, jadi simpang yang hijaunya harus mulai lebih lambat diberi offset negatif (mod siklus)
  return distances.map((d) => (((-d / speed) % cycle) + cycle) % cycle);
}
