import { CityBuilder, ringCity } from '../lib/city/builders';
import type { CityDoc } from '../lib/city/schema';
import type { SimConfig } from '../lib/sim/engine';
import { compileNetwork } from '../lib/sim/network';
import { Rng } from '../lib/sim/rng';
import type { Flow } from '../lib/sim/demand';

export type MetricKey =
  | 'meanTravelTime'
  | 'throughput'
  | 'stopped'
  | 'stopsPerVehicle'
  | 'meanDelay'
  | 'speedStd'
  | 'meanSpeed'
  | 'queueLength';

export interface ScenarioDef {
  id: string;
  variants: string[];
  defaultVariant: string;
  slider: { kind: 'vehicles' | 'demand'; min: number; max: number; step: number; value: number } | null;
  spaceTime: boolean;
  brake: boolean;
  metrics: MetricKey[];
  /** detik simulasi sebelum hasil dianggap stabil untuk dibandingkan */
  warmup: number;
  build(variant: string, level: number): SimConfig;
}

const SEED = 20260;

// ───────────── L1: macet tanpa sebab (Sugiyama) ─────────────
const sugiyama: ScenarioDef = {
  id: 'sugiyama',
  variants: ['human', 'smooth'],
  defaultVariant: 'human',
  slider: { kind: 'vehicles', min: 10, max: 30, step: 1, value: 22 },
  spaceTime: true,
  brake: true,
  metrics: ['meanSpeed', 'speedStd', 'stopped'],
  warmup: 240,
  build(variant, level) {
    const { city, nodeIds } = ringCity(230);
    const human = variant === 'human';
    return {
      city,
      seed: SEED,
      demand: { kind: 'none' },
      ring: { nodeIds, count: Math.round(level) },
      noise: human ? 0.3 : 0.05,
      idm: human ? { v0: 12, a: 0.6, b: 1.5, T: 1.5, s0: 2 } : { v0: 12, a: 2.5, b: 2, T: 1.4, s0: 2 },
      transit: false,
      rerouting: false,
    };
  },
};

// ───────────── L2: rem mendadak di jalan lurus ─────────────
function straightRoad(
  length: number,
  seg: number,
  opts: { lanes: number; speed: number },
): { city: CityDoc; ids: number[] } {
  const b = new CityBuilder();
  const ids: number[] = [];
  for (let x = 0; x <= length; x += seg) ids.push(b.node(x - length / 2, 0));
  for (let i = 1; i < ids.length; i++)
    b.road(ids[i - 1], ids[i], { oneway: true, lanes: opts.lanes, speed: opts.speed });
  return { city: b.build(), ids };
}

const phantom: ScenarioDef = {
  id: 'phantom-brake',
  variants: ['human', 'smooth'],
  defaultVariant: 'human',
  slider: { kind: 'demand', min: 600, max: 2000, step: 100, value: 1500 },
  spaceTime: true,
  brake: true,
  metrics: ['meanSpeed', 'stopped', 'meanTravelTime'],
  warmup: 180,
  build(variant, level) {
    const { city, ids } = straightRoad(2000, 250, { lanes: 1, speed: 80 });
    const human = variant === 'human';
    return {
      city,
      seed: SEED,
      demand: { kind: 'flows', flows: [{ from: ids[0], to: ids[ids.length - 1], rate: level }] },
      noise: human ? 0.15 : 0.02,
      idm: human ? { a: 1.0, b: 1.5, T: 1.4, s0: 2 } : { a: 1.8, b: 1.8, T: 1.2, s0: 2 },
      corridor: ids,
      transit: false,
      rerouting: false,
    };
  },
};

// ───────────── L3: Paradoks Braess ─────────────
export function braessCity(withShortcut: boolean): { city: CityDoc; o: number; d: number } {
  const b = new CityBuilder();
  const o = b.node(-320, 0);
  const s = b.node(0, 0);
  const a = b.node(300, 150);
  const bb = b.node(300, -150);
  const e = b.node(600, 0);
  const d = b.node(900, 0);
  b.road(o, s, { lanes: 2, speed: 50, oneway: true });
  // ruas sempit cepat (mudah jenuh) vs ruas lebar lambat (tidak mudah jenuh)
  b.road(s, a, { lanes: 1, speed: 50, oneway: true });
  b.road(a, e, { lanes: 2, speed: 20, oneway: true });
  b.road(s, bb, { lanes: 2, speed: 20, oneway: true });
  b.road(bb, e, { lanes: 1, speed: 50, oneway: true });
  if (withShortcut) b.road(a, bb, { lanes: 1, speed: 80, oneway: true });
  b.road(e, d, { lanes: 2, speed: 50, oneway: true });
  return { city: b.build('braess'), o, d };
}

const braess: ScenarioDef = {
  id: 'braess',
  variants: ['without', 'with'],
  defaultVariant: 'without',
  slider: { kind: 'demand', min: 900, max: 1900, step: 100, value: 1500 },
  spaceTime: false,
  brake: false,
  metrics: ['meanTravelTime', 'throughput', 'stopped'],
  warmup: 600,
  build(variant, level) {
    const { city, o, d } = braessCity(variant === 'with');
    return {
      city,
      seed: SEED,
      demand: { kind: 'flows', flows: [{ from: o, to: d, rate: level }] },
      transit: false,
      rerouting: true,
    };
  },
};

// ───────────── L4: zipper vs merge awal ─────────────
export function lanedropCity(): { city: CityDoc; o: number; d: number; m0: number; m: number } {
  const b = new CityBuilder();
  const o = b.node(-700, 0);
  const m0 = b.node(-350, 0);
  const m = b.node(0, 0);
  const d = b.node(500, 0);
  b.road(o, m0, { lanes: 2, speed: 50, oneway: true });
  b.road(m0, m, { lanes: 2, speed: 50, oneway: true });
  b.road(m, d, { lanes: 1, speed: 50, oneway: true });
  return { city: b.build('lane drop'), o, d, m0, m };
}

const zipper: ScenarioDef = {
  id: 'zipper',
  variants: ['early', 'zipper'],
  defaultVariant: 'early',
  slider: { kind: 'demand', min: 800, max: 2000, step: 100, value: 1400 },
  spaceTime: true,
  brake: false,
  metrics: ['queueLength', 'throughput', 'meanTravelTime'],
  warmup: 300,
  build(variant, level) {
    const { city, o, d, m0, m } = lanedropCity();
    return {
      city,
      seed: SEED,
      demand: { kind: 'flows', flows: [{ from: o, to: d, rate: level, mix: [0.8, 0, 0, 0.2] }] },
      earlyMergeDistance: variant === 'early' ? 280 : 0,
      corridor: [o, m0, m],
      transit: false,
      rerouting: false,
    };
  },
};

// ───────────── L5: gelombang hijau ─────────────
const GW_N = 6;
const GW_SPACING = 260;
const GW_SPEED = 12.5;

export function greenWaveCity(coordinated: boolean): { city: CityDoc; flows: Flow[]; corridor: number[] } {
  const b = new CityBuilder();
  const w = b.node(-200, 0);
  const sig: number[] = [];
  const flows: Flow[] = [];
  for (let i = 0; i < GW_N; i++) sig.push(b.node(i * GW_SPACING, 0, { control: 'signal' }));
  const e = b.node((GW_N - 1) * GW_SPACING + 200, 0);
  const chain = [w, ...sig, e];
  for (let i = 1; i < chain.length; i++) b.road(chain[i - 1], chain[i], { lanes: 2, speed: 50 });
  for (let i = 0; i < GW_N; i++) {
    const n = b.node(i * GW_SPACING, 160);
    const s = b.node(i * GW_SPACING, -160);
    b.road(n, sig[i], { lanes: 1, speed: 30 });
    b.road(sig[i], s, { lanes: 1, speed: 30 });
    flows.push({ from: n, to: s, rate: 90 });
  }
  flows.push({ from: w, to: e, rate: 800, mix: [0.5, 0.45, 0, 0.05] }, { from: e, to: w, rate: 250 });
  const city = b.build('green wave');
  // tentukan indeks fase arah barat→timur di tiap simpang, lalu atur hijau & offset
  const net = compileNetwork(city);
  const rng = new Rng(77);
  sig.forEach((id, i) => {
    const node = net.nodes[net.nodeIndexById.get(id)!];
    const westIdx = net.nodeIndexById.get(chain[i])!;
    const inMain = node.inLinks.find((li) => net.links[li].from === westIdx)!;
    const mainPhase = node.phases.findIndex((ph) => ph.includes(inMain));
    const greens = node.phases.map((_, k) => (k === mainPhase ? 34 : 16));
    const cycle = greens.reduce((s, g) => s + g + 5, 0);
    let startMain = 0;
    for (let k = 0; k < mainPhase; k++) startMain += greens[k] + 5;
    const offset = coordinated
      ? mod(startMain - (i * GW_SPACING) / GW_SPEED, cycle)
      : Math.floor(rng.next() * cycle);
    const cn = city.nodes.find((n) => n.id === id)!;
    cn.greens = greens;
    cn.offset = Math.round(offset * 10) / 10;
  });
  return { city, flows, corridor: chain };
}

const mod = (a: number, m: number) => ((a % m) + m) % m;

const greenwave: ScenarioDef = {
  id: 'green-wave',
  variants: ['uncoordinated', 'coordinated'],
  defaultVariant: 'uncoordinated',
  slider: null,
  spaceTime: true,
  brake: false,
  metrics: ['stopsPerVehicle', 'meanTravelTime', 'meanDelay'],
  warmup: 420,
  build(variant) {
    const { city, flows, corridor } = greenWaveCity(variant === 'coordinated');
    return { city, seed: SEED, demand: { kind: 'flows', flows }, corridor, transit: false, rerouting: false };
  },
};

// ───────────── L6: bundaran vs lampu ─────────────
export function junctionCity(control: 'signal' | 'roundabout'): { city: CityDoc; arms: number[] } {
  const b = new CityBuilder();
  const c = b.node(0, 0, { control });
  const arms = [b.node(0, 300), b.node(300, 0), b.node(0, -300), b.node(-300, 0)];
  for (const a of arms) b.road(a, c, { lanes: 1, speed: 50 });
  return { city: b.build('junction'), arms };
}

const roundabout: ScenarioDef = {
  id: 'roundabout',
  variants: ['signal', 'roundabout'],
  defaultVariant: 'signal',
  slider: { kind: 'demand', min: 400, max: 2400, step: 100, value: 1200 },
  spaceTime: false,
  brake: false,
  metrics: ['meanDelay', 'meanTravelTime', 'throughput', 'stopped'],
  warmup: 300,
  build(variant, level) {
    const { city, arms } = junctionCity(variant === 'roundabout' ? 'roundabout' : 'signal');
    const flows: Flow[] = [];
    const per = level / 4;
    arms.forEach((a, i) => {
      flows.push({ from: a, to: arms[(i + 2) % 4], rate: per * 0.6, mix: [0.45, 0.5, 0, 0.05] });
      flows.push({ from: a, to: arms[(i + 1) % 4], rate: per * 0.2, mix: [0.45, 0.5, 0, 0.05] });
      flows.push({ from: a, to: arms[(i + 3) % 4], rate: per * 0.2, mix: [0.45, 0.5, 0, 0.05] });
    });
    return { city, seed: SEED, demand: { kind: 'flows', flows }, transit: false, rerouting: false };
  },
};

export const SCENARIOS: ScenarioDef[] = [sugiyama, phantom, braess, zipper, greenwave, roundabout];
export const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));
