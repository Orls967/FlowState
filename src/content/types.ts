import { z } from 'zod';

/** Teks dwibahasa wajib: kedua bahasa harus ada dan tidak kosong. */
export const Bi = z.object({ id: z.string().min(1), en: z.string().min(1) });
export type Bi = z.infer<typeof Bi>;

export type Lang = 'id' | 'en';
export const pick = (b: Bi, lang: Lang): string => b[lang];
