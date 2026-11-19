import type { Zone } from '../city/schema';
import type { Network } from './network';
import type { Rng } from './rng';

/** Tujuan perjalanan: asal-zona → tujuan-zona dengan profil jam. */
export interface Purpose {
  key: string;
  from: Zone;
  to: Zone;
  /** porsi dari total permintaan jam puncak */
  share: number;
  /** puncak-puncak gaussian: [jam, sigma, bobot] */
  peaks: readonly (readonly [number, number, number])[];
  /** porsi kendaraan barang (truk) */
  freight?: number;
}

export const PURPOSES: readonly Purpose[] = [
  { key: 'commute-am', from: 'home', to: 'office', share: 0.34, peaks: [[7.4, 0.75, 1]] },
  { key: 'commute-pm', from: 'office', to: 'home', share: 0.34, peaks: [[17.4, 0.9, 1]] },
  { key: 'school-am', from: 'home', to: 'school', share: 0.16, peaks: [[6.6, 0.4, 1]] },
  { key: 'school-pm', from: 'school', to: 'home', share: 0.12, peaks: [[13.3, 0.7, 1]] },
  {
    key: 'shop',
    from: 'home',
    to: 'mall',
    share: 0.1,
    peaks: [
      [11, 2.2, 0.5],
      [19, 1.6, 1],
    ],
  },
  {
    key: 'shop-back',
    from: 'mall',
    to: 'home',
    share: 0.1,
    peaks: [
      [13, 2.2, 0.5],
      [21, 1.4, 1],
    ],
  },
  { key: 'errand', from: 'none', to: 'none', share: 0.14, peaks: [[12, 4, 1]], freight: 0.35 },
];

/** Intensitas relatif (0..1) suatu tujuan pada jam h (0..24, berulang). */
export function purposeIntensity(p: Purpose, hour: number): number {
  let v = 0;
  for (const [mu, sigma, w] of p.peaks) {
    for (const shift of [-24, 0, 24]) {
      const d = (hour - (mu + shift)) / sigma;
      v += w * Math.exp(-0.5 * d * d);
    }
  }
  return Math.min(1, v);
}

/** Profil total permintaan sepanjang hari (untuk grafik & test). */
export function totalIntensity(hour: number): number {
  return PURPOSES.reduce((s, p) => s + p.share * purposeIntensity(p, hour), 0);
}

export interface Trip {
  from: number;
  to: number;
  freight: boolean;
  purpose: number;
}

/** Pemilih asal/tujuan berbobot per zona (sudah dihitung sekali). */
export class ZonePicker {
  private byZone = new Map<Zone, { nodes: number[]; weights: number[]; total: number }>();
  private all: { nodes: number[]; weights: number[]; total: number };

  constructor(net: Network) {
    const allNodes: number[] = [];
    const allW: number[] = [];
    for (const n of net.nodes) {
      if (n.outLinks.length === 0 || n.inLinks.length === 0) continue;
      allNodes.push(n.index);
      allW.push(1);
      if (n.zone === 'none' || n.weight <= 0) continue;
      let e = this.byZone.get(n.zone);
      if (!e) {
        e = { nodes: [], weights: [], total: 0 };
        this.byZone.set(n.zone, e);
      }
      e.nodes.push(n.index);
      e.weights.push(n.weight);
      e.total += n.weight;
    }
    this.all = { nodes: allNodes, weights: allW, total: allNodes.length };
  }

  has(zone: Zone): boolean {
    return zone === 'none' ? this.all.nodes.length > 1 : (this.byZone.get(zone)?.nodes.length ?? 0) > 0;
  }

  pick(zone: Zone, rng: Rng): number {
    const e = zone === 'none' ? this.all : this.byZone.get(zone);
    if (!e || !e.nodes.length) return -1;
    return e.nodes[rng.weighted(e.weights, e.total)];
  }
}

/**
 * Bangkitkan perjalanan untuk satu langkah waktu.
 * @param peakPerHour total perjalanan/jam pada intensitas penuh
 */
export function generateTrips(
  picker: ZonePicker,
  rng: Rng,
  hour: number,
  dt: number,
  peakPerHour: number,
  out: Trip[],
): void {
  for (let pi = 0; pi < PURPOSES.length; pi++) {
    const p = PURPOSES[pi];
    if (!picker.has(p.from) || !picker.has(p.to)) continue;
    const lambda = (peakPerHour * p.share * purposeIntensity(p, hour) * dt) / 3600;
    const n = rng.poisson(lambda);
    for (let k = 0; k < n; k++) {
      const from = picker.pick(p.from, rng);
      const to = picker.pick(p.to, rng);
      if (from < 0 || to < 0 || from === to) continue;
      out.push({ from, to, freight: rng.chance(p.freight ?? 0), purpose: pi });
    }
  }
}

/** Aliran tetap (dipakai skenario Lab): kendaraan/jam dari node asal ke tujuan. */
export interface Flow {
  from: number;
  to: number;
  /** kendaraan per jam */
  rate: number;
  /** komposisi [mobil, motor, bus, truk]; default mobil saja */
  mix?: readonly number[];
  /** rute tetap berupa daftar id node (opsional) — bila tidak ada, pakai A* */
  via?: readonly number[];
}
