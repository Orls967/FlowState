import { Rng } from '../sim/rng';
import type { CityDoc, CityNode, CityRoad, Control, Zone } from './schema';

export type CitySize = 'small' | 'medium' | 'large';

const DIMS: Record<CitySize, [number, number]> = {
  small: [7, 7],
  medium: [10, 10],
  large: [13, 13],
};

/**
 * Generator kota prosedural ber-seed: grid berjitter dengan hierarki jalan (arteri & lokal),
 * beberapa ruas dihapus (tetap terhubung), pasangan jalan satu arah, lampu di simpang arteri,
 * bundaran di pinggiran, dan zona berlapis dari pusat (kantor/mal) ke pinggir (permukiman).
 */
export function generateCity(seed: number, size: CitySize = 'medium'): CityDoc {
  const rng = new Rng(seed);
  const [cols, rows] = DIMS[size];
  const spacing = rng.range(135, 165);
  const nodes: CityNode[] = [];
  const grid: number[][] = [];
  const cx = ((cols - 1) * spacing) / 2;
  const cy = ((rows - 1) * spacing) / 2;
  // sedikit lengkungan agar tidak terlalu kaku
  const bendA = rng.range(-0.06, 0.06);
  const bendB = rng.range(-0.06, 0.06);
  let id = 0;
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let c = 0; c < cols; c++) {
      const bx = c * spacing - cx;
      const by = r * spacing - cy;
      const x = bx + rng.range(-14, 14) + by * bendA;
      const y = by + rng.range(-14, 14) + bx * bendB;
      nodes.push({
        id,
        x: round(x),
        y: round(y),
        control: 'auto',
        crosswalk: false,
        zone: 'none',
        weight: 1,
        offset: 0,
      });
      grid[r].push(id++);
    }
  }
  // hierarki: arteri tiap 3 baris/kolom (+ tepi luar sebagai lingkar)
  const artRow = (r: number) => r % 3 === 0 || r === rows - 1;
  const artCol = (c: number) => c % 3 === 0 || c === cols - 1;
  const midR = Math.floor(rows / 2);
  const midC = Math.floor(cols / 2);
  const isMain = (r: number, c: number, horiz: boolean) => (horiz ? r === midR : c === midC);

  interface E {
    a: number;
    b: number;
    art: boolean;
    main: boolean;
    horiz: boolean;
    r: number;
    c: number;
  }
  const edges: E[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols)
        edges.push({
          a: grid[r][c],
          b: grid[r][c + 1],
          art: artRow(r),
          main: isMain(r, c, true),
          horiz: true,
          r,
          c,
        });
      if (r + 1 < rows)
        edges.push({
          a: grid[r][c],
          b: grid[r + 1][c],
          art: artCol(c),
          main: isMain(r, c, false),
          horiz: false,
          r,
          c,
        });
    }

  // hapus sebagian ruas lokal selama graf tetap terhubung
  const keep = edges.map(() => true);
  const order = edges.map((_, i) => i).filter((i) => !edges[i].art && !edges[i].main);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const target = Math.floor(order.length * 0.14);
  let removed = 0;
  for (const ei of order) {
    if (removed >= target) break;
    keep[ei] = false;
    if (
      !connected(
        nodes.length,
        edges.filter((_, k) => keep[k]),
      )
    )
      keep[ei] = true;
    else removed++;
  }

  // pasangan satu arah pada dua jalan lokal sejajar di dekat pusat
  const onewayRows = new Map<number, boolean>();
  const pairRow = clampInt(midR + (rng.chance(0.5) ? 1 : -1), 1, rows - 2);
  if (!artRow(pairRow)) onewayRows.set(pairRow, rng.chance(0.5));

  const roads: CityRoad[] = [];
  let rid = 0;
  edges.forEach((e, k) => {
    if (!keep[k]) return;
    const lanes = e.main ? 3 : e.art ? 2 : 1;
    const speed = e.main ? 60 : e.art ? 50 : 30;
    let a = e.a;
    let b = e.b;
    let oneway = false;
    if (e.horiz && onewayRows.has(e.r)) {
      oneway = true;
      if (onewayRows.get(e.r)) [a, b] = [b, a];
    }
    roads.push({ id: rid++, a, b, lanes: oneway ? 2 : lanes, speed, oneway, busLane: false });
  });

  // pengaturan simpang & zona
  const degree = new Map<number, number>();
  const artDeg = new Map<number, number>();
  for (const r of roads) {
    for (const n of [r.a, r.b]) {
      degree.set(n, (degree.get(n) ?? 0) + 1);
      if (r.lanes >= 2) artDeg.set(n, (artDeg.get(n) ?? 0) + 1);
    }
  }
  const maxDist = Math.hypot(cx, cy);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const n = nodes[grid[r][c]];
      const d = Math.hypot(n.x, n.y) / maxDist;
      const deg = degree.get(n.id) ?? 0;
      const ad = artDeg.get(n.id) ?? 0;
      let control: Control = 'auto';
      if (ad >= 3 && deg >= 3) control = d > 0.62 && rng.chance(0.35) ? 'roundabout' : 'signal';
      n.control = control;
      n.zone = pickZone(rng, d, ad >= 2);
      n.weight = round1(
        n.zone === 'office'
          ? rng.range(1.5, 3.5) * (1.2 - d)
          : n.zone === 'home'
            ? rng.range(0.8, 2) * (0.5 + d)
            : rng.range(0.8, 1.6),
      );
      if (control === 'signal' && (d < 0.45 || n.zone === 'school')) n.crosswalk = true;
      if (n.zone === 'school' && control === 'auto' && deg >= 3) n.crosswalk = true;
    }
  // pastikan setiap jenis zona utama ada
  ensureZone(nodes, rng, 'mall', 2);
  ensureZone(nodes, rng, 'school', 3);
  ensureZone(nodes, rng, 'office', 4);

  return {
    version: 1,
    name: `Kota #${seed}`,
    seed,
    nodes,
    roads,
    transit: { bus: [], mrt: [] },
  };
}

function pickZone(rng: Rng, d: number, arterial: boolean): Zone {
  const u = rng.next();
  if (d < 0.28) return u < 0.62 ? 'office' : u < 0.82 ? 'mall' : 'home';
  if (d < 0.55) return u < 0.22 ? 'office' : u < 0.3 && arterial ? 'mall' : u < 0.42 ? 'school' : 'home';
  return u < 0.1 ? 'school' : u < 0.14 && arterial ? 'mall' : u < 0.2 ? 'office' : 'home';
}

function ensureZone(nodes: CityNode[], rng: Rng, zone: Zone, min: number): void {
  let count = nodes.filter((n) => n.zone === zone).length;
  let guard = 0;
  while (count < min && guard++ < 200) {
    const n = nodes[rng.int(nodes.length)];
    if (n.zone === 'home') {
      n.zone = zone;
      count++;
    }
  }
}

function connected(n: number, edges: { a: number; b: number }[]): boolean {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  const seen = new Uint8Array(n);
  const stack = [0];
  seen[0] = 1;
  let count = 1;
  while (stack.length) {
    const v = stack.pop()!;
    for (const w of adj[v])
      if (!seen[w]) {
        seen[w] = 1;
        count++;
        stack.push(w);
      }
  }
  return count === n;
}

const round = (x: number) => Math.round(x * 10) / 10;
const round1 = (x: number) => Math.round(x * 10) / 10;
const clampInt = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
