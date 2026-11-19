import { MinHeap } from './heap';
import type { Network } from './network';

/** Penalti belok (detik) — belok kanan (memotong arus lawan di lalu lintas kiri) lebih mahal. */
const TURN_PENALTY = { straight: 0, left: 2, right: 5, uturn: 25 } as const;

export interface RouteResult {
  links: number[];
  cost: number;
}

/**
 * A* berbasis link (agar larangan putar balik bisa dihormati).
 * Biaya = waktu tempuh dinamis per link (dari `linkCost`) + penalti belok.
 * Heuristik = jarak lurus / kecepatan maksimum jaringan (admissible).
 */
export class Router {
  private g: Float64Array;
  private prev: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private gen = 0;
  private heap = new MinHeap();

  constructor(private net: Network) {
    const n = net.links.length;
    this.g = new Float64Array(n);
    this.prev = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  route(
    fromNode: number,
    toNode: number,
    linkCost: (link: number) => number,
    opts: { firstLink?: number; busOnly?: boolean } = {},
  ): RouteResult | null {
    const { nodes, links, maxSpeed } = this.net;
    if (fromNode === toNode && opts.firstLink === undefined) return null;
    const goal = nodes[toNode];
    const h = (node: number) => Math.hypot(nodes[node].x - goal.x, nodes[node].y - goal.y) / maxSpeed;
    this.gen = (this.gen + 1) >>> 0 || 1;
    const gen = this.gen;
    const heap = this.heap;
    heap.clear();
    const seed = (li: number, cost: number) => {
      this.g[li] = cost;
      this.prev[li] = -1;
      this.stamp[li] = gen;
      heap.push(li, cost + h(links[li].to));
    };
    if (opts.firstLink !== undefined) seed(opts.firstLink, 0);
    else for (const li of nodes[fromNode].outLinks) seed(li, linkCost(li));

    let found = -1;
    while (heap.size) {
      const li = heap.pop();
      if (this.closed[li] === gen) continue;
      this.closed[li] = gen;
      const link = links[li];
      if (link.to === toNode) {
        found = li;
        break;
      }
      const node = nodes[link.to];
      const nOut = node.outLinks.length;
      const base = link.inLocal * nOut;
      for (let j = 0; j < nOut; j++) {
        const mi = node.movIndex[base + j];
        if (mi < 0) continue;
        const mv = node.movements[mi];
        const nl = mv.outLink;
        if (this.closed[nl] === gen) continue;
        const cost = this.g[li] + TURN_PENALTY[mv.turn] + linkCost(nl);
        if (this.stamp[nl] !== gen || cost < this.g[nl]) {
          this.stamp[nl] = gen;
          this.g[nl] = cost;
          this.prev[nl] = li;
          heap.push(nl, cost + h(links[nl].to));
        }
      }
    }
    if (found < 0) return null;
    const out: number[] = [];
    for (let li = found; li >= 0; li = this.prev[li]) out.push(li);
    out.reverse();
    return { links: out, cost: this.g[found] };
  }
}
