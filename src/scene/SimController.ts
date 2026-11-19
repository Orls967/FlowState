import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { useEffect, useState } from 'react';
import type { CityDoc } from '../lib/city/schema';
import { compileNetwork, type Network } from '../lib/sim/network';
import type { LiveStats, SelectedInfo, SimConfig, TimeSample } from '../lib/sim/engine';
import { FRAME_STRIDE } from '../lib/sim/engine';
import type { FdPoint, FromWorker, ParamPatch } from '../lib/sim/protocol';
import { createSimHost, type SimHost } from '../workers/simHost';

export interface SimUiState {
  ready: boolean;
  mode: 'worker' | 'main';
  paused: boolean;
  speed: number;
  stats: LiveStats | null;
  selected: SelectedInfo | null;
  followId: number | null;
  samples: TimeSample[];
  fd: FdPoint[];
  error: string | null;
  /** naik setiap statistik baru diterima (untuk memicu render grafik) */
  tick: number;
  stepMs: number;
}

/**
 * Jembatan antara Worker simulasi dan scene 3D. Data per frame disimpan di field biasa (bukan state React)
 * agar `useFrame` bisa membacanya tanpa render ulang; statistik dipublikasikan lewat store zustand.
 */
export class SimController {
  host: SimHost;
  readonly store: StoreApi<SimUiState>;
  net: Network | null = null;
  city: CityDoc | null = null;
  startHour = 7;
  // frame
  prev: Float32Array | null = null;
  cur: Float32Array | null = null;
  curAt = 0;
  interval = 33;
  simT = 0;
  frameSimDt = 0;
  peds: Float32Array = new Float32Array(0);
  trains: Float32Array = new Float32Array(0);
  densities: Float32Array = new Float32Array(0);
  signals: Uint8Array = new Uint8Array(0);
  corridor: Float32Array | null = null;
  corridorLength = 0;
  densityVersion = 0;
  /** posisi terinterpolasi per slot [x, y, heading] — diisi lapisan kendaraan, dipakai untuk memilih & mengikuti */
  render: Float32Array = new Float32Array(0);
  renderCount = 0;
  private unsub: () => void;
  private corridorListeners = new Set<(c: Float32Array, len: number, t: number) => void>();

  constructor() {
    this.host = createSimHost();
    this.store = createStore<SimUiState>(() => ({
      ready: false,
      mode: this.host.mode,
      paused: false,
      speed: 1,
      stats: null,
      selected: null,
      followId: null,
      samples: [],
      fd: [],
      error: null,
      tick: 0,
      stepMs: 0,
    }));
    this.unsub = this.host.subscribe((m) => this.onMessage(m));
  }

  private onMessage(m: FromWorker): void {
    switch (m.type) {
      case 'ready':
        this.store.setState({ ready: true, error: null });
        break;
      case 'frame': {
        const now = performance.now();
        if (this.cur) {
          const d = now - this.curAt;
          this.interval = Math.min(200, Math.max(10, this.interval * 0.85 + d * 0.15));
        }
        this.prev = this.cur;
        this.cur = m.buf;
        this.curAt = now;
        this.simT = m.t;
        this.frameSimDt = m.simDt;
        this.peds = m.peds;
        this.trains = m.trains;
        break;
      }
      case 'stats': {
        this.densities = m.densities;
        this.signals = m.signals;
        this.densityVersion++;
        this.corridor = m.corridor;
        this.corridorLength = m.corridorLength;
        if (m.corridor) for (const l of this.corridorListeners) l(m.corridor, m.corridorLength, m.stats.t);
        const s = this.store.getState();
        const samples = m.samples.length ? [...s.samples, ...m.samples].slice(-2000) : s.samples;
        const fd = m.fd.length ? [...s.fd, ...m.fd].slice(-1500) : s.fd;
        let followId = s.followId;
        if (followId !== null && m.selected === null && s.selected !== null) followId = null;
        this.store.setState({
          stats: m.stats,
          selected: m.selected,
          samples,
          fd,
          tick: s.tick + 1,
          stepMs: m.stepMs,
          followId,
        });
        break;
      }
      case 'error':
        this.store.setState({ error: m.message });
        break;
      default:
        break;
    }
  }

  init(config: SimConfig, opts: { speed?: number; paused?: boolean } = {}): void {
    this.city = config.city;
    this.net = compileNetwork(config.city);
    this.startHour = config.startHour ?? 7;
    this.prev = null;
    this.cur = null;
    this.render = new Float32Array(0);
    this.densities = new Float32Array(0);
    this.signals = new Uint8Array(0);
    const st = this.store.getState();
    const speed = opts.speed ?? st.speed;
    const paused = opts.paused ?? st.paused;
    this.store.setState({
      ready: false,
      stats: null,
      selected: null,
      followId: null,
      samples: [],
      fd: [],
      speed,
      paused,
    });
    this.host.post({ type: 'init', config, speed, paused });
  }

  setSpeed(speed: number): void {
    this.store.setState({ speed });
    this.host.post({ type: 'speed', speed });
  }

  setPaused(paused: boolean): void {
    this.store.setState({ paused });
    this.host.post({ type: 'pause', paused });
  }

  select(id: number | null, follow = false): void {
    this.store.setState({ followId: follow ? id : null });
    if (id === null) this.store.setState({ selected: null });
    this.host.post({ type: 'select', id });
  }

  setFollow(on: boolean): void {
    const sel = this.store.getState().selected;
    this.store.setState({ followId: on && sel ? sel.id : null });
  }

  brake(id?: number): void {
    this.host.post({ type: 'brake', id });
  }

  params(patch: ParamPatch): void {
    this.host.post({ type: 'params', patch });
  }

  setSignal(nodeId: number, greens: number[], offset: number): void {
    this.host.post({ type: 'signal', nodeId, greens, offset });
  }

  onCorridor(fn: (c: Float32Array, len: number, t: number) => void): () => void {
    this.corridorListeners.add(fn);
    return () => this.corridorListeners.delete(fn);
  }

  /** Jam simulasi terinterpolasi. */
  hour(now = performance.now()): number {
    const alpha = Math.min(1, (now - this.curAt) / this.interval);
    const t = this.simT - this.frameSimDt * (1 - alpha);
    return this.startHour + t / 3600;
  }

  /** Kendaraan terdekat dari titik dunia (x, y) dalam radius r. */
  pick(x: number, y: number, r = 9): number | null {
    let best: number | null = null;
    let bd = r;
    const cur = this.cur;
    if (!cur) return null;
    const n = Math.min(this.renderCount, cur.length / FRAME_STRIDE);
    for (let i = 0; i < n; i++) {
      if (cur[i * FRAME_STRIDE + 1] < 0) continue;
      const d = Math.hypot(this.render[i * 3] - x, this.render[i * 3 + 1] - y);
      if (d < bd) {
        bd = d;
        best = cur[i * FRAME_STRIDE];
      }
    }
    return best;
  }

  /** Posisi terinterpolasi kendaraan dengan id tertentu. */
  positionOf(id: number): [number, number, number] | null {
    const cur = this.cur;
    if (!cur) return null;
    const n = Math.min(this.renderCount, cur.length / FRAME_STRIDE);
    for (let i = 0; i < n; i++)
      if (cur[i * FRAME_STRIDE] === id && cur[i * FRAME_STRIDE + 1] >= 0)
        return [this.render[i * 3], this.render[i * 3 + 1], this.render[i * 3 + 2]];
    return null;
  }

  private disposed = false;

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsub();
    this.host.post({ type: 'dispose' });
    this.host.terminate();
  }

  /** Hidupkan lagi setelah dispose (StrictMode menjalankan efek dua kali di mode pengembangan). */
  revive(): void {
    if (!this.disposed) return;
    this.disposed = false;
    this.host = createSimHost();
    this.unsub = this.host.subscribe((m) => this.onMessage(m));
  }
}

/** Buat controller sekali per komponen & hentikan saat unmount. */
export function useSimController(): SimController {
  const [c] = useState(() => new SimController());
  useEffect(() => {
    c.revive();
    return () => c.dispose();
  }, [c]);
  return c;
}

export function useSim<T>(c: SimController, sel: (s: SimUiState) => T): T {
  return useStore(c.store, sel);
}
