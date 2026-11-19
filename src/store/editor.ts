import { create } from 'zustand';
import type { CityDoc } from '../lib/city/schema';
import { gridCity } from '../lib/city/builders';

const MAX_HISTORY = 100;

interface EditorState {
  doc: CityDoc;
  past: CityDoc[];
  future: CityDoc[];
  /** naik tiap perubahan — dipakai untuk memicu simulasi ulang */
  version: number;
  load: (doc: CityDoc) => void;
  /** terapkan perubahan sebagai satu langkah yang bisa di-undo */
  apply: (next: CityDoc) => void;
  undo: () => void;
  redo: () => void;
}

function blank(): CityDoc {
  const doc = gridCity(4, 4, 160, { lanes: 1, speed: 40 });
  doc.name = 'Kota baru';
  doc.seed = 1;
  doc.nodes.forEach(
    (n, i) => (n.zone = i % 5 === 0 ? 'office' : i % 7 === 0 ? 'mall' : i % 4 === 1 ? 'school' : 'home'),
  );
  return doc;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  doc: blank(),
  past: [],
  future: [],
  version: 0,
  load: (doc) => set({ doc: structuredClone(doc), past: [], future: [], version: get().version + 1 }),
  apply: (next) => {
    const { doc, past, version } = get();
    set({ doc: next, past: [...past, doc].slice(-MAX_HISTORY), future: [], version: version + 1 });
  },
  undo: () => {
    const { doc, past, future, version } = get();
    if (!past.length) return;
    set({
      doc: past[past.length - 1],
      past: past.slice(0, -1),
      future: [doc, ...future],
      version: version + 1,
    });
  },
  redo: () => {
    const { doc, past, future, version } = get();
    if (!future.length) return;
    set({ doc: future[0], past: [...past, doc], future: future.slice(1), version: version + 1 });
  },
}));

export { blank as blankCity };
