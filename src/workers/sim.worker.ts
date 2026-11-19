/// <reference lib="webworker" />
import { SimRuntime } from './runtime';
import type { ToWorker } from '../lib/sim/protocol';

declare const self: DedicatedWorkerGlobalScope;

const runtime = new SimRuntime((msg, transfer) => self.postMessage(msg, transfer ?? []));
self.onmessage = (e: MessageEvent<ToWorker>) => runtime.handle(e.data);
