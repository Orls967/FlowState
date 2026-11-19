import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { CityDoc } from '../lib/city/schema';
import { roadWidth, type Network } from '../lib/sim/network';
import type { Decor } from '../lib/city/decor';
import type { ScenePreset } from './themePresets';

/** Peta koordinat kota (x, y) → dunia three.js (x, 0, −y). */
export const wx = (x: number) => x;
export const wz = (y: number) => -y;

class GeoBuilder {
  pos: number[] = [];
  col: number[] = [];
  private c = new Color();

  tri(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    h: number,
    color: string | Color,
  ): void {
    const c = typeof color === 'string' ? this.c.set(color) : color;
    this.pos.push(ax, h, -ay, cx, h, -cy, bx, h, -by);
    for (let i = 0; i < 3; i++) this.col.push(c.r, c.g, c.b);
  }

  /** Persegi panjang sepanjang segmen a→b dengan lebar w. */
  quad(ax: number, ay: number, bx: number, by: number, w: number, h: number, color: string | Color): void {
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / L) * (w / 2);
    const ny = ((bx - ax) / L) * (w / 2);
    this.tri(ax + nx, ay + ny, ax - nx, ay - ny, bx - nx, by - ny, h, color);
    this.tri(ax + nx, ay + ny, bx - nx, by - ny, bx + nx, by + ny, h, color);
  }

  disc(cx: number, cy: number, r: number, h: number, color: string | Color, seg = 20): void {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      this.tri(
        cx,
        cy,
        cx + Math.cos(a1) * r,
        cy + Math.sin(a1) * r,
        cx + Math.cos(a0) * r,
        cy + Math.sin(a0) * r,
        h,
        color,
      );
    }
  }

  ring(cx: number, cy: number, r0: number, r1: number, h: number, color: string | Color, seg = 32): void {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a: number, r: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
      const [ax, ay] = p(a0, r0);
      const [bx, by] = p(a0, r1);
      const [qx, qy] = p(a1, r1);
      const [dx, dy] = p(a1, r0);
      this.tri(ax, ay, qx, qy, bx, by, h, color);
      this.tri(ax, ay, dx, dy, qx, qy, h, color);
    }
  }

  /** Persegi panjang terorientasi (pusat, sudut, lebar, kedalaman). */
  rect(cx: number, cy: number, ang: number, w: number, d: number, h: number, color: string | Color): void {
    const ux = Math.cos(ang) * (w / 2);
    const uy = Math.sin(ang) * (w / 2);
    this.quad(cx - ux, cy - uy, cx + ux, cy + uy, d, h, color);
  }

  dashed(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    w: number,
    h: number,
    color: string | Color,
    dash = 3,
    gap = 6,
  ): void {
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1) return;
    const dx = (bx - ax) / L;
    const dy = (by - ay) / L;
    for (let s = gap / 2; s < L - dash; s += dash + gap)
      this.quad(ax + dx * s, ay + dy * s, ax + dx * (s + dash), ay + dy * (s + dash), w, h, color);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    // semua permukaan datar menghadap ke atas (material DoubleSide, winding tidak penting)
    const normals = new Float32Array(this.pos.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    return g;
  }
}

/** Geometri jalan, simpang, marka, zebra cross, lajur bus, taman — satu BufferGeometry ber-vertex-color. */
export function buildRoadGeometry(
  doc: CityDoc,
  net: Network,
  decor: Decor | null,
  p: ScenePreset,
): BufferGeometry {
  const g = new GeoBuilder();
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
  // taman di bawah segalanya
  if (decor) {
    const pk = decor.parks;
    for (let i = 0; i < pk.length; i += 5)
      g.rect(pk[i], pk[i + 1], pk[i + 2], pk[i + 3], pk[i + 4], 0.02, p.park);
  }
  // tepi & badan jalan
  for (const r of doc.roads) {
    const a = nodeById.get(r.a);
    const b = nodeById.get(r.b);
    if (!a || !b) continue;
    const w = roadWidth(r.lanes, r.oneway);
    g.quad(a.x, a.y, b.x, b.y, w + 1.6, 0.04, p.roadEdge);
  }
  for (const n of net.nodes) {
    const hw = n.radius;
    if (n.neighbors >= 3 || n.control === 'roundabout') g.disc(n.x, n.y, hw + 0.8, 0.045, p.roadEdge, 24);
  }
  for (const r of doc.roads) {
    const a = nodeById.get(r.a);
    const b = nodeById.get(r.b);
    if (!a || !b) continue;
    g.quad(a.x, a.y, b.x, b.y, roadWidth(r.lanes, r.oneway), 0.08, p.road);
  }
  for (const n of net.nodes) {
    if (n.control === 'roundabout') {
      g.disc(n.x, n.y, n.radius, 0.1, p.intersection, 32);
      g.disc(n.x, n.y, Math.max(3, n.ringRadius - 4.5), 0.14, p.park, 28);
      g.ring(n.x, n.y, Math.max(3, n.ringRadius - 4.5), Math.max(3, n.ringRadius - 4.0), 0.15, p.marking, 32);
    } else if (n.neighbors >= 3) g.disc(n.x, n.y, n.radius, 0.1, p.intersection, 24);
    else if (n.neighbors === 2) g.disc(n.x, n.y, n.radius + 0.2, 0.09, p.road, 16);
  }
  // marka lajur
  for (const l of net.links) {
    const offs = l.laneOffsets;
    const W = 3.3;
    // pembatas antar lajur searah (putus-putus)
    for (let k = 0; k < offs.length - 1; k++) {
      const m = (offs[k] + offs[k + 1]) / 2;
      g.dashed(l.x0 + l.nx * m, l.y0 + l.ny * m, l.x1 + l.nx * m, l.y1 + l.ny * m, 0.15, 0.16, p.marking);
    }
    // garis tengah (sekali per jalan dua arah)
    if (!l.oneway && l.twin > l.index) g.quad(l.x0, l.y0, l.x1, l.y1, 0.3, 0.16, p.marking);
    // lajur bus
    if (l.busLane) {
      const o = offs[offs.length - 1];
      g.quad(l.x0 + l.nx * o, l.y0 + l.ny * o, l.x1 + l.nx * o, l.y1 + l.ny * o, W - 0.3, 0.13, p.bus);
    }
    // garis henti di simpang ber-kontrol
    const node = net.nodes[l.to];
    if (node.neighbors >= 3 || node.crosswalk) {
      const o0 = Math.min(...offs) - W / 2;
      const o1 = Math.max(...offs) + W / 2;
      const sx = l.x1 - l.dx * 0.5;
      const sy = l.y1 - l.dy * 0.5;
      g.quad(sx + l.nx * o0, sy + l.ny * o0, sx + l.nx * o1, sy + l.ny * o1, 0.45, 0.17, p.marking);
    }
    // zebra cross melintang di ujung link
    if (node.crosswalk) {
      const w = roadWidth(l.lanes, l.oneway);
      const cx = l.x1 + l.dx * 1.2;
      const cy = l.y1 + l.dy * 1.2;
      const half = l.oneway ? w / 2 : w / 2;
      for (let o = -half + 0.5; o < half; o += 1.1) {
        const px = cx + l.nx * o;
        const py = cy + l.ny * o;
        g.quad(px - l.dx * 1.4, py - l.dy * 1.4, px + l.dx * 1.4, py + l.dy * 1.4, 0.55, 0.18, p.crosswalk);
      }
    }
  }
  return g.build();
}

/** Garis sumbu tiap link (untuk heatmap & sorotan rute). */
export function linkLanePolyline(net: Network, li: number): [number, number][] {
  const l = net.links[li];
  const m = l.laneOffsets.reduce((a, b) => a + b, 0) / l.laneOffsets.length;
  return [
    [l.x0 + l.nx * m, l.y0 + l.ny * m],
    [l.x1 + l.nx * m, l.y1 + l.ny * m],
  ];
}
