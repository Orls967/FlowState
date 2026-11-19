import { createContext, useContext } from 'react';
import type { ScenePreset } from './themePresets';
import type { Quality, Theme } from '../store/settings';

export interface SceneCtx {
  preset: ScenePreset;
  theme: Theme;
  quality: Quality;
  /** uniform faktor malam bersama (0 siang .. 1 malam) */
  night: { value: number };
}

export const SceneContext = createContext<SceneCtx | null>(null);

export function useSceneCtx(): SceneCtx {
  const c = useContext(SceneContext);
  if (!c) throw new Error('SceneContext missing');
  return c;
}

export const QUALITY = {
  low: { dpr: 1, maxVehicles: 600, shadows: false, bloom: false, lodDist: 220, demand: 9000 },
  medium: { dpr: 1.5, maxVehicles: 1400, shadows: false, bloom: true, lodDist: 380, demand: 16000 },
  high: { dpr: 2, maxVehicles: 2600, shadows: true, bloom: true, lodDist: 600, demand: 26000 },
} as const;
