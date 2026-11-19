import LZString from 'lz-string';
import { CityDocSchema, type CityDoc } from './schema';

export type ParseResult = { ok: true; doc: CityDoc } | { ok: false; error: string };

/** Validasi objek apa pun menjadi CityDoc (dengan default Zod). */
export function parseCity(raw: unknown): ParseResult {
  const r = CityDocSchema.safeParse(raw);
  if (!r.success)
    return {
      ok: false,
      error: r.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    };
  return { ok: true, doc: r.data };
}

export function cityToJson(doc: CityDoc): string {
  return JSON.stringify(doc, null, 2);
}

export function cityFromJson(text: string): ParseResult {
  try {
    return parseCity(JSON.parse(text));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'JSON' };
  }
}

/**
 * Bentuk ringkas untuk URL: larik bertingkat alih-alih objek agar string terkompresi lebih pendek.
 * n: [id, x, y, kontrol, zebra, zona, bobot, offset, greens?]  r: [id, a, b, lajur, kecepatan, flags]
 */
const CONTROLS = ['auto', 'priority', 'signal', 'roundabout', 'allway'] as const;
const ZONES = ['none', 'home', 'office', 'school', 'mall'] as const;

type CompactNode = [number, number, number, number, number, number, number, number, number[]?];
type CompactRoad = [number, number, number, number, number, number];

interface Compact {
  v: 1;
  name: string;
  seed?: number;
  n: CompactNode[];
  r: CompactRoad[];
  t?: CityDoc['transit'];
}

export function encodeCity(doc: CityDoc): string {
  const c: Compact = {
    v: 1,
    name: doc.name,
    seed: doc.seed,
    n: doc.nodes.map((n) => {
      const row: CompactNode = [
        n.id,
        Math.round(n.x * 10) / 10,
        Math.round(n.y * 10) / 10,
        CONTROLS.indexOf(n.control),
        n.crosswalk ? 1 : 0,
        ZONES.indexOf(n.zone),
        n.weight,
        n.offset,
      ];
      if (n.greens) row.push(n.greens);
      return row;
    }),
    r: doc.roads.map((r) => [r.id, r.a, r.b, r.lanes, r.speed, (r.oneway ? 1 : 0) | (r.busLane ? 2 : 0)]),
  };
  if (doc.transit.bus.length || doc.transit.mrt.length) c.t = doc.transit;
  return LZString.compressToEncodedURIComponent(JSON.stringify(c));
}

export function decodeCity(s: string): ParseResult {
  let c: Compact;
  try {
    const json = LZString.decompressFromEncodedURIComponent(s);
    if (!json) return { ok: false, error: 'decompress' };
    c = JSON.parse(json) as Compact;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'decode' };
  }
  if (!c || c.v !== 1 || !Array.isArray(c.n) || !Array.isArray(c.r)) return { ok: false, error: 'format' };
  const raw = {
    version: 1,
    name: c.name ?? '',
    seed: c.seed,
    nodes: c.n.map((row) => ({
      id: row[0],
      x: row[1],
      y: row[2],
      control: CONTROLS[row[3]] ?? 'auto',
      crosswalk: row[4] === 1,
      zone: ZONES[row[5]] ?? 'none',
      weight: row[6],
      offset: row[7],
      greens: row[8],
    })),
    roads: c.r.map((row) => ({
      id: row[0],
      a: row[1],
      b: row[2],
      lanes: row[3],
      speed: row[4],
      oneway: (row[5] & 1) === 1,
      busLane: (row[5] & 2) === 2,
    })),
    transit: c.t ?? { bus: [], mrt: [] },
  };
  return parseCity(raw);
}
