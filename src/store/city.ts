import { create } from 'zustand';
import type { CityDoc } from '../lib/city/schema';
import { generateCity, type CitySize } from '../lib/city/generator';

interface CityState {
  seed: number;
  size: CitySize;
  live: CityDoc;
  setLive: (seed: number, size?: CitySize) => void;
}

export const useCityStore = create<CityState>((set, get) => ({
  seed: 2026,
  size: 'medium',
  live: generateCity(2026, 'medium'),
  setLive: (seed, size) => {
    const sz = size ?? get().size;
    set({ seed, size: sz, live: generateCity(seed, sz) });
  },
}));
