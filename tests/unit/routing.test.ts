import { describe, expect, it } from 'vitest';
import { compileNetwork, movementsConflict, turnOf } from '../../src/lib/sim/network';
import { Router } from '../../src/lib/sim/routing';
import { CityBuilder, gridCity } from '../../src/lib/city/builders';
import { MinHeap } from '../../src/lib/sim/heap';

describe('graf jalan', () => {
  it('jalan dua arah menjadi dua link berarah dengan twin', () => {
    const b = new CityBuilder();
    const a = b.node(0, 0);
    const c = b.node(100, 0);
    b.road(a, c, { lanes: 2 });
    const net = compileNetwork(b.build());
    expect(net.links).toHaveLength(2);
    expect(net.links[0].twin).toBe(1);
    expect(net.links[0].laneOffsets).toHaveLength(2);
    // lalu lintas kiri: lajur berada di kiri arah perjalanan
    expect(net.links[0].laneOffsets.every((o) => o > 0)).toBe(true);
  });
  it('jalan satu arah hanya satu link', () => {
    const b = new CityBuilder();
    b.road(b.node(0, 0), b.node(100, 0), { oneway: true });
    expect(compileNetwork(b.build()).links).toHaveLength(1);
  });
  it('jenis belokan', () => {
    const b = new CityBuilder();
    const c = b.node(0, 0);
    const w = b.node(-100, 0);
    const n = b.node(0, 100);
    const s = b.node(0, -100);
    const e = b.node(100, 0);
    for (const x of [w, n, s, e]) b.road(x, c);
    const net = compileNetwork(b.build());
    const link = (from: number, to: number) =>
      net.links.find((l) => l.from === net.nodeIndexById.get(from) && l.to === net.nodeIndexById.get(to))!;
    expect(turnOf(link(w, c), link(c, e))).toBe('straight');
    expect(turnOf(link(w, c), link(c, n))).toBe('left');
    expect(turnOf(link(w, c), link(c, s))).toBe('right');
  });
  it('konflik movement: lurus berpotongan, belok kiri dekat tidak', () => {
    const b = new CityBuilder();
    const c = b.node(0, 0);
    const w = b.node(-100, 0);
    const n = b.node(0, 100);
    const s = b.node(0, -100);
    const e = b.node(100, 0);
    for (const x of [w, n, s, e]) b.road(x, c);
    const net = compileNetwork(b.build());
    const node = net.nodes[net.nodeIndexById.get(c)!];
    const ix = (f: number, t: number) =>
      node.movements.find(
        (m) =>
          net.links[m.inLink].from === net.nodeIndexById.get(f) &&
          net.links[m.outLink].to === net.nodeIndexById.get(t),
      )!;
    expect(movementsConflict(ix(w, e), ix(s, n))).toBe(true);
    expect(movementsConflict(ix(w, e), ix(e, w))).toBe(false);
    expect(movementsConflict(ix(w, n), ix(e, s))).toBe(false);
    expect(movementsConflict(ix(w, n), ix(s, n))).toBe(true);
  });
});

describe('A*', () => {
  it('menemukan rute terpendek di grid', () => {
    const net = compileNetwork(gridCity(5, 5, 100));
    const r = new Router(net).route(0, 24, (li) => net.links[li].freeTime)!;
    expect(r).not.toBeNull();
    expect(r.links).toHaveLength(8);
    expect(net.links[r.links[0]].from).toBe(0);
    expect(net.links[r.links[r.links.length - 1]].to).toBe(24);
    for (let i = 1; i < r.links.length; i++)
      expect(net.links[r.links[i]].from).toBe(net.links[r.links[i - 1]].to);
  });
  it('menghindari link yang macet (biaya dinamis)', () => {
    const net = compileNetwork(gridCity(3, 3, 100));
    const router = new Router(net);
    const free = router.route(0, 2, (li) => net.links[li].freeTime)!;
    expect(free.links).toHaveLength(2);
    const jammed = new Set(free.links);
    const r2 = router.route(0, 2, (li) => (jammed.has(li) ? 1000 : net.links[li].freeTime))!;
    expect(r2.links.some((l) => jammed.has(l))).toBe(false);
    expect(r2.links.length).toBeGreaterThan(2);
  });
  it('mengembalikan null bila tidak terhubung', () => {
    const b = new CityBuilder();
    b.road(b.node(0, 0), b.node(100, 0));
    b.road(b.node(0, 500), b.node(100, 500));
    const net = compileNetwork(b.build());
    expect(new Router(net).route(0, 2, () => 1)).toBeNull();
  });
  it('menghormati jalan satu arah', () => {
    const b = new CityBuilder();
    const a = b.node(0, 0);
    const c = b.node(100, 0);
    const d = b.node(100, 100);
    b.road(a, c, { oneway: true });
    b.road(c, d);
    b.road(d, a);
    const net = compileNetwork(b.build());
    const r = new Router(net).route(
      net.nodeIndexById.get(c)!,
      net.nodeIndexById.get(a)!,
      (li) => net.links[li].freeTime,
    )!;
    expect(r.links).toHaveLength(2);
  });
  it('heap mengurutkan dengan benar', () => {
    const h = new MinHeap();
    const keys = [5, 3, 9, 1, 7, 2, 8];
    keys.forEach((k, i) => h.push(i, k));
    const out: number[] = [];
    while (h.size) out.push(keys[h.pop()]);
    expect(out).toEqual([...keys].sort((a, b) => a - b));
  });
});
