import type { LiveStats, SelectedInfo, SimConfig, TimeSample } from './engine';

export interface ParamPatch {
  peakPerHour?: number;
  maxVehicles?: number;
  noise?: number;
  earlyMergeDistance?: number;
  pedRate?: number;
  rerouting?: boolean;
}

export type ToWorker =
  | { type: 'init'; config: SimConfig; speed: number; paused: boolean }
  | { type: 'speed'; speed: number }
  | { type: 'pause'; paused: boolean }
  | { type: 'select'; id: number | null }
  | { type: 'brake'; id?: number }
  | { type: 'signal'; nodeId: number; greens: number[]; offset: number }
  | { type: 'params'; patch: ParamPatch }
  | { type: 'headless'; duration: number; config: SimConfig }
  | { type: 'dispose' };

export interface FdPoint {
  k: number;
  q: number;
}

export type FromWorker =
  | { type: 'ready'; links: number; nodes: number }
  | {
      type: 'frame';
      t: number;
      buf: Float32Array;
      peds: Float32Array;
      trains: Float32Array;
      /** waktu simulasi yang diwakili frame ini, untuk interpolasi */
      simDt: number;
    }
  | {
      type: 'stats';
      stats: LiveStats;
      densities: Float32Array;
      signals: Uint8Array;
      selected: SelectedInfo | null;
      corridor: Float32Array | null;
      corridorLength: number;
      samples: TimeSample[];
      fd: FdPoint[];
      stepMs: number;
    }
  | { type: 'progress'; pct: number }
  | { type: 'headlessDone'; samples: TimeSample[]; fd: FdPoint[]; stats: LiveStats; densities: Float32Array }
  | { type: 'error'; message: string };
