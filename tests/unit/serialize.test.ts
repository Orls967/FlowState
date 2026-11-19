import { describe, expect, it } from 'vitest';
import { generateCity } from '../../src/lib/city/generator';
import { cityFromJson, cityToJson, decodeCity, encodeCity, parseCity } from '../../src/lib/city/serialize';
import {
  addNode,
  addRoad,
  removeNode,
  splitRoad,
  nearestRoad,
  updateRoad,
  reverseRoad,
} from '../../src/lib/city/edit';
import { gridCity } from '../../src/lib/city/builders';

describe('serialisasi kota', () => {
  it('JSON bolak-balik identik', () => {
    const city = generateCity(9, 'small');
    const back = cityFromJson(cityToJson(city));
    expect(back.ok && back.doc).toEqual(city);
  });
  it('URL (lz-string) bolak-balik identik', () => {
    const city = generateCity(9, 'medium');
    city.transit.bus.push({ id: 0, name: 'K1', stops: [0, 5, 9], headway: 300, dedicated: true });
    const s = encodeCity(city);
    expect(s).toMatch(/^[A-Za-z0-9+\-$]+$/);
    const back = decodeCity(s);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.doc).toEqual(city);
  });
  it('menolak dokumen tidak valid', () => {
    expect(cityFromJson('{bukan json').ok).toBe(false);
    expect(parseCity({ version: 2, nodes: [], roads: [] }).ok).toBe(false);
    const bad = generateCity(1, 'small');
    bad.roads.push({ id: 9999, a: 0, b: 123456, lanes: 1, speed: 40, oneway: false, busLane: false });
    expect(parseCity(bad).ok).toBe(false);
    const lanes = generateCity(1, 'small');
    lanes.roads[0].lanes = 9;
    expect(parseCity(lanes).ok).toBe(false);
    expect(decodeCity('xxxx').ok).toBe(false);
  });
  it('mengisi nilai default yang hilang', () => {
    const r = parseCity({
      version: 1,
      nodes: [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 100, y: 0 },
      ],
      roads: [{ id: 0, a: 0, b: 1, lanes: 1, speed: 40 }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.doc.nodes[0].control).toBe('auto');
      expect(r.doc.transit.bus).toEqual([]);
    }
  });
});

describe('operasi editor', () => {
  it('tambah simpang & ruas, tanpa duplikat', () => {
    const [d1, a] = addNode(gridCity(1, 1, 100), 0, 200);
    const [d2a, b] = addNode(d1, 100, 200);
    const [d, rid] = addRoad(d2a, a, b);
    expect(rid).not.toBeNull();
    const [d2, rid2] = addRoad(d, b, a);
    expect(rid2).toBe(rid);
    expect(d2.roads.length).toBe(d.roads.length);
    expect(parseCity(d).ok).toBe(true);
  });
  it('membagi ruas menghasilkan simpang baru di tengah', () => {
    const d0 = gridCity(1, 2, 100);
    const [d, nid] = splitRoad(d0, 0, 50, 10);
    expect(d.roads).toHaveLength(2);
    const n = d.nodes.find((x) => x.id === nid)!;
    expect(n.x).toBeCloseTo(50);
    expect(n.y).toBeCloseTo(0);
    expect(nearestRoad(d, 25, 1, 5)).not.toBeNull();
  });
  it('hapus simpang menghapus ruas terkait & simpang yatim', () => {
    const d0 = gridCity(2, 2, 100);
    const d = removeNode(d0, 0);
    expect(d.roads.every((r) => r.a !== 0 && r.b !== 0)).toBe(true);
    expect(d.nodes.find((n) => n.id === 0)).toBeUndefined();
  });
  it('ubah & balik arah ruas', () => {
    const d0 = gridCity(1, 2, 100);
    const d = reverseRoad(updateRoad(d0, 0, { oneway: true, lanes: 3 }), 0);
    expect(d.roads[0]).toMatchObject({ a: 1, b: 0, lanes: 3, oneway: true });
    expect(d0.roads[0].lanes).toBe(1);
  });
});
