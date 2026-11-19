import type { FromWorker, ToWorker } from '../lib/sim/protocol';

export type Listener = (msg: FromWorker) => void;

export interface SimHost {
  readonly mode: 'worker' | 'main';
  post(msg: ToWorker): void;
  subscribe(fn: Listener): () => void;
  terminate(): void;
}

class WorkerHost implements SimHost {
  readonly mode = 'worker' as const;
  private listeners = new Set<Listener>();
  constructor(private worker: Worker) {
    worker.onmessage = (e: MessageEvent<FromWorker>) => this.listeners.forEach((l) => l(e.data));
    worker.onerror = (e) =>
      this.listeners.forEach((l) => l({ type: 'error', message: e.message || 'worker error' }));
  }
  post(msg: ToWorker): void {
    this.worker.postMessage(msg);
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  terminate(): void {
    this.worker.terminate();
    this.listeners.clear();
  }
}

/** Cadangan bila Web Worker tidak tersedia: runtime yang sama, di thread utama (dimuat malas). */
class MainThreadHost implements SimHost {
  readonly mode = 'main' as const;
  private listeners = new Set<Listener>();
  private queue: ToWorker[] = [];
  private runtime: { handle(m: ToWorker): void } | null = null;
  private dead = false;
  constructor() {
    void import('./runtime').then(({ SimRuntime }) => {
      if (this.dead) return;
      this.runtime = new SimRuntime((msg) => this.listeners.forEach((l) => l(msg)));
      for (const m of this.queue) this.runtime.handle(m);
      this.queue = [];
    });
  }
  post(msg: ToWorker): void {
    // salin agar semantik sama dengan postMessage (structured clone)
    const copy = structuredClone(msg);
    if (this.runtime) this.runtime.handle(copy);
    else this.queue.push(copy);
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  terminate(): void {
    this.dead = true;
    this.runtime?.handle({ type: 'dispose' });
    this.listeners.clear();
  }
}

export function createSimHost(): SimHost {
  try {
    if (typeof Worker === 'undefined') throw new Error('no worker');
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), {
      type: 'module',
      name: 'flowstate-sim',
    });
    return new WorkerHost(w);
  } catch {
    return new MainThreadHost();
  }
}
