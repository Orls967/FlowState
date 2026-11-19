import type { CityDoc, Zone } from '../city/schema';

/** Lebar lajur (m). */
export const LANE_WIDTH = 3.3;
/** Lalu lintas lajur kiri (Indonesia): kendaraan berada di sisi kiri arah perjalanan. */
export const DRIVE_LEFT = true;
export const YELLOW_TIME = 3;
export const ALL_RED_TIME = 2;
export const PED_PHASE_TIME = 12;

export type NodeControl = 'none' | 'priority' | 'signal' | 'roundabout' | 'allway';
export type Turn = 'straight' | 'left' | 'right' | 'uturn';

export interface Movement {
  inLink: number;
  outLink: number;
  turn: Turn;
  /** sudut titik masuk & keluar di sekeliling pusat simpang (radian) */
  a0: number;
  a1: number;
  /** perkiraan panjang lintasan di dalam simpang (m) */
  length: number;
}

export interface NetNode {
  index: number;
  id: number;
  x: number;
  y: number;
  control: NodeControl;
  crosswalk: boolean;
  zone: Zone;
  weight: number;
  radius: number;
  /** radius lingkar bundaran (m) */
  ringRadius: number;
  inLinks: number[];
  outLinks: number[];
  neighbors: number;
  movements: Movement[];
  /** movIndex[inLocal * outLinks.length + outLocal] → indeks movement atau −1 */
  movIndex: Int16Array;
  /** conflicts[i * M + j] = 1 bila movement i dan j berpotongan/bergabung */
  conflicts: Uint8Array;
  /** sinyal: daftar link masuk per fase (fase kosong = fase pejalan kaki) */
  phases: number[][];
  greens: number[];
  offset: number;
  cycle: number;
}

export interface NetLink {
  index: number;
  roadId: number;
  from: number;
  to: number;
  lanes: number;
  /** batas kecepatan (m/s) */
  speed: number;
  length: number;
  busLane: boolean;
  oneway: boolean;
  /** titik awal sumbu jalan (sudah dipangkas radius simpang) */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** vektor arah satuan */
  dx: number;
  dy: number;
  /** normal kiri satuan */
  nx: number;
  ny: number;
  /** offset lateral tiap lajur terhadap sumbu jalan (positif = kiri arah perjalanan) */
  laneOffsets: number[];
  freeTime: number;
  /** pendekat utama pada simpang prioritas */
  major: boolean;
  /** indeks fase sinyal di simpang tujuan (−1 bila tidak bersinyal) */
  phase: number;
  /** link arah berlawanan (−1 bila satu arah) */
  twin: number;
  /** indeks lokal di node.inLinks simpang tujuan */
  inLocal: number;
  /** indeks lokal di node.outLinks simpang asal */
  outLocal: number;
}

export interface Network {
  nodes: NetNode[];
  links: NetLink[];
  nodeIndexById: Map<number, number>;
  maxSpeed: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const TAU = Math.PI * 2;
export const normAngle = (a: number) => ((a % TAU) + TAU) % TAU;

/** Lebar total badan jalan (m). */
export function roadWidth(lanes: number, oneway: boolean): number {
  return (oneway ? lanes : lanes * 2) * LANE_WIDTH + (oneway ? 0 : 0.6);
}

export function laneOffsetsFor(lanes: number, oneway: boolean): number[] {
  const side = DRIVE_LEFT ? 1 : -1;
  const out: number[] = [];
  for (let k = 0; k < lanes; k++) {
    // k = 0 lajur dalam (cepat), k = lanes−1 lajur tepi (lambat / bus)
    const off = oneway ? (k + 0.5 - lanes / 2) * LANE_WIDTH : (k + 0.5) * LANE_WIDTH + 0.3;
    out.push(off * side);
  }
  return out;
}

export function turnOf(inL: NetLink, outL: NetLink): Turn {
  const cross = inL.dx * outL.dy - inL.dy * outL.dx;
  const dot = inL.dx * outL.dx + inL.dy * outL.dy;
  const th = Math.atan2(cross, dot);
  if (Math.abs(th) > (5 * Math.PI) / 6) return 'uturn';
  if (Math.abs(th) < Math.PI / 6) return 'straight';
  return th > 0 ? 'left' : 'right';
}

/** Apakah titik sudut x berada di busur ccw terbuka (a, b). */
function inArc(a: number, b: number, x: number): boolean {
  const span = normAngle(b - a);
  const off = normAngle(x - a);
  return off > 1e-6 && off < span - 1e-6;
}

/** Dua movement berkonflik bila keluar ke link sama (bergabung) atau tali busurnya berpotongan. */
export function movementsConflict(m1: Movement, m2: Movement): boolean {
  if (m1.inLink === m2.inLink) return false;
  if (m1.outLink === m2.outLink) return true;
  const c = inArc(m1.a0, m1.a1, m2.a0);
  const d = inArc(m1.a0, m1.a1, m2.a1);
  return c !== d;
}

function laneMid(l: NetLink): number {
  return l.laneOffsets.reduce((a, b) => a + b, 0) / l.laneOffsets.length;
}

/** Kompilasi dokumen kota menjadi graf berarah siap simulasi. */
export function compileNetwork(doc: CityDoc): Network {
  const nodeIndexById = new Map<number, number>();
  const nodes: NetNode[] = doc.nodes.map((n, i) => {
    nodeIndexById.set(n.id, i);
    return {
      index: i,
      id: n.id,
      x: n.x,
      y: n.y,
      control: 'none',
      crosswalk: n.crosswalk,
      zone: n.zone,
      weight: n.weight,
      radius: 0,
      ringRadius: 0,
      inLinks: [],
      outLinks: [],
      neighbors: 0,
      movements: [],
      movIndex: new Int16Array(0),
      conflicts: new Uint8Array(0),
      phases: [],
      greens: [],
      offset: n.offset,
      cycle: 0,
    };
  });

  // Radius simpang: separuh lebar jalan terlebar yang terhubung.
  const halfW = new Float64Array(nodes.length);
  const nbrs: Set<number>[] = nodes.map(() => new Set());
  for (const r of doc.roads) {
    const a = nodeIndexById.get(r.a);
    const b = nodeIndexById.get(r.b);
    if (a === undefined || b === undefined) continue;
    const w = roadWidth(r.lanes, r.oneway) / 2;
    halfW[a] = Math.max(halfW[a], w);
    halfW[b] = Math.max(halfW[b], w);
    nbrs[a].add(b);
    nbrs[b].add(a);
  }
  doc.nodes.forEach((src, i) => {
    const node = nodes[i];
    node.neighbors = nbrs[i].size;
    let control: NodeControl;
    if (src.control === 'auto') control = node.neighbors >= 3 ? 'priority' : 'none';
    else control = src.control;
    if (control === 'roundabout' && node.neighbors < 3) control = 'priority';
    if ((control === 'priority' || control === 'allway') && node.neighbors < 3) control = 'none';
    node.control = control;
    if (control === 'roundabout') {
      node.ringRadius = Math.max(12, halfW[i] + 7);
      node.radius = node.ringRadius + halfW[i] * 0.6 + 3;
    } else if (node.neighbors <= 2 && control === 'none') {
      node.radius = halfW[i] * 0.5;
    } else {
      node.radius = halfW[i] + 2.5 + (node.crosswalk ? 3 : 0);
    }
  });

  const links: NetLink[] = [];
  let maxSpeed = 1;
  const mkLink = (
    roadId: number,
    a: number,
    b: number,
    lanes: number,
    kmh: number,
    oneway: boolean,
    bus: boolean,
  ) => {
    const A = nodes[a];
    const B = nodes[b];
    const len0 = Math.hypot(B.x - A.x, B.y - A.y);
    const dx = (B.x - A.x) / (len0 || 1);
    const dy = (B.y - A.y) / (len0 || 1);
    let ra = A.radius;
    let rb = B.radius;
    if (ra + rb > len0 - 4) {
      const k = Math.max(0, len0 - 4) / (ra + rb || 1);
      ra *= k;
      rb *= k;
    }
    const speed = kmh / 3.6;
    maxSpeed = Math.max(maxSpeed, speed);
    const length = Math.max(2, len0 - ra - rb);
    const link: NetLink = {
      index: links.length,
      roadId,
      from: a,
      to: b,
      lanes,
      speed,
      length,
      busLane: bus && lanes >= 2,
      oneway,
      x0: A.x + dx * ra,
      y0: A.y + dy * ra,
      x1: B.x - dx * rb,
      y1: B.y - dy * rb,
      dx,
      dy,
      nx: -dy,
      ny: dx,
      laneOffsets: laneOffsetsFor(lanes, oneway),
      freeTime: length / speed,
      major: false,
      phase: -1,
      twin: -1,
      inLocal: -1,
      outLocal: -1,
    };
    links.push(link);
    return link;
  };
  for (const r of doc.roads) {
    const a = nodeIndexById.get(r.a);
    const b = nodeIndexById.get(r.b);
    if (a === undefined || b === undefined || a === b) continue;
    const f = mkLink(r.id, a, b, r.lanes, r.speed, r.oneway, r.busLane);
    if (!r.oneway) {
      const g = mkLink(r.id, b, a, r.lanes, r.speed, false, r.busLane);
      f.twin = g.index;
      g.twin = f.index;
    }
  }
  for (const l of links) {
    l.outLocal = nodes[l.from].outLinks.length;
    nodes[l.from].outLinks.push(l.index);
    l.inLocal = nodes[l.to].inLinks.length;
    nodes[l.to].inLinks.push(l.index);
  }

  for (const node of nodes) buildNodeLogic(node, links, doc.nodes[node.index].greens);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  }
  if (!nodes.length) {
    minX = minY = -100;
    maxX = maxY = 100;
  }
  return { nodes, links, nodeIndexById, maxSpeed, bounds: { minX, minY, maxX, maxY } };
}

function buildNodeLogic(node: NetNode, links: NetLink[], greens: number[] | undefined): void {
  const nIn = node.inLinks.length;
  const nOut = node.outLinks.length;
  node.movIndex = new Int16Array(nIn * nOut).fill(-1);
  const deadEnd = node.neighbors <= 1;
  for (let i = 0; i < nIn; i++) {
    const inL = links[node.inLinks[i]];
    for (let j = 0; j < nOut; j++) {
      const outL = links[node.outLinks[j]];
      const isU = outL.to === inL.from;
      if (isU && !deadEnd) continue;
      const turn = isU ? 'uturn' : turnOf(inL, outL);
      const mIn = laneMid(inL);
      const mOut = laneMid(outL);
      const ex = inL.x1 + inL.nx * mIn - node.x;
      const ey = inL.y1 + inL.ny * mIn - node.y;
      const ox = outL.x0 + outL.nx * mOut - node.x;
      const oy = outL.y0 + outL.ny * mOut - node.y;
      const chord = Math.hypot(ox - ex, oy - ey);
      const length =
        node.control === 'roundabout'
          ? roundaboutArc(node, Math.atan2(ey, ex), Math.atan2(oy, ox))
          : chord * 1.1 + 0.5;
      node.movIndex[i * nOut + j] = node.movements.length;
      node.movements.push({
        inLink: inL.index,
        outLink: outL.index,
        turn,
        a0: normAngle(Math.atan2(ey, ex)),
        a1: normAngle(Math.atan2(oy, ox)),
        length,
      });
    }
  }
  const M = node.movements.length;
  node.conflicts = new Uint8Array(M * M);
  for (let i = 0; i < M; i++)
    for (let j = 0; j < M; j++)
      if (i !== j && movementsConflict(node.movements[i], node.movements[j])) node.conflicts[i * M + j] = 1;

  // Pendekat utama: peringkat (lajur × kecepatan) ≥ peringkat tertinggi kedua.
  if (nIn > 0) {
    const ranks = node.inLinks.map((li) => links[li].lanes * links[li].speed);
    const sorted = [...ranks].sort((a, b) => b - a);
    const second = sorted[Math.min(1, sorted.length - 1)];
    node.inLinks.forEach((li, k) => (links[li].major = ranks[k] >= second - 1e-6));
  }

  if (node.control === 'signal') {
    node.phases = autoPhases(node, links);
    if (node.crosswalk && node.phases.length === 1) node.phases.push([]);
    node.greens = node.phases.map((ph, k) => {
      const given = greens?.[k];
      if (given !== undefined) return given;
      if (ph.length === 0) return PED_PHASE_TIME;
      return ph.some((li) => links[li].major) ? 30 : 20;
    });
    node.phases.forEach((ph, k) => ph.forEach((li) => (links[li].phase = k)));
    node.cycle = node.greens.reduce((s, g) => s + g + YELLOW_TIME + ALL_RED_TIME, 0);
  }
}

/** Panjang busur searah jarum jam (lalu lintas kiri) di bundaran. */
export function roundaboutArc(node: NetNode, aIn: number, aOut: number): number {
  let d = normAngle(aIn - aOut);
  if (d < 0.35) d += Math.PI * 2;
  return d * node.ringRadius + 4;
}

/** Kelompokkan pendekat yang saling berhadapan ke fase yang sama. */
export function autoPhases(node: NetNode, links: NetLink[]): number[][] {
  const items = node.inLinks.map((li) => ({ li, h: Math.atan2(links[li].dy, links[li].dx) }));
  items.sort((a, b) => a.h - b.h);
  const used = new Set<number>();
  const phases: number[][] = [];
  for (const it of items) {
    if (used.has(it.li)) continue;
    used.add(it.li);
    const group = [it.li];
    let best = -1;
    let bestDiff = 0;
    for (const o of items) {
      if (used.has(o.li)) continue;
      // selisih sudut arah [0, π]; pendekat berhadapan ≈ π
      const diff = Math.abs(normAngle(o.h - it.h + Math.PI) - Math.PI);
      if (diff > (Math.PI * 140) / 180 && diff > bestDiff) {
        bestDiff = diff;
        best = o.li;
      }
    }
    if (best >= 0) {
      used.add(best);
      group.push(best);
    }
    phases.push(group);
  }
  return phases;
}

/** Pusat lajur pada link di posisi s. */
export function lanePoint(l: NetLink, lane: number, s: number, lat?: number): [number, number] {
  const off = lat ?? l.laneOffsets[Math.min(lane, l.laneOffsets.length - 1)];
  return [l.x0 + l.dx * s + l.nx * off, l.y0 + l.dy * s + l.ny * off];
}
