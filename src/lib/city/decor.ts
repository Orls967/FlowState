import { Rng } from '../sim/rng';
import { roadWidth } from '../sim/network';
import type { CityDoc, Zone } from './schema';

export const BuildingKind = { Home: 0, Apartment: 1, Office: 2, School: 3, Mall: 4 } as const;
export const BUILDING_STRIDE = 7;

export interface Decor {
  /** [x, y, sudut, lebar (sejajar jalan), kedalaman, tinggi, jenis] */
  buildings: Float32Array;
  /** [x, y, skala] */
  trees: Float32Array;
  /** [x, y, sudut, lebar, kedalaman] */
  parks: Float32Array;
  /** [x, y] */
  lights: Float32Array;
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  hw: number;
}

class Hash<T> {
  private m = new Map<number, T[]>();
  constructor(private cell: number) {}
  private key(i: number, j: number) {
    return (i + 4096) * 8192 + (j + 4096);
  }
  add(minX: number, minY: number, maxX: number, maxY: number, v: T): void {
    const c = this.cell;
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++)
      for (let j = Math.floor(minY / c); j <= Math.floor(maxY / c); j++) {
        const k = this.key(i, j);
        let a = this.m.get(k);
        if (!a) this.m.set(k, (a = []));
        a.push(v);
      }
  }
  query(x: number, y: number, r: number, out: Set<T>): void {
    const c = this.cell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((y - r) / c); j <= Math.floor((y + r) / c); j++) {
        const a = this.m.get(this.key(i, j));
        if (a) for (const v of a) out.add(v);
      }
  }
}

function segDist(s: Seg, x: number, y: number): number {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / L2));
  return Math.hypot(s.ax + dx * t - x, s.ay + dy * t - y) - s.hw;
}

/** Bangun dekorasi (gedung, taman, pohon, lampu jalan) di sepanjang jalan — berlaku untuk kota apa pun. */
export function buildDecor(doc: CityDoc, seed = doc.seed ?? 1): Decor {
  const rng = new Rng(seed ^ 0x5bd1e995);
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
  const segHash = new Hash<Seg>(48);
  const segs: Seg[] = [];
  for (const r of doc.roads) {
    const a = nodeById.get(r.a);
    const b = nodeById.get(r.b);
    if (!a || !b) continue;
    const s: Seg = { ax: a.x, ay: a.y, bx: b.x, by: b.y, hw: roadWidth(r.lanes, r.oneway) / 2 + 1.2 };
    segs.push(s);
    segHash.add(
      Math.min(a.x, b.x) - 30,
      Math.min(a.y, b.y) - 30,
      Math.max(a.x, b.x) + 30,
      Math.max(a.y, b.y) + 30,
      s,
    );
  }
  // MRT: jangan bangun di bawah jalur layang
  for (const line of doc.transit.mrt)
    for (let k = 1; k < line.stations.length; k++) {
      const a = line.stations[k - 1];
      const b = line.stations[k];
      const s: Seg = { ax: a.x, ay: a.y, bx: b.x, by: b.y, hw: 6 };
      segs.push(s);
      segHash.add(
        Math.min(a.x, b.x) - 30,
        Math.min(a.y, b.y) - 30,
        Math.max(a.x, b.x) + 30,
        Math.max(a.y, b.y) + 30,
        s,
      );
    }
  const nodeHash = new Hash<(typeof doc.nodes)[number]>(120);
  for (const n of doc.nodes) nodeHash.add(n.x, n.y, n.x, n.y, n);
  const tmpSeg = new Set<Seg>();
  const clearOfRoads = (x: number, y: number, margin: number) => {
    tmpSeg.clear();
    segHash.query(x, y, 40, tmpSeg);
    for (const s of tmpSeg) if (segDist(s, x, y) < margin) return false;
    return true;
  };
  const tmpNode = new Set<(typeof doc.nodes)[number]>();
  let maxR = 1;
  for (const n of doc.nodes) maxR = Math.max(maxR, Math.hypot(n.x, n.y));
  const zoneAt = (x: number, y: number): Zone => {
    tmpNode.clear();
    nodeHash.query(x, y, 200, tmpNode);
    let best: Zone = 'home';
    let bd = Infinity;
    for (const n of tmpNode) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) {
        bd = d;
        best = n.zone === 'none' ? 'home' : n.zone;
      }
    }
    return best;
  };

  const occ = new Hash<[number, number, number]>(30);
  const tmpOcc = new Set<[number, number, number]>();
  const free = (x: number, y: number, r: number) => {
    tmpOcc.clear();
    occ.query(x, y, r + 40, tmpOcc);
    for (const [ox, oy, or] of tmpOcc) if (Math.hypot(ox - x, oy - y) < r + or) return false;
    return true;
  };
  const claim = (x: number, y: number, r: number) => occ.add(x - r, y - r, x + r, y + r, [x, y, r]);

  const buildings: number[] = [];
  const trees: number[] = [];
  const parks: number[] = [];
  const lights: number[] = [];

  const roads = [...doc.roads].sort((a, b) => a.id - b.id);
  for (const r of roads) {
    const a = nodeById.get(r.a);
    const b = nodeById.get(r.b);
    if (!a || !b) continue;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 30) continue;
    const dx = (b.x - a.x) / L;
    const dy = (b.y - a.y) / L;
    const nx = -dy;
    const ny = dx;
    const hw = roadWidth(r.lanes, r.oneway) / 2;
    const ang = Math.atan2(dy, dx);
    for (const side of [-1, 1]) {
      let pos = 12 + rng.range(0, 6);
      let parkLeft = 0;
      while (pos < L - 12) {
        const px = a.x + dx * pos;
        const py = a.y + dy * pos;
        const d = Math.hypot(px, py) / maxR;
        const zone = zoneAt(px, py);
        if (parkLeft <= 0 && rng.chance(0.045)) parkLeft = rng.range(40, 90);
        let w: number;
        let dep: number;
        let h: number;
        let kind: number;
        if (parkLeft > 0) {
          w = Math.min(parkLeft, L - 12 - pos);
          dep = rng.range(26, 40);
          const set = hw + 2;
          const cxp = px + dx * (w / 2) + nx * side * (set + dep / 2);
          const cyp = py + dy * (w / 2) + ny * side * (set + dep / 2);
          const rad = Math.max(w, dep) * 0.5;
          if (w > 15 && clearOfRoads(cxp, cyp, dep / 2) && free(cxp, cyp, rad * 0.8)) {
            claim(cxp, cyp, rad * 0.8);
            parks.push(cxp, cyp, ang, w, dep);
            const nt = Math.floor((w * dep) / 140);
            for (let k = 0; k < nt; k++)
              trees.push(
                cxp + (rng.next() - 0.5) * w * 0.85 * dx + (rng.next() - 0.5) * dep * 0.85 * nx,
                cyp + (rng.next() - 0.5) * w * 0.85 * dy + (rng.next() - 0.5) * dep * 0.85 * ny,
                rng.range(0.8, 1.4),
              );
          }
          pos += w + 4;
          parkLeft = 0;
          continue;
        }
        switch (zone) {
          case 'office':
            kind = BuildingKind.Office;
            w = rng.range(18, 30);
            dep = rng.range(16, 28);
            h = 22 + Math.pow(Math.max(0, 1 - d), 2) * rng.range(30, 120);
            break;
          case 'mall':
            kind = rng.chance(0.5) ? BuildingKind.Mall : BuildingKind.Office;
            w = kind === BuildingKind.Mall ? rng.range(40, 60) : rng.range(18, 26);
            dep = kind === BuildingKind.Mall ? rng.range(30, 42) : rng.range(16, 24);
            h = kind === BuildingKind.Mall ? rng.range(12, 20) : rng.range(20, 45);
            break;
          case 'school':
            kind = rng.chance(0.6) ? BuildingKind.School : BuildingKind.Home;
            w = kind === BuildingKind.School ? rng.range(28, 38) : rng.range(8, 12);
            dep = kind === BuildingKind.School ? rng.range(18, 26) : rng.range(9, 13);
            h = kind === BuildingKind.School ? rng.range(8, 13) : rng.range(4, 8);
            break;
          default:
            if (rng.chance(d < 0.5 ? 0.25 : 0.08)) {
              kind = BuildingKind.Apartment;
              w = rng.range(16, 22);
              dep = rng.range(14, 20);
              h = rng.range(18, 45);
            } else {
              kind = BuildingKind.Home;
              w = rng.range(8, 12);
              dep = rng.range(9, 13);
              h = rng.range(4, 9);
            }
        }
        if (pos + w > L - 12) break;
        const setback = hw + 2.5 + rng.range(0, 2.5);
        const cxb = px + dx * (w / 2) + nx * side * (setback + dep / 2);
        const cyb = py + dy * (w / 2) + ny * side * (setback + dep / 2);
        const rad = Math.hypot(w, dep) / 2;
        const ok =
          clearOfRoads(cxb, cyb, Math.min(w, dep) / 2 + 1) &&
          clearOfRoads(cxb + nx * side * (dep / 2), cyb + ny * side * (dep / 2), 1) &&
          clearOfRoads(cxb + dx * (w / 2), cyb + dy * (w / 2), 1) &&
          clearOfRoads(cxb - dx * (w / 2), cyb - dy * (w / 2), 1) &&
          free(cxb, cyb, rad * 0.72);
        if (ok) {
          claim(cxb, cyb, rad * 0.72);
          buildings.push(cxb, cyb, ang, w, dep, h, kind);
        } else if (rng.chance(0.5)) {
          trees.push(px + nx * side * (hw + 4), py + ny * side * (hw + 4), rng.range(0.7, 1.1));
        }
        pos += w + rng.range(2, 6);
      }
      // pohon & lampu jalan di sepanjang arteri
      if (r.lanes >= 2) {
        for (let p = 16; p < L - 16; p += 36) {
          const tx = a.x + dx * p + nx * side * (hw + 1.6);
          const ty = a.y + dy * p + ny * side * (hw + 1.6);
          if (side > 0) lights.push(tx, ty);
          if (rng.chance(0.6)) trees.push(tx + dx * 9, ty + dy * 9, rng.range(0.7, 1.0));
        }
      }
    }
  }
  return {
    buildings: new Float32Array(buildings),
    trees: new Float32Array(trees),
    parks: new Float32Array(parks),
    lights: new Float32Array(lights),
  };
}
