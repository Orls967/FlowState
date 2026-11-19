import type { CityDoc, CityNode, CityRoad } from './schema';

/** Operasi penyuntingan kota yang murni (immutable) — dipakai Editor & diuji unit. */

export function nextId(items: readonly { id: number }[]): number {
  let m = -1;
  for (const it of items) if (it.id > m) m = it.id;
  return m + 1;
}

export function addNode(
  doc: CityDoc,
  x: number,
  y: number,
  extra: Partial<CityNode> = {},
): [CityDoc, number] {
  const id = nextId(doc.nodes);
  const node: CityNode = {
    id,
    x: r1(x),
    y: r1(y),
    control: 'auto',
    crosswalk: false,
    zone: 'none',
    weight: 1,
    offset: 0,
    ...extra,
  };
  return [{ ...doc, nodes: [...doc.nodes, node] }, id];
}

export function findRoadBetween(doc: CityDoc, a: number, b: number): CityRoad | undefined {
  return doc.roads.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

export function addRoad(
  doc: CityDoc,
  a: number,
  b: number,
  props: Partial<Omit<CityRoad, 'id' | 'a' | 'b'>> = {},
): [CityDoc, number | null] {
  if (a === b) return [doc, null];
  const existing = findRoadBetween(doc, a, b);
  if (existing) return [doc, existing.id];
  const id = nextId(doc.roads);
  const road: CityRoad = { id, a, b, lanes: 1, speed: 40, oneway: false, busLane: false, ...props };
  return [{ ...doc, roads: [...doc.roads, road] }, id];
}

/** Bagi ruas di titik terdekat ke (x, y); mengembalikan id simpang baru. */
export function splitRoad(doc: CityDoc, roadId: number, x: number, y: number): [CityDoc, number] {
  const road = doc.roads.find((r) => r.id === roadId);
  if (!road) return [doc, -1];
  const a = doc.nodes.find((n) => n.id === road.a)!;
  const b = doc.nodes.find((n) => n.id === road.b)!;
  const [px, py] = projectOnSegment(a.x, a.y, b.x, b.y, x, y);
  const [d0, nid] = addNode(doc, px, py);
  let d = d0;
  const rid = nextId(d.roads);
  const first: CityRoad = { ...road, b: nid };
  const second: CityRoad = { ...road, id: rid, a: nid, b: road.b };
  d = { ...d, roads: d.roads.map((r) => (r.id === roadId ? first : r)).concat(second) };
  // halte bus yang melewati ruas ini tetap valid (halte ada di simpang)
  return [d, nid];
}

export function removeRoad(doc: CityDoc, roadId: number): CityDoc {
  const roads = doc.roads.filter((r) => r.id !== roadId);
  return pruneOrphans({ ...doc, roads });
}

export function removeNode(doc: CityDoc, nodeId: number): CityDoc {
  const roads = doc.roads.filter((r) => r.a !== nodeId && r.b !== nodeId);
  const nodes = doc.nodes.filter((n) => n.id !== nodeId);
  return pruneOrphans({ ...doc, nodes, roads });
}

/** Hapus simpang tanpa ruas & halte yang merujuk simpang yang sudah hilang. */
function pruneOrphans(doc: CityDoc): CityDoc {
  const used = new Set<number>();
  for (const r of doc.roads) {
    used.add(r.a);
    used.add(r.b);
  }
  const nodes = doc.nodes.filter((n) => used.has(n.id));
  const ids = new Set(nodes.map((n) => n.id));
  const bus = doc.transit.bus
    .map((l) => ({ ...l, stops: l.stops.filter((s) => ids.has(s)) }))
    .filter((l) => l.stops.length >= 2);
  return { ...doc, nodes, transit: { ...doc.transit, bus } };
}

export function updateRoad(doc: CityDoc, roadId: number, patch: Partial<Omit<CityRoad, 'id'>>): CityDoc {
  return { ...doc, roads: doc.roads.map((r) => (r.id === roadId ? { ...r, ...patch } : r)) };
}

export function reverseRoad(doc: CityDoc, roadId: number): CityDoc {
  return { ...doc, roads: doc.roads.map((r) => (r.id === roadId ? { ...r, a: r.b, b: r.a } : r)) };
}

export function updateNode(doc: CityDoc, nodeId: number, patch: Partial<Omit<CityNode, 'id'>>): CityDoc {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) };
}

export function nearestNode(doc: CityDoc, x: number, y: number, maxDist: number): CityNode | null {
  let best: CityNode | null = null;
  let bd = maxDist;
  for (const n of doc.nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

export function nearestRoad(doc: CityDoc, x: number, y: number, maxDist: number): CityRoad | null {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  let best: CityRoad | null = null;
  let bd = maxDist;
  for (const r of doc.roads) {
    const a = byId.get(r.a);
    const b = byId.get(r.b);
    if (!a || !b) continue;
    const [px, py] = projectOnSegment(a.x, a.y, b.x, b.y, x, y);
    const d = Math.hypot(px - x, py - y);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

export function projectOnSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
  y: number,
): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
  return [ax + dx * t, ay + dy * t];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
