import type { CityDoc } from '../city/schema';
import {
  compileNetwork,
  roadWidth,
  type Network,
  type NetLink,
  type NetNode,
  type Movement,
} from './network';
import { Rng } from './rng';
import { Router } from './routing';
import { idmAccel, ballisticStep, type IdmParams } from './idm';
import { mobilDecision } from './mobil';
import { phaseAt, stateForPhase, SignalState, type PhaseInfo } from './signals';
import { DRIVER_PARAMS, PRIVATE_MIX, VehicleType, type DriverParams } from './vehicles';
import { ZonePicker, generateTrips, type Flow, type Trip } from './demand';

export type DemandConfig =
  { kind: 'zones'; peakPerHour: number } | { kind: 'flows'; flows: Flow[] } | { kind: 'none' };

export interface SimConfig {
  city: CityDoc;
  seed: number;
  /** langkah waktu tetap (s) */
  dt?: number;
  /** jam mulai (0..24) */
  startHour?: number;
  demand: DemandConfig;
  maxVehicles?: number;
  /** jalan melingkar: urutan id node yang membentuk loop + jumlah kendaraan awal */
  ring?: { nodeIds: number[]; count: number; type?: VehicleType };
  /** simpangan baku derau percepatan (m/s²) */
  noise?: number;
  rerouting?: boolean;
  /** jarak (m) sebelum lajur berakhir tempat pengemudi "merge awal" berhenti & menunggu; 0 = zipper */
  earlyMergeDistance?: number;
  /** pejalan kaki per jam per zebra cross */
  pedRate?: number;
  /** override parameter IDM untuk semua jenis (mis. eksperimen Sugiyama) */
  idm?: Partial<Pick<DriverParams, 'a' | 'b' | 'T' | 's0'>> & { v0?: number };
  /** daftar id node yang membentuk koridor untuk diagram ruang–waktu */
  corridor?: number[];
  /** aktifkan angkutan umum dari dokumen kota (default true) */
  transit?: boolean;
  /** pengali durasi hijau semua sinyal (Analitik) */
  greenScale?: number;
}

export interface TimeSample {
  t: number;
  active: number;
  meanSpeed: number;
  stopped: number;
  meanTravelTime: number;
  throughput: number;
  emissions: number;
}

export interface LiveStats {
  t: number;
  hour: number;
  active: number;
  meanSpeed: number;
  stopped: number;
  tripsDone: number;
  tripsStarted: number;
  meanTravelTime: number;
  meanDelay: number;
  throughput: number;
  stopsPerVehicle: number;
  speedStd: number;
  emissionsTotal: number;
  /** emisi relatif per perjalanan (semua moda) */
  emissionsPerTrip: number;
  /** [mobil, motor, bus, mrt] */
  modeCounts: [number, number, number, number];
  lineRiders: number[];
  dropped: number;
}

export interface SelectedInfo {
  id: number;
  type: VehicleType;
  origin: number;
  destination: number;
  route: number[];
  routeIndex: number;
  elapsed: number;
  eta: number;
  distanceLeft: number;
  reroutes: number;
  speed: number;
}

const LOOKAHEAD = 70;
const CRITICAL_GAP = 4.0;
const ROUNDABOUT_GAP = 3.0;
const TURN_SPEED: Record<Movement['turn'], number> = { straight: 99, left: 6.5, right: 7.5, uturn: 4 };
const ROUNDABOUT_SPEED = 7.5;
const B_SAFE = 4;
const BUS_DWELL = 10;
const MRT_SPEED = 14;
const WALK_SPEED = 1.3;

/** Keadaan satu kendaraan. */
export class Vehicle {
  id = 0;
  slot = 0;
  type: VehicleType = VehicleType.Car;
  p: DriverParams = DRIVER_PARAMS[0];
  idm: IdmParams = { v0: 13, a: 1, b: 1.5, T: 1.4, s0: 2 };
  v0f = 1;
  link = 0;
  lane = 0;
  s = 0;
  v = 0;
  acc = 0;
  accClean = 0;
  lat = 0;
  route: number[] = [];
  ri = 0;
  loop = false;
  origin = 0;
  dest = 0;
  depart = 0;
  freeTime = 0;
  committed = false;
  canCross = true;
  arrival = Infinity;
  /** konektor simpang: 0 tidak ada, 1 bezier, 2 busur bundaran */
  cKind = 0;
  cLen = 0;
  cNode = -1;
  cMov = -1;
  cP = new Float64Array(8);
  insideNode = -1;
  lastLc = -99;
  linkEnter = 0;
  stops = 0;
  moving = false;
  reroutes = 0;
  lastPlan = 0;
  brakeUntil = -1;
  /** bus: indeks jalur & antrean node halte */
  line = -1;
  stopsLeft: number[] = [];
  dwellUntil = -1;
  obstGap = Infinity;
  obstV = 0;
  heading = 0;
  x = 0;
  y = 0;
  dist = 0;
}

interface Approach {
  link: number;
  waiting: number;
  crossing: number[];
  dur: number;
}

interface BusLineRt {
  index: number;
  stops: number[];
  pathF: number[] | null;
  pathB: number[] | null;
  headway: number;
  nextF: number;
  nextB: number;
  dedicated: boolean;
  /** jarak kumulatif di sepanjang halte (m) */
  stopDist: number[];
  riders: number;
}

interface MrtLineRt {
  pts: [number, number][];
  cum: number[];
  length: number;
  headway: number;
  riders: number;
}

interface SpawnItem {
  type: VehicleType;
  route: number[];
  origin: number;
  dest: number;
  line: number;
  stops: number[];
  t: number;
}

const TYPE_TURN_FACTOR = [1, 1.1, 0.8, 0.8];

export class Simulation {
  readonly net: Network;
  readonly dt: number;
  readonly cfg: SimConfig;
  t = 0;
  stepCount = 0;
  private rng: Rng;
  private router: Router;
  private picker: ZonePicker;
  vehicles: (Vehicle | null)[] = [];
  private free: number[] = [];
  private nextId = 1;
  /** laneVeh[link][lane] = slot terurut s menurun (paling depan dulu) */
  laneVeh: number[][][];
  private inside: number[][];
  private phaseInfo: PhaseInfo[];
  private approaches: Approach[] = [];
  private approachOf: Int32Array;
  private ema: Float64Array;
  linkCost: Float64Array;
  /** jumlah kendaraan keluar per link (kumulatif) */
  exitCount: Uint32Array;
  private spawnQ: Map<number, SpawnItem[]> = new Map();
  private tripBuf: Trip[] = [];
  private busLines: BusLineRt[] = [];
  private mrtLines: MrtLineRt[] = [];
  private flowAcc: number[] = [];
  peakPerHour = 0;
  maxVehicles: number;
  noise: number;
  earlyMerge: number;
  pedRate: number;
  rerouting: boolean;
  speedMul = 1;
  active = 0;
  // statistik
  tripsDone = 0;
  tripsStarted = 0;
  dropped = 0;
  private ttWindow: { t: number; tt: number; delay: number }[] = [];
  private stopsDone = 0;
  emissions = 0;
  modeCounts: [number, number, number, number] = [0, 0, 0, 0];
  samples: TimeSample[] = [];
  fdSamples: { k: number; q: number }[] = [];
  private fdLast = 0;
  private fdExit: Uint32Array;
  private corridorLinks: number[] = [];
  private corridorStart: number[] = [];
  corridorLength = 0;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.dt = cfg.dt ?? 0.2;
    this.rng = new Rng(cfg.seed);
    this.net = compileNetwork(cfg.city);
    this.router = new Router(this.net);
    this.picker = new ZonePicker(this.net);
    this.maxVehicles = cfg.maxVehicles ?? 2500;
    this.noise = cfg.noise ?? 0;
    this.earlyMerge = cfg.earlyMergeDistance ?? 0;
    this.pedRate = cfg.pedRate ?? 150;
    this.rerouting = cfg.rerouting ?? true;
    this.peakPerHour = cfg.demand.kind === 'zones' ? cfg.demand.peakPerHour : 0;
    const L = this.net.links.length;
    this.laneVeh = this.net.links.map((l) => Array.from({ length: l.lanes }, () => []));
    this.inside = this.net.nodes.map(() => []);
    this.phaseInfo = this.net.nodes.map(() => ({ phase: 0, state: SignalState.Green, remaining: 0 }));
    this.ema = new Float64Array(L);
    this.linkCost = new Float64Array(L);
    this.exitCount = new Uint32Array(L);
    this.fdExit = new Uint32Array(L);
    if (cfg.greenScale && cfg.greenScale !== 1) {
      for (const n of this.net.nodes)
        if (n.control === 'signal') {
          n.greens = n.greens.map((g) => Math.max(5, g * cfg.greenScale!));
          n.cycle = n.greens.reduce((s, g) => s + g + 5, 0);
        }
    }
    for (const l of this.net.links) {
      this.ema[l.index] = this.baseFree(l);
      this.linkCost[l.index] = this.ema[l.index];
    }
    this.approachOf = new Int32Array(L).fill(-1);
    for (const n of this.net.nodes) {
      if (!n.crosswalk) continue;
      for (const li of n.inLinks) {
        const l = this.net.links[li];
        this.approachOf[li] = this.approaches.length;
        this.approaches.push({
          link: li,
          waiting: 0,
          crossing: [],
          dur: roadWidth(l.lanes, l.oneway) / 1.25 + 1,
        });
      }
    }
    if (cfg.transit !== false) this.initTransit();
    if (cfg.ring) this.initRing(cfg.ring);
    if (cfg.demand.kind === 'flows') this.flowAcc = cfg.demand.flows.map(() => 0);
    if (cfg.corridor) this.setCorridor(cfg.corridor);
  }

  get hour(): number {
    return ((((this.cfg.startHour ?? 7) + this.t / 3600) % 24) + 24) % 24;
  }

  /** Waktu tempuh bebas + perkiraan tundaan sinyal rata-rata. */
  private baseFree(l: NetLink): number {
    const node = this.net.nodes[l.to];
    let extra = 0;
    if (node.control === 'signal' && l.phase >= 0) {
      const g = node.greens[l.phase];
      const red = node.cycle - g;
      extra = (red * red) / (2 * node.cycle);
    } else if (node.control !== 'none' && !l.major) extra = 3;
    return l.freeTime + extra;
  }

  // ───────────────────────────── angkutan umum ─────────────────────────────

  private initTransit(): void {
    const { city } = this.cfg;
    const idx = this.net.nodeIndexById;
    city.transit.bus.forEach((line, li) => {
      const stops = line.stops.map((id) => idx.get(id)).filter((v): v is number => v !== undefined);
      const pathF = this.pathThrough(stops);
      const pathB = this.pathThrough([...stops].reverse());
      const stopDist: number[] = [0];
      for (let k = 1; k < stops.length; k++) {
        const a = this.net.nodes[stops[k - 1]];
        const b = this.net.nodes[stops[k]];
        stopDist.push(stopDist[k - 1] + Math.hypot(a.x - b.x, a.y - b.y) * 1.2);
      }
      if (line.dedicated && pathF)
        for (const l of [...pathF, ...(pathB ?? [])])
          if (this.net.links[l].lanes >= 2) this.net.links[l].busLane = true;
      this.busLines.push({
        index: li,
        stops,
        pathF,
        pathB,
        headway: line.headway,
        nextF: 0,
        nextB: line.headway / 2,
        dedicated: line.dedicated,
        stopDist,
        riders: 0,
      });
    });
    for (const line of city.transit.mrt) {
      const pts = line.stations.map((s) => [s.x, s.y] as [number, number]);
      const cum = [0];
      for (let k = 1; k < pts.length; k++)
        cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      this.mrtLines.push({ pts, cum, length: cum[cum.length - 1], headway: line.headway, riders: 0 });
    }
  }

  private pathThrough(nodes: number[]): number[] | null {
    const out: number[] = [];
    for (let k = 1; k < nodes.length; k++) {
      const first = out.length ? out[out.length - 1] : undefined;
      const r =
        first !== undefined
          ? this.router.route(this.net.links[first].to, nodes[k], (li) => this.net.links[li].freeTime, {
              firstLink: first,
            })
          : this.router.route(nodes[k - 1], nodes[k], (li) => this.net.links[li].freeTime);
      if (!r) return null;
      out.push(...(first !== undefined ? r.links.slice(1) : r.links));
    }
    return out.length ? out : null;
  }

  get hasTransit(): boolean {
    return this.busLines.length > 0 || this.mrtLines.length > 0;
  }

  /** Posisi kereta MRT (x, y, heading) — dihitung analitis dari jadwal. */
  trainPositions(out: number[]): void {
    for (const line of this.mrtLines) {
      if (line.length < 10) continue;
      const turn = 60;
      const oneWay = line.length / MRT_SPEED;
      const cycle = 2 * (oneWay + turn);
      const n = Math.max(1, Math.ceil(cycle / line.headway));
      for (let k = 0; k < n; k++) {
        let tc = (((this.t - k * line.headway) % cycle) + cycle) % cycle;
        let d: number;
        let dir = 1;
        if (tc < oneWay) d = tc * MRT_SPEED;
        else if ((tc -= oneWay) < turn) d = line.length;
        else if ((tc -= turn) < oneWay) {
          d = line.length - tc * MRT_SPEED;
          dir = -1;
        } else {
          d = 0;
        }
        const [x, y, h] = pointAlong(line.pts, line.cum, d);
        out.push(x, y, dir > 0 ? h : h + Math.PI);
      }
    }
  }

  // ───────────────────────────── kendaraan ─────────────────────────────

  private alloc(): Vehicle {
    let slot: number;
    if (this.free.length) slot = this.free.pop()!;
    else {
      slot = this.vehicles.length;
      this.vehicles.push(null);
    }
    const v = new Vehicle();
    v.slot = slot;
    v.id = this.nextId++;
    this.vehicles[slot] = v;
    this.active++;
    return v;
  }

  private release(u: Vehicle): void {
    if (u.insideNode >= 0) removeFrom(this.inside[u.insideNode], u.slot);
    this.vehicles[u.slot] = null;
    this.free.push(u.slot);
    this.active--;
  }

  private setType(u: Vehicle, type: VehicleType): void {
    u.type = type;
    u.p = DRIVER_PARAMS[type];
    const o = this.cfg.idm;
    u.idm = {
      v0: o?.v0 ?? 13,
      a: o?.a ?? u.p.a,
      b: o?.b ?? u.p.b,
      T: (o?.T ?? u.p.T) * this.rng.range(0.9, 1.1),
      s0: o?.s0 ?? u.p.s0,
    };
    u.v0f = this.cfg.idm?.v0 !== undefined ? 1 : this.rng.range(0.9, 1.1);
  }

  private initRing(ring: NonNullable<SimConfig['ring']>): void {
    const idx = this.net.nodeIndexById;
    const nodes = ring.nodeIds.map((id) => idx.get(id)!);
    const route: number[] = [];
    for (let k = 0; k < nodes.length; k++) {
      const a = nodes[k];
      const b = nodes[(k + 1) % nodes.length];
      const li = this.net.nodes[a].outLinks.find((l) => this.net.links[l].to === b);
      if (li === undefined) throw new Error('ring is not connected');
      route.push(li);
    }
    const total = route.reduce((s, li) => s + this.net.links[li].length, 0);
    const spacing = total / ring.count;
    for (let i = 0; i < ring.count; i++) {
      let pos = i * spacing;
      let ri = 0;
      while (pos >= this.net.links[route[ri]].length) {
        pos -= this.net.links[route[ri]].length;
        ri++;
      }
      const u = this.alloc();
      this.setType(u, ring.type ?? VehicleType.Car);
      u.route = route;
      u.ri = ri;
      u.loop = true;
      u.link = route[ri];
      u.lane = 0;
      u.s = pos;
      u.lat = this.net.links[u.link].laneOffsets[0];
      u.v = Math.min(u.idm.v0, this.net.links[u.link].speed) * 0.8;
      u.depart = 0;
      this.insertSorted(this.laneVeh[u.link][0], u);
    }
    this.setCorridor(ring.nodeIds.concat([ring.nodeIds[0]]));
  }

  setCorridor(nodeIds: number[]): void {
    const idx = this.net.nodeIndexById;
    this.corridorLinks = [];
    this.corridorStart = [];
    let acc = 0;
    for (let k = 1; k < nodeIds.length; k++) {
      const a = idx.get(nodeIds[k - 1]);
      const b = idx.get(nodeIds[k]);
      if (a === undefined || b === undefined) continue;
      const li = this.net.nodes[a].outLinks.find((l) => this.net.links[l].to === b);
      if (li === undefined) continue;
      this.corridorLinks.push(li);
      this.corridorStart.push(acc);
      acc += this.net.links[li].length + this.net.nodes[b].radius * 2;
    }
    this.corridorLength = acc;
  }

  /** Posisi & kecepatan kendaraan di koridor: [pos, speed, …] */
  corridorSnapshot(): Float32Array {
    const out: number[] = [];
    this.corridorLinks.forEach((li, k) => {
      for (const lane of this.laneVeh[li])
        for (const slot of lane) {
          const u = this.vehicles[slot]!;
          if (u.s < 0) continue;
          out.push(this.corridorStart[k] + u.s, u.v);
        }
    });
    return new Float32Array(out);
  }

  private insertSorted(arr: number[], u: Vehicle): void {
    let i = arr.length;
    while (i > 0 && this.vehicles[arr[i - 1]]!.s < u.s) i--;
    arr.splice(i, 0, u.slot);
  }

  private costFn = (li: number) => this.linkCost[li];

  /** Bangkitkan perjalanan pribadi/angkutan umum dengan pemilihan moda logit. */
  private handleTrip(trip: Trip): void {
    this.tripsStarted++;
    const r = this.router.route(trip.from, trip.to, this.costFn);
    if (!r) return;
    let mode = 0; // 0 pribadi, 1 bus, 2 mrt
    if (this.hasTransit && !trip.freight) mode = this.chooseMode(trip, r.cost);
    if (mode === 1) {
      this.modeCounts[2]++;
      return;
    }
    if (mode === 2) {
      this.modeCounts[3]++;
      return;
    }
    const type: VehicleType = trip.freight
      ? VehicleType.Truck
      : (this.rng.weighted(PRIVATE_MIX) as VehicleType);
    this.modeCounts[type === VehicleType.Moto ? 1 : 0]++;
    this.enqueue({ type, route: r.links, origin: trip.from, dest: trip.to, line: -1, stops: [], t: this.t });
  }

  private chooseMode(trip: Trip, privCost: number): number {
    const nodes = this.net.nodes;
    const o = nodes[trip.from];
    const d = nodes[trip.to];
    const costs: number[] = [privCost + 240];
    const kinds: { mode: number; line: number }[] = [{ mode: 0, line: -1 }];
    for (const line of this.busLines) {
      if (!line.pathF) continue;
      const a = nearestIndex(
        line.stops.map((s) => [nodes[s].x, nodes[s].y] as [number, number]),
        o.x,
        o.y,
      );
      const b = nearestIndex(
        line.stops.map((s) => [nodes[s].x, nodes[s].y] as [number, number]),
        d.x,
        d.y,
      );
      if (a.i === b.i) continue;
      const walk = ((a.d + b.d) * 1.3) / WALK_SPEED;
      if (walk > 1400) continue;
      const busSpeed = line.dedicated ? 9 : this.lineSpeed(line);
      const ivt = Math.abs(line.stopDist[b.i] - line.stopDist[a.i]) / busSpeed + Math.abs(b.i - a.i) * 15;
      costs.push(ivt + 2 * walk + 1.5 * (line.headway / 2) + (line.dedicated ? 30 : 120));
      kinds.push({ mode: 1, line: line.index });
    }
    this.mrtLines.forEach((line, k) => {
      const a = nearestIndex(line.pts, o.x, o.y);
      const b = nearestIndex(line.pts, d.x, d.y);
      if (a.i === b.i) return;
      const walk = ((a.d + b.d) * 1.3) / WALK_SPEED;
      if (walk > 1600) return;
      const ivt = Math.abs(line.cum[b.i] - line.cum[a.i]) / MRT_SPEED + Math.abs(b.i - a.i) * 30;
      costs.push(ivt + 2 * walk + 1.5 * (line.headway / 2) + 20);
      kinds.push({ mode: 2, line: k });
    });
    if (costs.length === 1) return 0;
    const mu = 1 / 150;
    const min = Math.min(...costs);
    const w = costs.map((c) => Math.exp(-mu * (c - min)));
    const pick = kinds[this.rng.weighted(w)];
    if (pick.mode === 1) this.busLines[pick.line].riders++;
    if (pick.mode === 2) this.mrtLines[pick.line].riders++;
    return pick.mode;
  }

  private lineSpeed(line: BusLineRt): number {
    if (!line.pathF) return 6;
    let len = 0;
    let tt = 0;
    for (const li of line.pathF) {
      len += this.net.links[li].length;
      tt += this.linkCost[li];
    }
    return Math.max(2, Math.min(12, (len / Math.max(1, tt)) * 0.85));
  }

  private enqueue(item: SpawnItem): void {
    const first = item.route[0];
    let q = this.spawnQ.get(first);
    if (!q) {
      q = [];
      this.spawnQ.set(first, q);
    }
    if (q.length > 25) {
      this.dropped++;
      return;
    }
    q.push(item);
  }

  private trySpawn(): void {
    for (const [li, q] of this.spawnQ) {
      if (!q.length) continue;
      if (this.active >= this.maxVehicles) {
        if (q.length > 10) {
          q.shift();
          this.dropped++;
        }
        continue;
      }
      const link = this.net.links[li];
      const item = q[0];
      const p = DRIVER_PARAMS[item.type];
      // pilih lajur dengan ruang terbesar di awal link
      let best = -1;
      let bestSpace = -Infinity;
      let bestV = 0;
      for (let k = 0; k < link.lanes; k++) {
        if (!this.laneAllowed(link, k, item.type)) continue;
        const arr = this.laneVeh[li][k];
        const tail = arr.length ? this.vehicles[arr[arr.length - 1]]! : null;
        const space = tail ? tail.s - tail.p.length : link.length;
        if (space > bestSpace) {
          bestSpace = space;
          best = k;
          bestV = tail ? tail.v : link.speed;
        }
      }
      if (best < 0 || bestSpace < p.length + p.s0 + 2) continue;
      q.shift();
      const u = this.alloc();
      this.setType(u, item.type);
      u.route = item.route;
      u.ri = 0;
      u.link = li;
      u.lane = best;
      u.s = 0;
      u.lat = link.laneOffsets[best];
      u.v = Math.min(link.speed * 0.6, bestV);
      u.origin = item.origin;
      u.dest = item.dest;
      u.depart = item.t;
      u.linkEnter = this.t;
      u.lastPlan = this.t;
      u.line = item.line;
      u.stopsLeft = item.stops;
      u.freeTime = item.route.reduce((s, l) => s + this.net.links[l].freeTime, 0);
      this.insertSorted(this.laneVeh[li][best], u);
    }
  }

  private laneAllowed(link: NetLink, lane: number, type: VehicleType): boolean {
    if (!link.busLane || type === VehicleType.Bus) return true;
    return lane !== link.lanes - 1;
  }

  // ───────────────────────────── simpang ─────────────────────────────

  private movementOf(link: NetLink, next: NetLink): number {
    const node = this.net.nodes[link.to];
    return node.movIndex[link.inLocal * node.outLinks.length + next.outLocal];
  }

  private nextLinkOf(u: Vehicle): number {
    if (u.ri + 1 < u.route.length) return u.route[u.ri + 1];
    if (u.loop) return u.route[0];
    return -1;
  }

  private crosswalkBlocked(li: number): boolean {
    const ai = this.approachOf[li];
    if (ai < 0) return false;
    return this.approaches[ai].crossing.length > 0;
  }

  /** Apakah kendaraan u boleh memasuki simpang dari link → next. */
  private mayEnter(u: Vehicle, link: NetLink, next: NetLink, d: number): boolean {
    const node = this.net.nodes[link.to];
    if (this.crosswalkBlocked(link.index)) return false;
    if (next.twin >= 0 && this.crosswalkBlocked(next.twin)) return false;
    if (node.control === 'none') return true;
    const mi = this.movementOf(link, next);
    if (mi < 0) return false;
    const target = this.targetLane(u, link, next, node.movements[mi]);
    if (!this.outSpace(u, next, target)) return false;
    switch (node.control) {
      case 'signal': {
        const st = stateForPhase(this.phaseInfo[node.index], link.phase);
        if (st === SignalState.Green) return true;
        if (st === SignalState.Yellow) return (u.v * u.v) / (2 * u.idm.b) > d - 1;
        return false;
      }
      case 'roundabout':
        return this.roundaboutClear(u, node, link, next);
      case 'priority':
      case 'allway':
        return this.priorityClear(u, node, link, mi, d);
    }
  }

  private outSpace(u: Vehicle, next: NetLink, lane: number): boolean {
    const arr = this.laneVeh[next.index][lane];
    if (!arr.length) return true;
    const tail = this.vehicles[arr[arr.length - 1]]!;
    return tail.s - tail.p.length > u.p.length + 1 || tail.v > 3;
  }

  private priorityClear(u: Vehicle, node: NetNode, link: NetLink, mi: number, d: number): boolean {
    const M = node.movements.length;
    // kendaraan yang sudah di dalam simpang dengan lintasan berpotongan
    for (const slot of this.inside[node.index]) {
      const w = this.vehicles[slot]!;
      if (w.cMov < 0 || w.cMov === mi) continue;
      if (node.conflicts[mi * M + w.cMov]) return false;
    }
    const allway = node.control === 'allway';
    if (allway && u.v > 2.5 && d > 2) return false; // harus berhenti dulu
    // beri jalan ke kendaraan yang mendekat pada pendekat lain yang berkonflik
    for (const li of node.inLinks) {
      if (li === link.index) continue;
      const other = this.net.links[li];
      for (const arr of this.laneVeh[li]) {
        if (!arr.length) continue;
        const w = this.vehicles[arr[0]]!;
        const nl = this.nextLinkOf(w);
        if (nl < 0) continue;
        const wm = this.movementOf(other, this.net.links[nl]);
        if (wm < 0 || !node.conflicts[mi * M + wm]) continue;
        const dw = other.length - w.s;
        if (!allway && link.major) {
          // pendekat utama hanya menunggu kendaraan utama lain yang sudah "berkomitmen"
          if (other.major && w.committed) return false;
          continue;
        }
        if (allway || !other.major) {
          // minor vs minor / allway: datang lebih dulu = lebih dulu jalan
          if (w.committed) return false;
          if (w.arrival < u.arrival || (w.arrival === u.arrival && w.id < u.id)) return false;
          continue;
        }
        if (w.committed) return false;
        const tta = dw / Math.max(w.v, 0.5);
        if (dw < 90 && tta < CRITICAL_GAP && (w.v > 1 || dw < 6)) return false;
      }
    }
    return true;
  }

  private roundaboutClear(_u: Vehicle, node: NetNode, link: NetLink, next: NetLink): boolean {
    const R = node.ringRadius;
    const cap = Math.max(3, Math.floor((2 * Math.PI * R) / 10));
    const ins = this.inside[node.index];
    if (ins.length >= cap) return false;
    const mi = this.movementOf(link, next);
    const aIn = node.movements[mi].a0;
    for (const slot of ins) {
      const w = this.vehicles[slot]!;
      if (w.cKind !== 2) continue;
      // sudut sekarang & sudut keluar (searah jarum jam = sudut menurun)
      const prog = Math.min(1, Math.max(0, (w.s + w.cLen) / w.cLen));
      const span = w.cP[3];
      const cur = w.cP[2] - span * prog;
      const exit = w.cP[2] - span;
      const toEntry = norm2pi(cur - aIn);
      const toExit = norm2pi(cur - exit);
      if (toEntry < toExit) {
        const tt = (toEntry * R) / Math.max(w.v, 2);
        if (tt < ROUNDABOUT_GAP) return false;
      }
      // kendaraan yang baru saja lewat titik masuk (terlalu dekat)
      if (norm2pi(aIn - cur) * R < 4) return false;
    }
    return true;
  }

  /** Lajur tujuan di link berikutnya: belok kiri (dekat) → tepi, belok kanan → dalam. */
  private targetLane(u: Vehicle, _link: NetLink, next: NetLink, mv: Movement): number {
    let lane: number;
    if (mv.turn === 'left') lane = next.lanes - 1;
    else if (mv.turn === 'right' || mv.turn === 'uturn') lane = 0;
    else lane = Math.min(u.lane, next.lanes - 1);
    if (next.busLane) {
      if (u.type === VehicleType.Bus) lane = next.lanes - 1;
      else if (lane === next.lanes - 1) lane = Math.max(0, next.lanes - 2);
    }
    return lane;
  }

  // ───────────────────────────── langkah simulasi ─────────────────────────────

  step(): void {
    const dt = this.dt;
    this.t += dt;
    this.stepCount++;
    const net = this.net;

    // 1. permintaan
    this.tripBuf.length = 0;
    if (this.cfg.demand.kind === 'zones') {
      generateTrips(this.picker, this.rng, this.hour, dt, this.peakPerHour * this.speedMul, this.tripBuf);
      for (const trip of this.tripBuf) this.handleTrip(trip);
    } else if (this.cfg.demand.kind === 'flows') {
      this.cfg.demand.flows.forEach((f, k) => this.runFlow(f, k));
    }
    this.dispatchBuses();
    this.trySpawn();

    // 2. sinyal
    for (const n of net.nodes)
      if (n.control === 'signal')
        this.phaseInfo[n.index] = phaseAt({ greens: n.greens, offset: n.offset }, this.t);

    // 3. pejalan kaki
    this.updatePeds();

    // 4. percepatan
    for (const link of net.links) {
      const lanes = this.laneVeh[link.index];
      for (let k = 0; k < lanes.length; k++) {
        const arr = lanes[k];
        for (let i = 0; i < arr.length; i++)
          this.computeAcc(this.vehicles[arr[i]]!, link, i > 0 ? this.vehicles[arr[i - 1]] : null);
      }
    }

    // 5. pindah lajur (MOBIL), dievaluasi bergiliran ±1× per detik per kendaraan
    const period = Math.max(1, Math.round(1 / dt));
    for (const link of net.links) {
      if (link.lanes < 2) continue;
      const lanes = this.laneVeh[link.index];
      for (let k = 0; k < lanes.length; k++) {
        const arr = lanes[k];
        for (let i = 0; i < arr.length; i++) {
          const u = this.vehicles[arr[i]]!;
          if ((u.slot + this.stepCount) % period !== 0) continue;
          if (this.tryLaneChange(u, link)) i--;
        }
      }
    }

    // 6. gerak & perpindahan link
    const moved: Vehicle[] = [];
    for (const link of net.links) {
      const lanes = this.laneVeh[link.index];
      for (let k = 0; k < lanes.length; k++) {
        const arr = lanes[k];
        let w = 0;
        for (let i = 0; i < arr.length; i++) {
          const u = this.vehicles[arr[i]]!;
          const res = this.move(u, link);
          if (res === 0) arr[w++] = u.slot;
          else if (res === 1) moved.push(u);
        }
        arr.length = w;
      }
    }
    for (const u of moved) this.insertSorted(this.laneVeh[u.link][u.lane], u);

    // 7. statistik berkala
    if (this.stepCount % Math.round(5 / dt) === 0) this.refreshCosts();
    if (this.stepCount % Math.round(30 / dt) === 0) this.sample();
    if (this.t - this.fdLast >= 60) this.sampleFd();
  }

  private runFlow(f: Flow, k: number): void {
    this.flowAcc[k] += (f.rate * this.dt) / 3600;
    // proses Poisson diskret yang tetap deterministik per seed
    const n = this.rng.poisson(this.flowAcc[k]);
    this.flowAcc[k] = 0;
    for (let i = 0; i < n; i++) {
      const idx = this.net.nodeIndexById;
      const from = idx.get(f.from);
      const to = idx.get(f.to);
      if (from === undefined || to === undefined) return;
      let route: number[] | null = null;
      if (f.via?.length) route = this.pathThrough([from, ...f.via.map((v) => idx.get(v)!), to]);
      else route = this.router.route(from, to, this.costFn)?.links ?? null;
      if (!route) return;
      const type = (f.mix ? this.rng.weighted(f.mix) : 0) as VehicleType;
      this.tripsStarted++;
      this.enqueue({ type, route, origin: from, dest: to, line: -1, stops: [], t: this.t });
    }
  }

  private dispatchBuses(): void {
    for (const line of this.busLines) {
      if (this.t >= line.nextF && line.pathF) {
        line.nextF += line.headway;
        this.enqueue({
          type: VehicleType.Bus,
          route: line.pathF,
          origin: line.stops[0],
          dest: line.stops[line.stops.length - 1],
          line: line.index,
          stops: line.stops.slice(1),
          t: this.t,
        });
      }
      if (this.t >= line.nextB && line.pathB) {
        line.nextB += line.headway;
        const rev = [...line.stops].reverse();
        this.enqueue({
          type: VehicleType.Bus,
          route: line.pathB,
          origin: rev[0],
          dest: rev[rev.length - 1],
          line: line.index,
          stops: rev.slice(1),
          t: this.t,
        });
      }
    }
  }

  private updatePeds(): void {
    const dt = this.dt;
    for (const ap of this.approaches) {
      const link = this.net.links[ap.link];
      const node = this.net.nodes[link.to];
      ap.crossing = ap.crossing.filter((t0) => this.t - t0 < ap.dur);
      ap.waiting += this.rng.poisson((this.pedRate * dt) / 3600);
      if (ap.waiting > 12) ap.waiting = 12;
      if (!ap.waiting) continue;
      let ok: boolean;
      if (node.control === 'signal') {
        const st = stateForPhase(this.phaseInfo[node.index], link.phase);
        ok = st === SignalState.Red && this.phaseInfo[node.index].state === SignalState.Green;
      } else {
        ok = true;
        for (const arr of this.laneVeh[ap.link]) {
          if (!arr.length) continue;
          const u = this.vehicles[arr[0]]!;
          const d = link.length - u.s;
          if (u.committed || (u.v > 0.5 && (u.v * u.v) / (2 * 2.5) + 2 > d)) {
            ok = false;
            break;
          }
        }
      }
      if (ok) {
        // satu rombongan menyeberang bersama
        ap.crossing.push(this.t);
        ap.waiting = 0;
      }
    }
  }

  /** Posisi pejalan kaki yang sedang menyeberang & menunggu: [x, y, …] */
  pedPositions(out: number[]): void {
    for (const ap of this.approaches) {
      const l = this.net.links[ap.link];
      const w = roadWidth(l.lanes, l.oneway);
      const cx = l.x1 + l.dx * 1.2;
      const cy = l.y1 + l.dy * 1.2;
      // jalur penyeberangan melintang di ujung link
      const ox = l.oneway ? 0 : 0;
      for (const t0 of ap.crossing) {
        const pr = Math.min(1, (this.t - t0) / ap.dur);
        const off = (w + 2) * (0.5 - pr) + ox;
        out.push(cx + l.nx * off, cy + l.ny * off);
      }
      for (let k = 0; k < Math.min(ap.waiting, 4); k++) {
        const off = w / 2 + 1.2;
        out.push(cx + l.nx * off - l.dx * k * 0.7, cy + l.ny * off - l.dy * k * 0.7);
      }
    }
  }

  private computeAcc(u: Vehicle, link: NetLink, leader: Vehicle | null): void {
    let gap = Infinity;
    let vl = 0;
    if (leader) {
      gap = leader.s - leader.p.length - u.s;
      vl = leader.v;
    }
    let obstGap = Infinity;
    let obstV = 0;
    const d = link.length - u.s;
    let v0 = Math.min(link.speed * u.v0f * u.p.v0Factor, u.p.vmax);
    if (this.cfg.idm?.v0 !== undefined) v0 = this.cfg.idm.v0;
    // di dalam simpang: batasi kecepatan belok
    if (u.s < 0 && u.cMov >= 0) {
      const node = this.net.nodes[u.cNode];
      const turnV =
        node.control === 'roundabout'
          ? ROUNDABOUT_SPEED
          : TURN_SPEED[node.movements[u.cMov].turn] * TYPE_TURN_FACTOR[u.type];
      v0 = Math.min(v0, turnV);
    }
    u.canCross = true;
    const nl = this.nextLinkOf(u);
    if (nl >= 0 && d < LOOKAHEAD + u.v * 3) {
      const next = this.net.links[nl];
      const node = this.net.nodes[link.to];
      const mi = this.movementOf(link, next);
      if (!u.committed) {
        if (d < 8 && u.arrival === Infinity) u.arrival = this.t;
        const ok = mi >= 0 && this.mayEnter(u, link, next, d);
        if (!ok) {
          u.canCross = false;
          obstGap = d - 0.8;
          obstV = 0;
        } else if (d < Math.max(3, (u.v * u.v) / (2 * u.idm.b) + 2)) {
          u.committed = true;
        }
      }
      if (u.canCross && mi >= 0) {
        const mv = node.movements[mi];
        const tl = this.targetLane(u, link, next, mv);
        const arr = this.laneVeh[nl][tl];
        if (arr.length) {
          const tail = this.vehicles[arr[arr.length - 1]]!;
          const g2 = d + mv.length + tail.s - tail.p.length;
          if (g2 < gap) {
            gap = g2;
            vl = tail.v;
          }
        }
        // perlambat menjelang belokan
        const turnV =
          node.control === 'roundabout' ? ROUNDABOUT_SPEED : TURN_SPEED[mv.turn] * TYPE_TURN_FACTOR[u.type];
        if (turnV < v0 && d < 40) v0 = turnV + (v0 - turnV) * Math.max(0, d / 40);
      }
      // lajur berakhir (penyempitan): wajib pindah sebelum ujung
      if (u.lane >= next.lanes && u.s >= 0) {
        const endAt = this.earlyMerge > 0 ? Math.max(5, link.length - this.earlyMerge) : link.length - 1;
        const g = endAt - u.s;
        if (g < obstGap) {
          obstGap = Math.max(0.01, g);
          obstV = 0;
          u.canCross = false;
        }
      }
    }
    // halte bus
    if (u.line >= 0 && u.stopsLeft.length && u.stopsLeft[0] === link.to && u.s >= 0) {
      const stopAt = link.length - 4;
      if (u.dwellUntil < 0 && u.s > stopAt - 2.5 && u.v < 0.6)
        u.dwellUntil = this.t + BUS_DWELL + this.rng.range(0, 6);
      if (u.dwellUntil < 0 || this.t < u.dwellUntil) {
        const g = stopAt - u.s;
        if (g < obstGap) {
          obstGap = Math.max(0.01, g);
          obstV = 0;
          u.canCross = false;
        }
      } else {
        u.stopsLeft.shift();
        u.dwellUntil = -1;
      }
    }
    u.idm.v0 = v0;
    let acc = idmAccel(u.idm, u.v, gap, vl);
    if (obstGap < Infinity) acc = Math.min(acc, idmAccel(u.idm, u.v, obstGap, obstV));
    u.obstGap = obstGap;
    u.obstV = obstV;
    u.accClean = acc;
    if (this.t < u.brakeUntil) acc = Math.min(acc, -6);
    if (this.noise > 0) acc += this.noise * this.rng.gaussian();
    u.acc = acc;
  }

  private tryLaneChange(u: Vehicle, link: NetLink): boolean {
    if (u.s < 2 || this.t - u.lastLc < 3 || u.dwellUntil >= 0) return false;
    const d = link.length - u.s;
    if (d < 1.5) return false;
    const nl = this.nextLinkOf(u);
    const next = nl >= 0 ? this.net.links[nl] : null;
    const lanes = this.laneVeh[link.index];
    const mandatoryDrop = next !== null && u.lane >= next.lanes;
    const inBusLane = link.busLane && u.type !== VehicleType.Bus && u.lane === link.lanes - 1;
    let bestLane = -1;
    let bestInc = -Infinity;
    for (const dir of [-1, 1]) {
      const k = u.lane + dir;
      if (k < 0 || k >= link.lanes) continue;
      if (!this.laneAllowed(link, k, u.type)) continue;
      if (next && k >= next.lanes && !(u.lane >= next.lanes && k < u.lane)) {
        if (d < 150) continue;
      }
      let bias = 0;
      if (mandatoryDrop) bias = dir < 0 ? (this.earlyMerge > 0 ? 6 : 2 + Math.max(0, 1 - d / 150) * 4) : -9;
      if (inBusLane && dir < 0) bias = 6;
      if (u.type === VehicleType.Bus && link.busLane) bias += dir > 0 ? 3 : -3;
      if (u.line >= 0 && !link.busLane && d < 120 && u.stopsLeft[0] === link.to) bias += dir > 0 ? 2 : -2;
      // pemimpin & pengikut di lajur target
      const arr = lanes[k];
      let lead: Vehicle | null = null;
      let fol: Vehicle | null = null;
      for (let i = 0; i < arr.length; i++) {
        const w = this.vehicles[arr[i]]!;
        if (w.s > u.s) lead = w;
        else {
          fol = w;
          break;
        }
      }
      const gapLead = lead ? lead.s - lead.p.length - u.s : Infinity;
      const gapFol = fol ? u.s - u.p.length - fol.s : Infinity;
      if (gapLead < 0.5 || gapFol < 0.5) continue;
      let accNew = idmAccel(u.idm, u.v, gapLead, lead ? lead.v : 0);
      // kendala lain (garis henti, halte) tetap berlaku — kecuali penyempitan lajur yang ingin dihindari
      if (u.obstGap < Infinity && !(mandatoryDrop && dir < 0))
        accNew = Math.min(accNew, idmAccel(u.idm, u.v, u.obstGap, u.obstV));
      const folAfter = fol ? idmAccel(fol.idm, fol.v, gapFol, u.v) : 0;
      // pengikut lama
      const myArr = lanes[u.lane];
      const myIdx = myArr.indexOf(u.slot);
      const oldFol = myIdx + 1 < myArr.length ? this.vehicles[myArr[myIdx + 1]]! : null;
      const myLead = myIdx > 0 ? this.vehicles[myArr[myIdx - 1]]! : null;
      const oldFolAfter = oldFol
        ? idmAccel(
            oldFol.idm,
            oldFol.v,
            myLead ? myLead.s - myLead.p.length - oldFol.s : Infinity,
            myLead ? myLead.v : 0,
          )
        : 0;
      const res = mobilDecision({
        accSelf: u.accClean,
        accSelfNew: accNew,
        accNewFollower: fol ? fol.accClean : 0,
        accNewFollowerAfter: folAfter,
        accOldFollower: oldFol ? oldFol.accClean : 0,
        accOldFollowerAfter: oldFolAfter,
        politeness: u.p.politeness,
        threshold: u.p.laneThreshold,
        bias,
        bSafe: mandatoryDrop && this.earlyMerge === 0 ? B_SAFE + 1 : B_SAFE,
      });
      if (res.change && res.incentive + bias > bestInc) {
        bestInc = res.incentive + bias;
        bestLane = k;
      }
    }
    if (bestLane < 0) return false;
    removeFrom(lanes[u.lane], u.slot);
    u.lane = bestLane;
    u.lastLc = this.t;
    this.insertSorted(lanes[bestLane], u);
    return true;
  }

  /** @returns 0 tetap di link, 1 pindah link, 2 selesai/dihapus */
  private move(u: Vehicle, link: NetLink): number {
    const [ds, v] = ballisticStep(u.v, u.acc, this.dt);
    if (u.v > 2 && v < 0.5) u.stops++;
    u.v = v;
    u.s += ds;
    u.dist += ds;
    this.emissions += (ds / 1000) * u.p.emissionPerKm + (v < 0.3 ? u.p.emissionIdle * this.dt : 0);
    // geser lateral menuju lajur sasaran (kosmetik)
    if (u.s >= 0) {
      const target = link.laneOffsets[u.lane];
      const dl = target - u.lat;
      const maxStep = 1.6 * this.dt;
      u.lat += Math.abs(dl) < maxStep ? dl : Math.sign(dl) * maxStep;
    }
    if (u.insideNode >= 0 && u.s >= 0) {
      removeFrom(this.inside[u.insideNode], u.slot);
      u.insideNode = -1;
      u.cKind = 0;
    }
    const nl = this.nextLinkOf(u);
    if (nl < 0) {
      if (u.s >= link.length - 1) {
        this.finishTrip(u, link);
        return 2;
      }
      return 0;
    }
    if (u.s < link.length) return 0;
    if (!u.canCross) {
      u.s = link.length - 0.05;
      u.v = 0;
      return 0;
    }
    // pindah ke link berikutnya lewat konektor simpang
    const next = this.net.links[nl];
    const node = this.net.nodes[link.to];
    const mi = this.movementOf(link, next);
    const mv = mi >= 0 ? node.movements[mi] : null;
    const tl = mv ? this.targetLane(u, link, next, mv) : Math.min(u.lane, next.lanes - 1);
    const over = u.s - link.length;
    this.exitCount[link.index]++;
    this.fdExit[link.index]++;
    const tt = this.t - u.linkEnter;
    this.ema[link.index] = this.ema[link.index] * 0.8 + Math.max(link.freeTime, tt) * 0.2;
    this.buildConnector(u, link, next, node, tl);
    u.cNode = node.index;
    u.cMov = mi;
    u.link = nl;
    u.lane = tl;
    u.s = over - u.cLen;
    u.ri = u.ri + 1 < u.route.length ? u.ri + 1 : 0;
    u.committed = false;
    u.arrival = Infinity;
    u.linkEnter = this.t;
    if (node.control !== 'none' && u.s < 0) {
      this.inside[node.index].push(u.slot);
      u.insideNode = node.index;
    }
    if (this.rerouting && !u.loop && u.line < 0 && this.t - u.lastPlan > 20) this.maybeReroute(u);
    return 1;
  }

  private buildConnector(u: Vehicle, link: NetLink, next: NetLink, node: NetNode, tl: number): void {
    const p0x = link.x1 + link.nx * u.lat;
    const p0y = link.y1 + link.ny * u.lat;
    const off = next.laneOffsets[tl];
    const p1x = next.x0 + next.nx * off;
    const p1y = next.y0 + next.ny * off;
    const chord = Math.hypot(p1x - p0x, p1y - p0y);
    u.lat = off;
    if (node.control === 'roundabout') {
      const a0 = Math.atan2(p0y - node.y, p0x - node.x);
      const a1 = Math.atan2(p1y - node.y, p1x - node.x);
      let span = norm2pi(a0 - a1);
      if (span < 0.35) span += Math.PI * 2;
      u.cKind = 2;
      u.cP[0] = node.x;
      u.cP[1] = node.y;
      u.cP[2] = a0;
      u.cP[3] = span;
      u.cP[4] = Math.hypot(p0x - node.x, p0y - node.y);
      u.cP[5] = Math.hypot(p1x - node.x, p1y - node.y);
      u.cP[6] = node.ringRadius;
      u.cLen =
        span * node.ringRadius + Math.abs(u.cP[4] - node.ringRadius) + Math.abs(u.cP[5] - node.ringRadius);
      return;
    }
    if (chord < 0.3) {
      u.cKind = 0;
      u.cLen = chord;
      return;
    }
    const k = chord * 0.45;
    u.cKind = 1;
    u.cP[0] = p0x;
    u.cP[1] = p0y;
    u.cP[2] = p0x + link.dx * k;
    u.cP[3] = p0y + link.dy * k;
    u.cP[4] = p1x - next.dx * k;
    u.cP[5] = p1y - next.dy * k;
    u.cP[6] = p1x;
    u.cP[7] = p1y;
    // panjang busur kurva Bezier (sampel 8 segmen)
    let len = 0;
    let px = p0x;
    let py = p0y;
    for (let i = 1; i <= 8; i++) {
      const [x, y] = bezier(u.cP, i / 8);
      len += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
    u.cLen = len;
  }

  private maybeReroute(u: Vehicle): void {
    u.lastPlan = this.t;
    const r = this.router.route(this.net.links[u.link].to, u.dest, this.costFn, { firstLink: u.link });
    if (!r) return;
    const rest = u.route.slice(u.ri);
    let oldCost = 0;
    for (const li of rest.slice(1)) oldCost += this.linkCost[li];
    const newCost = r.cost;
    // ganti rute hanya bila jelas lebih cepat (histeresis 10%)
    if (newCost < oldCost * 0.9 - 5) {
      const changed = r.links.length !== rest.length || r.links.some((l, i) => l !== rest[i]);
      if (changed) {
        u.route = u.route.slice(0, u.ri).concat(r.links);
        u.reroutes++;
      }
    }
  }

  private finishTrip(u: Vehicle, link: NetLink): void {
    this.exitCount[link.index]++;
    const tt = this.t - u.depart;
    if (u.line < 0) {
      this.tripsDone++;
      this.stopsDone += u.stops;
      this.ttWindow.push({ t: this.t, tt, delay: Math.max(0, tt - u.freeTime) });
    }
    this.release(u);
  }

  private refreshCosts(): void {
    for (const l of this.net.links) {
      let n = 0;
      let sv = 0;
      for (const arr of this.laneVeh[l.index])
        for (const slot of arr) {
          const u = this.vehicles[slot]!;
          if (u.s < 0) continue;
          n++;
          sv += u.v;
        }
      const base = this.baseFree(l);
      let cost = this.ema[l.index];
      if (n > 0) {
        const inst = l.length / Math.max(0.5, sv / n);
        cost = Math.max(cost, 0.5 * cost + 0.5 * inst);
      } else {
        this.ema[l.index] += (base - this.ema[l.index]) * 0.1;
        cost = this.ema[l.index];
      }
      this.linkCost[l.index] = Math.max(base, cost);
    }
  }

  private sample(): void {
    const s = this.liveStats();
    this.samples.push({
      t: this.t,
      active: s.active,
      meanSpeed: s.meanSpeed,
      stopped: s.stopped,
      meanTravelTime: s.meanTravelTime,
      throughput: s.throughput,
      emissions: s.emissionsTotal,
    });
    if (this.samples.length > 3000) this.samples.shift();
  }

  private sampleFd(): void {
    const span = this.t - this.fdLast;
    this.fdLast = this.t;
    for (const l of this.net.links) {
      if (l.length < 40) continue;
      let n = 0;
      for (const arr of this.laneVeh[l.index]) for (const slot of arr) if (this.vehicles[slot]!.s >= 0) n++;
      const k = (n / (l.length * l.lanes)) * 1000;
      const q = (this.fdExit[l.index] / span / l.lanes) * 3600;
      this.fdExit[l.index] = 0;
      if (n === 0 && q === 0) continue;
      this.fdSamples.push({ k, q });
    }
    if (this.fdSamples.length > 1500) this.fdSamples.splice(0, this.fdSamples.length - 1500);
  }

  // ───────────────────────────── keluaran ─────────────────────────────

  liveStats(): LiveStats {
    let n = 0;
    let sv = 0;
    let sv2 = 0;
    let stopped = 0;
    for (const u of this.vehicles) {
      if (!u) continue;
      n++;
      sv += u.v;
      sv2 += u.v * u.v;
      if (u.v < 0.5) stopped++;
    }
    const win = 600;
    while (this.ttWindow.length && this.ttWindow[0].t < this.t - win) this.ttWindow.shift();
    const tw = this.ttWindow;
    const meanTT = tw.length ? tw.reduce((s, e) => s + e.tt, 0) / tw.length : 0;
    const meanDelay = tw.length ? tw.reduce((s, e) => s + e.delay, 0) / tw.length : 0;
    const span = Math.min(win, Math.max(this.t, 1));
    const mean = n ? sv / n : 0;
    const totalTrips = this.modeCounts.reduce((a, b) => a + b, 0);
    return {
      t: this.t,
      hour: this.hour,
      active: n,
      meanSpeed: mean,
      stopped,
      tripsDone: this.tripsDone,
      tripsStarted: this.tripsStarted,
      meanTravelTime: meanTT,
      meanDelay,
      throughput: (tw.length / span) * 3600,
      stopsPerVehicle: this.tripsDone ? this.stopsDone / this.tripsDone : 0,
      speedStd: n ? Math.sqrt(Math.max(0, sv2 / n - mean * mean)) : 0,
      emissionsTotal: this.emissions,
      emissionsPerTrip: totalTrips ? this.emissions / totalTrips : 0,
      modeCounts: [...this.modeCounts],
      lineRiders: [...this.busLines.map((l) => l.riders), ...this.mrtLines.map((l) => l.riders)],
      dropped: this.dropped,
    };
  }

  /** Kepadatan per link (kend/km/lajur). */
  linkDensities(): Float32Array {
    const out = new Float32Array(this.net.links.length);
    for (const l of this.net.links) {
      let n = 0;
      for (const arr of this.laneVeh[l.index]) for (const slot of arr) if (this.vehicles[slot]!.s >= 0) n++;
      out[l.index] = (n / Math.max(1, l.length * l.lanes)) * 1000;
    }
    return out;
  }

  /** Keadaan lampu per pendekat bersinyal: Uint8 per link (0 merah, 1 kuning, 2 hijau, 255 tidak bersinyal). */
  signalStates(): Uint8Array {
    const out = new Uint8Array(this.net.links.length).fill(255);
    for (const l of this.net.links) {
      const node = this.net.nodes[l.to];
      if (node.control !== 'signal') continue;
      out[l.index] = stateForPhase(this.phaseInfo[node.index], l.phase);
    }
    return out;
  }

  /** Perbarui posisi dunia (x, y, heading) tiap kendaraan. */
  updatePoses(): void {
    for (const u of this.vehicles) {
      if (!u) continue;
      const link = this.net.links[u.link];
      if (u.s >= 0 || u.cKind === 0) {
        const s = Math.max(0, u.s);
        u.x = link.x0 + link.dx * s + link.nx * u.lat;
        u.y = link.y0 + link.dy * s + link.ny * u.lat;
        const lc = link.laneOffsets[u.lane] - u.lat;
        u.heading = Math.atan2(link.dy, link.dx) + Math.max(-0.25, Math.min(0.25, lc * 0.12));
      } else if (u.cKind === 1) {
        const t = Math.min(1, Math.max(0, (u.s + u.cLen) / u.cLen));
        const [x, y] = bezier(u.cP, t);
        const [x2, y2] = bezier(u.cP, Math.min(1, t + 0.02));
        const [x0, y0] = t >= 0.98 ? bezier(u.cP, t - 0.02) : [x, y];
        u.x = x;
        u.y = y;
        u.heading = t >= 0.98 ? Math.atan2(y - y0, x - x0) : Math.atan2(y2 - y, x2 - x);
      } else {
        const t = Math.min(1, Math.max(0, (u.s + u.cLen) / u.cLen));
        const ang = u.cP[2] - u.cP[3] * t;
        const blendIn = Math.max(0, 1 - t * 5);
        const blendOut = Math.max(0, t * 5 - 4);
        const r = u.cP[6] + (u.cP[4] - u.cP[6]) * blendIn + (u.cP[5] - u.cP[6]) * blendOut;
        u.x = u.cP[0] + Math.cos(ang) * r;
        u.y = u.cP[1] + Math.sin(ang) * r;
        u.heading = ang - Math.PI / 2;
      }
    }
  }

  /** Larik frame: per slot [id, type, x, y, heading, flags]; type −1 = kosong. */
  writeFrame(): Float32Array {
    this.updatePoses();
    const n = this.vehicles.length;
    const buf = new Float32Array(n * FRAME_STRIDE);
    for (let i = 0; i < n; i++) {
      const u = this.vehicles[i];
      const o = i * FRAME_STRIDE;
      if (!u) {
        buf[o + 1] = -1;
        continue;
      }
      buf[o] = u.id;
      buf[o + 1] = u.type;
      buf[o + 2] = u.x;
      buf[o + 3] = u.y;
      buf[o + 4] = u.heading;
      // flags: kecepatan relatif (0..1) + 2 bila mengerem
      buf[o + 5] = Math.min(1, u.v / 20) + (u.acc < -1.5 ? 2 : 0);
    }
    return buf;
  }

  findVehicle(id: number): Vehicle | null {
    for (const u of this.vehicles) if (u && u.id === id) return u;
    return null;
  }

  selectedInfo(id: number): SelectedInfo | null {
    const u = this.findVehicle(id);
    if (!u) return null;
    let distLeft = this.net.links[u.link].length - u.s;
    let eta = distLeft / Math.max(1, u.v);
    for (let k = u.ri + 1; k < u.route.length; k++) {
      distLeft += this.net.links[u.route[k]].length;
      eta += this.linkCost[u.route[k]];
    }
    return {
      id: u.id,
      type: u.type,
      origin: this.net.nodes[u.origin]?.id ?? -1,
      destination: this.net.nodes[u.dest]?.id ?? -1,
      route: u.route,
      routeIndex: u.ri,
      elapsed: this.t - u.depart,
      eta: u.loop ? 0 : eta,
      distanceLeft: u.loop ? 0 : distLeft,
      reroutes: u.reroutes,
      speed: u.v,
    };
  }

  /** Rem mendadak: kendaraan id (atau yang terdepan di koridor) mengerem ~4 detik. */
  brake(id?: number): number {
    let u: Vehicle | null = id !== undefined ? this.findVehicle(id) : null;
    if (!u) {
      for (const li of this.corridorLinks) {
        for (const arr of this.laneVeh[li])
          if (arr.length) u = this.vehicles[arr[Math.floor(arr.length / 2)]]!;
        if (u) break;
      }
    }
    if (!u) return -1;
    u.brakeUntil = this.t + 4;
    return u.id;
  }

  setSignal(nodeId: number, greens: number[], offset: number): void {
    const ni = this.net.nodeIndexById.get(nodeId);
    if (ni === undefined) return;
    const n = this.net.nodes[ni];
    if (n.control !== 'signal') return;
    n.greens = n.phases.map((_, k) => greens[k] ?? n.greens[k]);
    n.offset = offset;
    n.cycle = n.greens.reduce((s, g) => s + g + 5, 0);
  }

  /** Hash keadaan (untuk test determinisme). */
  stateHash(): number {
    let h = 2166136261;
    const mix = (x: number) => {
      h ^= Math.round(x * 1000) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    };
    for (const u of this.vehicles) {
      if (!u) continue;
      mix(u.id);
      mix(u.link);
      mix(u.lane);
      mix(u.s);
      mix(u.v);
    }
    mix(this.tripsDone);
    return h >>> 0;
  }
}

export const FRAME_STRIDE = 6;

function removeFrom(arr: number[], v: number): void {
  const i = arr.indexOf(v);
  if (i >= 0) arr.splice(i, 1);
}

function norm2pi(a: number): number {
  const T = Math.PI * 2;
  return ((a % T) + T) % T;
}

export function bezier(p: Float64Array, t: number): [number, number] {
  const m = 1 - t;
  const a = m * m * m;
  const b = 3 * m * m * t;
  const c = 3 * m * t * t;
  const d = t * t * t;
  return [a * p[0] + b * p[2] + c * p[4] + d * p[6], a * p[1] + b * p[3] + c * p[5] + d * p[7]];
}

function nearestIndex(
  pts: readonly (readonly [number, number])[],
  x: number,
  y: number,
): { i: number; d: number } {
  let best = 0;
  let bd = Infinity;
  pts.forEach(([px, py], i) => {
    const d = Math.hypot(px - x, py - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return { i: best, d: bd };
}

export function pointAlong(pts: [number, number][], cum: number[], d: number): [number, number, number] {
  const L = cum[cum.length - 1];
  const dd = Math.max(0, Math.min(L, d));
  let k = 1;
  while (k < cum.length - 1 && cum[k] < dd) k++;
  const seg = cum[k] - cum[k - 1] || 1;
  const t = (dd - cum[k - 1]) / seg;
  const [ax, ay] = pts[k - 1];
  const [bx, by] = pts[k];
  return [ax + (bx - ax) * t, ay + (by - ay) * t, Math.atan2(by - ay, bx - ax)];
}
