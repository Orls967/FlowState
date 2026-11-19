import type { TFunction } from 'i18next';
import { MODULES } from './modules';
import type { Lang } from '../content/types';
import { PHENOMENA } from '../content/phenomena';
import { GLOSSARY } from '../content/glossary';

export interface SearchItem {
  id: string;
  group: 'modules' | 'phenomena' | 'glossary' | 'actions';
  title: string;
  subtitle?: string;
  /** Rute tujuan (HashRouter) atau aksi. */
  to?: string;
  action?: 'toggleTheme' | 'toggleLang';
  keywords: string;
}

export function buildSearchIndex(t: TFunction, lang: Lang): SearchItem[] {
  const items: SearchItem[] = [];
  for (const m of MODULES) {
    items.push({
      id: `m-${m.key}`,
      group: 'modules',
      title: t(`nav.${m.key}`),
      subtitle: m.code,
      to: m.path,
      keywords: `${t(`nav.${m.key}`)} ${m.code}`,
    });
  }
  for (const p of PHENOMENA) {
    items.push({
      id: `p-${p.id}`,
      group: 'phenomena',
      title: p.title[lang],
      subtitle: p.code,
      to: `/lab/${p.id}`,
      keywords: `${p.title.id} ${p.title.en} ${p.summary[lang]}`,
    });
  }
  for (const g of GLOSSARY) {
    items.push({
      id: `g-${g.id}`,
      group: 'glossary',
      title: g.term[lang],
      subtitle: g.short[lang],
      to: `/glossary#${g.id}`,
      keywords: `${g.term.id} ${g.term.en} ${g.aliases.id.join(' ')} ${g.aliases.en.join(' ')}`,
    });
  }
  items.push(
    {
      id: 'a-theme',
      group: 'actions',
      title: t('search.actions.toggleTheme'),
      action: 'toggleTheme',
      keywords: 'theme tema dark light gelap terang',
    },
    {
      id: 'a-lang',
      group: 'actions',
      title: t('search.actions.toggleLang'),
      action: 'toggleLang',
      keywords: 'language bahasa english indonesia',
    },
  );
  return items;
}

/** Pencocokan sederhana: semua token harus muncul (tanpa peduli huruf besar & diakritik). */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function searchItems(items: SearchItem[], query: string): SearchItem[] {
  const q = normalize(query).trim();
  if (!q) return items;
  const tokens = q.split(/\s+/);
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const title = normalize(item.title);
    const hay = `${title} ${normalize(item.keywords)} ${normalize(item.subtitle ?? '')}`;
    if (!tokens.every((tok) => hay.includes(tok))) continue;
    let score = 0;
    if (title.startsWith(q)) score += 10;
    if (title.includes(q)) score += 5;
    score -= title.length / 100;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
}
