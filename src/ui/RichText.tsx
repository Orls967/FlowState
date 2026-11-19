import { Fragment, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GLOSSARY } from '../content/glossary';
import type { Lang } from '../content/types';
import { useSettings } from '../store/settings';

interface Matcher {
  re: RegExp;
  byAlias: Map<string, string>;
  caps: Map<string, string>;
}

const cache = new Map<Lang, Matcher>();

function matcher(lang: Lang): Matcher {
  let m = cache.get(lang);
  if (m) return m;
  const byAlias = new Map<string, string>();
  const caps = new Map<string, string>();
  for (const t of GLOSSARY) {
    const names = [t.term[lang].replace(/\s*\(.*\)\s*$/, ''), ...t.aliases[lang]];
    for (const a of names) {
      if (a.length < 3 && a !== 'A*') continue;
      byAlias.set(a.toLowerCase(), t.id);
      if (a.length <= 6 && a === a.toUpperCase() && /[A-Z]/.test(a)) caps.set(a.toLowerCase(), a);
    }
  }
  const alts = [...byAlias.keys()]
    .sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // batas kata Unicode sederhana (huruf/angka di kiri-kanan tidak boleh menempel)
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${alts.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  m = { re, byAlias, caps };
  cache.set(lang, m);
  return m;
}

/** Tautkan istilah glosarium secara otomatis (kemunculan pertama per istilah dalam satu blok). */
export function autoLink(text: string, lang: Lang, exclude?: string, seen = new Set<string>()): ReactNode[] {
  const { re, byAlias, caps } = matcher(lang);
  const out: ReactNode[] = [];
  let last = 0;
  re.lastIndex = 0;
  let mt: RegExpExecArray | null;
  let k = 0;
  while ((mt = re.exec(text))) {
    const id = byAlias.get(mt[1].toLowerCase());
    if (!id || id === exclude || seen.has(id)) continue;
    // singkatan huruf kapital (IDM, MOBIL, BRT) hanya cocok bila ditulis kapital — "mobil" ≠ MOBIL
    const canon = caps.get(mt[1].toLowerCase());
    if (canon && mt[1] !== canon) continue;
    seen.add(id);
    if (mt.index > last) out.push(text.slice(last, mt.index));
    const term = GLOSSARY.find((g) => g.id === id)!;
    out.push(
      <Link
        key={`${id}-${k++}`}
        to={`/glossary#${id}`}
        title={term.short[lang]}
        className="underline decoration-accent decoration-2 underline-offset-2 hover:bg-accent-soft"
      >
        {mt[1]}
      </Link>,
    );
    last = mt.index + mt[1].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({
  text,
  exclude,
  className,
}: {
  text: string;
  exclude?: string;
  className?: string;
}) {
  const lang = useSettings((s) => s.lang);
  const parts = useMemo(() => {
    const seen = new Set<string>();
    return text.split(/\n\n+/).map((p) => autoLink(p, lang, exclude, seen));
  }, [text, lang, exclude]);
  return (
    <div className={className}>
      {parts.map((p, i) => (
        <p key={i} className={i > 0 ? 'mt-2' : ''}>
          {p.map((n, j) => (
            <Fragment key={j}>{n}</Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
