import type { CityDoc, CityNode, CityRoad, Control, Zone } from './schema';

/** Pembantu menyusun dokumen kota secara terprogram (dipakai skenario Lab & test). */
export class CityBuilder {
  private nodes: CityNode[] = [];
  private roads: CityRoad[] = [];
  private nid = 0;
  private rid = 0;

  node(x: number, y: number, opts: Partial<Omit<CityNode, 'id' | 'x' | 'y'>> = {}): number {
    const id = this.nid++;
    this.nodes.push({
      id,
      x,
      y,
      control: opts.control ?? 'auto',
      crosswalk: opts.crosswalk ?? false,
      zone: opts.zone ?? 'none',
      weight: opts.weight ?? 1,
      greens: opts.greens,
      offset: opts.offset ?? 0,
    });
    return id;
  }

  road(a: number, b: number, opts: Partial<Omit<CityRoad, 'id' | 'a' | 'b'>> = {}): number {
    const id = this.rid++;
    this.roads.push({
      id,
      a,
      b,
      lanes: opts.lanes ?? 1,
      speed: opts.speed ?? 50,
      oneway: opts.oneway ?? false,
      busLane: opts.busLane ?? false,
    });
    return id;
  }

  setControl(id: number, control: Control): void {
    const n = this.nodes.find((x) => x.id === id);
    if (n) n.control = control;
  }

  setZone(id: number, zone: Zone, weight = 1): void {
    const n = this.nodes.find((x) => x.id === id);
    if (n) {
      n.zone = zone;
      n.weight = weight;
    }
  }

  build(name = ''): CityDoc {
    return { version: 1, name, nodes: this.nodes, roads: this.roads, transit: { bus: [], mrt: [] } };
  }
}

/** Jalan melingkar satu lajur (eksperimen Sugiyama). */
export function ringCity(circumference: number, segments = 24): { city: CityDoc; nodeIds: number[] } {
  const b = new CityBuilder();
  const r = circumference / (2 * Math.PI);
  const ids: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ids.push(b.node(Math.cos(a) * r, Math.sin(a) * r));
  }
  for (let i = 0; i < segments; i++) b.road(ids[i], ids[(i + 1) % segments], { oneway: true, speed: 60 });
  return { city: b.build('ring'), nodeIds: ids };
}

/** Grid n×m sederhana (dipakai test & kanvas awal editor). */
export function gridCity(
  n: number,
  m: number,
  spacing: number,
  opts: { lanes?: number; speed?: number; control?: Control } = {},
): CityDoc {
  const b = new CityBuilder();
  const id: number[][] = [];
  for (let i = 0; i < n; i++) {
    id.push([]);
    for (let j = 0; j < m; j++)
      id[i].push(b.node(j * spacing, i * spacing, { control: opts.control ?? 'auto' }));
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      if (j + 1 < m) b.road(id[i][j], id[i][j + 1], { lanes: opts.lanes ?? 1, speed: opts.speed ?? 50 });
      if (i + 1 < n) b.road(id[i][j], id[i + 1][j], { lanes: opts.lanes ?? 1, speed: opts.speed ?? 50 });
    }
  return b.build('grid');
}
