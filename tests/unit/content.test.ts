import { describe, expect, it } from 'vitest';
import { GLOSSARY, GlossaryTerm } from '../../src/content/glossary';
import { PHENOMENA, Phenomenon } from '../../src/content/phenomena';

function biStrings(obj: unknown, path = ''): { path: string; id?: unknown; en?: unknown }[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const o = obj as Record<string, unknown>;
  if (
    'id' in o &&
    'en' in o &&
    typeof o.id === 'string' &&
    typeof o.en === 'string' &&
    Object.keys(o).length === 2
  )
    return [{ path, id: o.id, en: o.en }];
  return Object.entries(o).flatMap(([k, v]) => biStrings(v, `${path}.${k}`));
}

describe('konten dwibahasa', () => {
  it('glosarium lolos skema & setiap teks punya ID dan EN', () => {
    for (const g of GLOSSARY) {
      expect(GlossaryTerm.safeParse(g).success).toBe(true);
      for (const b of biStrings(g)) {
        expect(String(b.id).trim().length, `${g.id}${b.path}.id`).toBeGreaterThan(0);
        expect(String(b.en).trim().length, `${g.id}${b.path}.en`).toBeGreaterThan(0);
      }
    }
  });
  it('istilah terkait merujuk istilah yang ada; id unik', () => {
    const ids = new Set(GLOSSARY.map((g) => g.id));
    expect(ids.size).toBe(GLOSSARY.length);
    for (const g of GLOSSARY) for (const r of g.related) expect(ids.has(r), `${g.id} → ${r}`).toBe(true);
  });
  it('fenomena lolos skema, kode unik, dan istilah utama ada di glosarium', () => {
    const ids = new Set(GLOSSARY.map((g) => g.id));
    const codes = new Set(PHENOMENA.map((p) => p.code));
    expect(codes.size).toBe(PHENOMENA.length);
    for (const p of PHENOMENA) {
      expect(Phenomenon.safeParse(p).success).toBe(true);
      if (p.term) expect(ids.has(p.term)).toBe(true);
      for (const b of biStrings(p)) {
        expect(String(b.id).length, `${p.id}${b.path}`).toBeGreaterThan(0);
        expect(String(b.en).length, `${p.id}${b.path}`).toBeGreaterThan(0);
      }
    }
  });
});

import { isValidElement } from 'react';
import { autoLink } from '../../src/ui/RichText';

describe('autolink glosarium', () => {
  const links = (nodes: unknown[]) => nodes.filter((n) => isValidElement(n)).length;
  it('menautkan istilah sekali per blok', () => {
    const out = autoLink('Gelombang hijau dan gelombang hijau lagi, plus bundaran.', 'id');
    expect(links(out)).toBe(2);
  });
  it('singkatan kapital tidak cocok dengan kata biasa ("mobil" ≠ MOBIL)', () => {
    expect(links(autoLink('Ada 22 mobil di jalan.', 'id'))).toBe(0);
    expect(links(autoLink('Model MOBIL dipakai.', 'id'))).toBe(1);
  });
  it('tidak menautkan di tengah kata', () => {
    expect(links(autoLink('kapasitasnya', 'id'))).toBe(0);
  });
});

import { ABOUT, AboutSection } from '../../src/content/about';

describe('halaman Tentang', () => {
  it('lolos skema dwibahasa dan menegaskan sifat edukasi', () => {
    for (const s of ABOUT) expect(AboutSection.safeParse(s).success).toBe(true);
    const what = ABOUT.find((s) => s.id === 'what')!;
    expect(what.body.id).toMatch(/BUKAN alat perencanaan resmi/);
    expect(what.body.en).toMatch(/NOT an official planning tool/);
    expect(ABOUT.some((s) => s.id === 'limits' && s.items.length >= 4)).toBe(true);
  });
});
