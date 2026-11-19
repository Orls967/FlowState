import { Color } from 'three';
import { scaleLinear } from 'd3-scale';
import { interpolateLab } from 'd3-interpolate';
import type { Theme } from '../store/settings';

/** Preset visual scene 3D per tema: Terang = peta kertas/cetak biru, Gelap = kota malam. */
export interface ScenePreset {
  background: string;
  fog: string;
  ground: string;
  grid: string;
  road: string;
  roadEdge: string;
  marking: string;
  crosswalk: string;
  intersection: string;
  park: string;
  tree: string;
  buildings: string[];
  roof: string;
  windowGlow: string;
  vehicle: string[];
  bus: string;
  truck: string;
  ped: string;
  rail: string;
  train: string;
  streetLight: string;
  route: string;
  /** malam minimum (0..1) — tema gelap selalu bernuansa malam */
  nightFloor: number;
  /** malam maksimum */
  nightCeil: number;
  /** skala heatmap [lengang, sedang, padat] — kecerahan monoton agar ramah buta warna */
  density: [string, string, string];
  ambient: number;
  sun: number;
}

export const PRESETS: Record<Theme, ScenePreset> = {
  light: {
    background: '#efe9da',
    fog: '#efe9da',
    ground: '#e9e2cf',
    grid: '#d8cfb8',
    road: '#fdfbf6',
    roadEdge: '#a89a78',
    marking: '#c9bb94',
    crosswalk: '#ffffff',
    intersection: '#f6f2e7',
    park: '#cfdab0',
    tree: '#93ad6f',
    buildings: ['#e4ddcb', '#d9d3c4', '#cfcab9', '#e8d9c0', '#d6dbd6'],
    roof: '#f4efe3',
    windowGlow: '#ffcf7a',
    vehicle: ['#c8431a', '#1f5fbf', '#2b2f36', '#6b7480', '#d8a31a', '#3e7d5a', '#f2f0ea', '#8a3c8f'],
    bus: '#c8431a',
    truck: '#5a6470',
    ped: '#1b1f24',
    rail: '#8f8670',
    train: '#1f5fbf',
    streetLight: '#d8cfb8',
    route: '#c8431a',
    nightFloor: 0,
    nightCeil: 0.55,
    density: ['#a8dc8c', '#f5b03d', '#c0281f'],
    ambient: 1.25,
    sun: 1.6,
  },
  dark: {
    background: '#06090e',
    fog: '#06090e',
    ground: '#0b1017',
    grid: '#131a24',
    road: '#212b37',
    roadEdge: '#2d3846',
    marking: '#5d6a7c',
    crosswalk: '#6b7686',
    intersection: '#25303d',
    park: '#0f1d16',
    tree: '#1b3325',
    buildings: ['#171e28', '#1b2330', '#141b24', '#1e2633', '#192029'],
    roof: '#222b38',
    windowGlow: '#ffc56b',
    vehicle: ['#ff7a45', '#7fb2ff', '#c9ced6', '#5d6775', '#ffd23f', '#5fbf8d', '#e9e6dd', '#c08bd0'],
    bus: '#ff7a45',
    truck: '#8893a3',
    ped: '#e9e6dd',
    rail: '#3a4454',
    train: '#7fb2ff',
    streetLight: '#ffb35c',
    route: '#ff7a45',
    nightFloor: 0.75,
    nightCeil: 1,
    density: ['#2e6a4f', '#c9902b', '#ff8a7a'],
    ambient: 0.55,
    sun: 0.9,
  },
};

/** Skala warna kepadatan (kend/km/lajur) → warna. */
export function densityScale(theme: Theme): (k: number) => Color {
  const [a, b, c] = PRESETS[theme].density;
  const s = scaleLinear<string>()
    .domain([0, 35, 90])
    .range([a, b, c])
    .interpolate(interpolateLab)
    .clamp(true);
  const cache = new Map<number, Color>();
  return (k: number) => {
    const key = Math.round(Math.min(90, Math.max(0, k)));
    let col = cache.get(key);
    if (!col) {
      col = new Color(s(key));
      cache.set(key, col);
    }
    return col;
  };
}

/** Faktor malam (0 siang .. 1 malam) dari jam simulasi. */
export function nightFactor(hour: number): number {
  // fajar 05.30–06.30, senja 17.45–18.45
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6.5 && h <= 17.75) return 0;
  if (h > 18.75 || h < 5.5) return 1;
  if (h < 6.5) return 1 - (h - 5.5);
  return h - 17.75;
}

export function sunDirection(hour: number): [number, number, number] {
  const h = ((hour % 24) + 24) % 24;
  const a = ((h - 6) / 12) * Math.PI; // 0 di timur saat 06.00, π di barat 18.00
  const elev = Math.max(0.15, Math.sin(a));
  return [Math.cos(a) * 300, elev * 400 + 60, -150];
}
