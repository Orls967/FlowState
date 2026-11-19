import { describe, expect, it } from 'vitest';
import { id } from '../../src/i18n/locales/id';
import { en } from '../../src/i18n/locales/en';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

function values(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  if (typeof obj !== 'object' || obj === null) return [];
  return Object.values(obj as Record<string, unknown>).flatMap(values);
}

describe('i18n UI', () => {
  it('kunci ID dan EN identik', () => {
    expect(keys(en).sort()).toEqual(keys(id).sort());
  });
  it('tidak ada teks kosong', () => {
    for (const v of [...values(id), ...values(en)]) expect(v.trim().length).toBeGreaterThan(0);
  });
  it('placeholder interpolasi sama di kedua bahasa', () => {
    const ki = keys(id);
    const get = (o: unknown, path: string) =>
      path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], o) as string;
    for (const k of ki) {
      const a = (get(id, k).match(/{{\w+}}/g) ?? []).sort();
      const b = (get(en, k).match(/{{\w+}}/g) ?? []).sort();
      expect(b, k).toEqual(a);
    }
  });
});
