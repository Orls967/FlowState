import { Simulation, type SimConfig } from '../lib/sim/engine';
import type { FromWorker, ToWorker } from '../lib/sim/protocol';

type Post = (msg: FromWorker, transfer?: Transferable[]) => void;

const FRAME_MS = 33;
const STATS_MS = 250;
const MAX_STEPS_PER_TICK = 60;

/**
 * Runtime simulasi: loop fixed-timestep yang mengirim frame posisi (typed array, di-transfer).
 * Dipakai di Web Worker; juga bisa jalan di thread utama sebagai cadangan.
 */
export class SimRuntime {
  private sim: Simulation | null = null;
  private speed = 1;
  private paused = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = 0;
  private acc = 0;
  private lastStats = 0;
  private selected: number | null = null;
  private sampleCursor = 0;
  private fdCursor = 0;
  private stepMs = 0;
  private headlessToken = 0;

  constructor(private post: Post) {}

  handle(msg: ToWorker): void {
    try {
      switch (msg.type) {
        case 'init':
          this.headlessToken++;
          this.sim = new Simulation(msg.config);
          this.speed = msg.speed;
          this.paused = msg.paused;
          this.sampleCursor = 0;
          this.fdCursor = 0;
          this.selected = null;
          this.post({ type: 'ready', links: this.sim.net.links.length, nodes: this.sim.net.nodes.length });
          this.emitFrame(0);
          this.emitStats();
          this.start();
          break;
        case 'speed':
          this.speed = msg.speed;
          break;
        case 'pause':
          this.paused = msg.paused;
          break;
        case 'select':
          this.selected = msg.id;
          this.emitStats();
          break;
        case 'brake':
          this.sim?.brake(msg.id);
          break;
        case 'signal':
          this.sim?.setSignal(msg.nodeId, msg.greens, msg.offset);
          break;
        case 'params': {
          const s = this.sim;
          if (!s) break;
          const p = msg.patch;
          if (p.peakPerHour !== undefined) s.peakPerHour = p.peakPerHour;
          if (p.maxVehicles !== undefined) s.maxVehicles = p.maxVehicles;
          if (p.noise !== undefined) s.noise = p.noise;
          if (p.earlyMergeDistance !== undefined) s.earlyMerge = p.earlyMergeDistance;
          if (p.pedRate !== undefined) s.pedRate = p.pedRate;
          if (p.rerouting !== undefined) s.rerouting = p.rerouting;
          break;
        }
        case 'headless':
          this.stop();
          void this.runHeadless(msg.config, msg.duration);
          break;
        case 'dispose':
          this.stop();
          this.sim = null;
          break;
      }
    } catch (e) {
      this.post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  private start(): void {
    this.stop();
    this.last = performance.now();
    this.acc = 0;
    const tick = () => {
      this.timer = setTimeout(tick, FRAME_MS);
      this.tick();
    };
    this.timer = setTimeout(tick, FRAME_MS);
  }

  private stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const sim = this.sim;
    if (!sim) return;
    const now = performance.now();
    const real = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (this.paused) {
      if (now - this.lastStats > STATS_MS * 4) this.emitStats();
      return;
    }
    this.acc += real * this.speed;
    let steps = Math.floor(this.acc / sim.dt);
    if (steps > MAX_STEPS_PER_TICK) {
      steps = MAX_STEPS_PER_TICK;
      this.acc = 0;
    } else this.acc -= steps * sim.dt;
    if (steps === 0) return;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) sim.step();
    const ms = (performance.now() - t0) / steps;
    this.stepMs = this.stepMs * 0.9 + ms * 0.1;
    this.emitFrame(steps * sim.dt);
    if (now - this.lastStats > STATS_MS) this.emitStats();
  }

  private emitFrame(simDt: number): void {
    const sim = this.sim!;
    const buf = sim.writeFrame();
    const pedArr: number[] = [];
    sim.pedPositions(pedArr);
    const trainArr: number[] = [];
    sim.trainPositions(trainArr);
    const peds = new Float32Array(pedArr);
    const trains = new Float32Array(trainArr);
    this.post({ type: 'frame', t: sim.t, buf, peds, trains, simDt }, [
      buf.buffer,
      peds.buffer,
      trains.buffer,
    ]);
  }

  private emitStats(): void {
    const sim = this.sim;
    if (!sim) return;
    this.lastStats = performance.now();
    const densities = sim.linkDensities();
    const signals = sim.signalStates();
    const corridor = sim.corridorLength > 0 ? sim.corridorSnapshot() : null;
    const samples = sim.samples.slice(this.sampleCursor);
    this.sampleCursor = sim.samples.length;
    const fd = sim.fdSamples.slice(this.fdCursor);
    this.fdCursor = sim.fdSamples.length;
    const transfer: Transferable[] = [densities.buffer, signals.buffer];
    if (corridor) transfer.push(corridor.buffer);
    this.post(
      {
        type: 'stats',
        stats: sim.liveStats(),
        densities,
        signals,
        selected: this.selected !== null ? sim.selectedInfo(this.selected) : null,
        corridor,
        corridorLength: sim.corridorLength,
        samples,
        fd,
        stepMs: this.stepMs,
      },
      transfer,
    );
  }

  /** Jalankan secepat mungkin (Analitik), berbagi waktu dengan event loop. */
  private async runHeadless(config: SimConfig, duration: number): Promise<void> {
    const token = ++this.headlessToken;
    const sim = new Simulation(config);
    const total = Math.ceil(duration / sim.dt);
    const chunk = 400;
    let lastPct = -1;
    for (let i = 0; i < total; i += chunk) {
      if (token !== this.headlessToken) return;
      const n = Math.min(chunk, total - i);
      for (let k = 0; k < n; k++) sim.step();
      const pct = Math.floor(((i + n) / total) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        this.post({ type: 'progress', pct });
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    const densities = sim.linkDensities();
    this.post(
      { type: 'headlessDone', samples: sim.samples, fd: sim.fdSamples, stats: sim.liveStats(), densities },
      [densities.buffer],
    );
  }
}
