import { create } from 'zustand';
import type { CityDoc } from '../lib/city/schema';
import { applyDedicatedLanes } from '../lib/city/transit';
import { generateCity, type CitySize } from '../lib/city/generator';

interface CityState {
  seed: number;
  size: CitySize;
  live: CityDoc;
  setLive: (seed: number, size?: CitySize) => void;
  /** perbarui jalur angkutan umum kota hidup (lajur BRT ikut ditandai) */
  setTransit: (transit: CityDoc['transit']) => void;
}

export const useCityStore = create<CityState>((set, get) => ({
  seed: 2026,
  size: 'medium',
  live: generateCity(2026, 'medium'),
  setLive: (seed, size) => {
    const sz = size ?? get().size;
    set({ seed, size: sz, live: generateCity(seed, sz) });
  },
  setTransit: (transit) => {
    const base = generateCity(get().seed, get().size);
    set({ live: applyDedicatedLanes({ ...base, transit }) });
  },
}));
