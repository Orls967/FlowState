import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { GLOSSARY, GLOSSARY_BY_ID } from '../content/glossary';
import { useSettings } from '../store/settings';
import { PageHeader } from '../ui/PageHeader';
import { RichText } from '../ui/RichText';
import { normalize } from '../ui/searchIndex';

export default function Glossary() {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const location = useLocation();
  const [q, setQ] = useState('');
  const active = location.hash.replace('#', '');

  const items = useMemo(() => {
    const nq = normalize(q.trim());
    return [...GLOSSARY]
      .sort((a, b) => a.term[lang].localeCompare(b.term[lang], lang))
      .filter(
        (g) => !nq || normalize(`${g.term[lang]} ${g.aliases[lang].join(' ')} ${g.short[lang]}`).includes(nq),
      );
  }, [q, lang]);

  useEffect(() => {
    if (!active) return;
    const el = document.getElementById(`term-${active}`);
    if (el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      el.focus({ preventScroll: true });
    }
  }, [active]);

  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <PageHeader code="M6" title={t('glossary.title')}>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">{t('glossary.intro')}</p>
      </PageHeader>
      <div className="sticky top-14 z-10 border-b-2 border-line-strong bg-paper px-4 py-3 sm:px-6">
        <label className="flex items-center gap-2 border-2 border-line-strong bg-surface px-2">
          <Search size={16} aria-hidden className="text-ink-2" />
          <span className="sr-only">{t('glossary.filter')}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('glossary.filter')}
            data-testid="glossary-filter"
            className="h-10 flex-1 bg-transparent outline-none placeholder:text-ink-2"
          />
          <span className="num text-xs text-ink-2">{items.length}</span>
        </label>
      </div>
      {items.length === 0 && <p className="px-6 py-8 text-ink-2">{t('glossary.noResults')}</p>}
      <dl className="divide-y-2 divide-line">
        {items.map((g) => (
          <div
            key={g.id}
            id={`term-${g.id}`}
            tabIndex={-1}
            data-testid={`term-${g.id}`}
            className={`scroll-mt-32 px-4 py-5 outline-none sm:px-6 ${active === g.id ? 'border-l-4 border-accent bg-surface' : ''}`}
          >
            <dt className="font-display text-xl font-semibold">{g.term[lang]}</dt>
            <dd className="mt-1 font-semibold text-ink-2">{g.short[lang]}</dd>
            <dd className="mt-2 max-w-3xl leading-relaxed">
              <RichText text={g.body[lang]} exclude={g.id} />
            </dd>
            {g.related.length > 0 && (
              <dd className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="station-label">{t('glossary.seeAlso')}</span>
                {g.related.map((r) => (
                  <Link
                    key={r}
                    to={`/glossary#${r}`}
                    className="border-2 border-line px-2 py-0.5 hover:border-line-strong"
                  >
                    {GLOSSARY_BY_ID.get(r)?.term[lang] ?? r}
                  </Link>
                ))}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
