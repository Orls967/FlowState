import type { BusLine, CityDoc, MrtLine } from './schema';
import { compileNetwork } from '../sim/network';
import { Router } from '../sim/routing';
import { nextId } from './edit';

/** Daftar id ruas (road) yang dilewati jalur bus (rute A* waktu bebas antar halte). */
export function busRoadIds(doc: CityDoc, stops: readonly number[]): number[] {
  const net = compileNetwork(doc);
  const router = new Router(net);
  const out = new Set<number>();
  const idx = stops.map((s) => net.nodeIndexById.get(s)).filter((v): v is number => v !== undefined);
  for (let k = 1; k < idx.length; k++) {
    const r = router.route(idx[k - 1], idx[k], (li) => net.links[li].freeTime);
    if (r) for (const li of r.links) out.add(net.links[li].roadId);
  }
  return [...out];
}

/** Tandai lajur bus pada ruas yang dilewati jalur BRT (ruas ≥ 2 lajur). */
export function applyDedicatedLanes(doc: CityDoc): CityDoc {
  const ded = doc.transit.bus.filter((l) => l.dedicated);
  if (!ded.length) return doc;
  const ids = new Set(ded.flatMap((l) => busRoadIds(doc, l.stops)));
  return {
    ...doc,
    roads: doc.roads.map((r) => (ids.has(r.id) && r.lanes >= 2 ? { ...r, busLane: true } : r)),
  };
}

/** Koridor BRT contoh: dari simpang paling barat ke paling timur melewati pusat, halte tiap ±2 simpang. */
export function presetBrt(doc: CityDoc): BusLine | null {
  if (doc.nodes.length < 4) return null;
  const net = compileNetwork(doc);
  const router = new Router(net);
  const ys = doc.nodes.map((n) => n.y);
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const band = doc.nodes.filter((n) => Math.abs(n.y - midY) < 60);
  const pool = band.length >= 2 ? band : doc.nodes;
  const west = pool.reduce((a, b) => (b.x < a.x ? b : a));
  const east = pool.reduce((a, b) => (b.x > a.x ? b : a));
  const r = router.route(
    net.nodeIndexById.get(west.id)!,
    net.nodeIndexById.get(east.id)!,
    (li) => net.links[li].freeTime / Math.max(1, net.links[li].lanes),
  );
  if (!r) return null;
  const nodes = [net.links[r.links[0]].from, ...r.links.map((li) => net.links[li].to)].map(
    (i) => net.nodes[i].id,
  );
  const stops = nodes.filter((_, i) => i % 2 === 0 || i === nodes.length - 1);
  return {
    id: nextId(doc.transit.bus),
    name: `K${doc.transit.bus.length + 1}`,
    stops: stops.slice(0, 40),
    headway: 300,
    dedicated: true,
  };
}

/** Jalur MRT contoh: utara–selatan melalui pusat kota, stasiun tiap ±550 m. */
export function presetMrt(doc: CityDoc): MrtLine | null {
  if (doc.nodes.length < 2) return null;
  const xs = doc.nodes.map((n) => n.x);
  const ys = doc.nodes.map((n) => n.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + 40;
  const y0 = Math.min(...ys) + 40;
  const y1 = Math.max(...ys) - 40;
  const n = Math.max(2, Math.round((y1 - y0) / 550) + 1);
  const stations = Array.from({ length: n }, (_, i) => ({
    x: Math.round(cx + Math.sin(i * 1.3) * 60),
    y: Math.round(y1 - ((y1 - y0) * i) / (n - 1)),
  }));
  return { id: nextId(doc.transit.mrt), name: `MRT ${doc.transit.mrt.length + 1}`, stations, headway: 300 };
}
