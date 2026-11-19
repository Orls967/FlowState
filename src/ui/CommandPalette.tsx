import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, CornerDownLeft } from 'lucide-react';
import { useUi } from '../store/ui';
import { useSettings } from '../store/settings';
import { buildSearchIndex, searchItems, type SearchItem } from './searchIndex';

export function CommandPalette() {
  const { t } = useTranslation();
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const lang = useSettings((s) => s.lang);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUi.getState().searchOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const index = useMemo(() => buildSearchIndex(t, lang), [t, lang]);
  const results = useMemo(() => searchItems(index, query).slice(0, 40), [index, query]);

  if (!open) return null;

  const run = (item: SearchItem) => {
    setOpen(false);
    if (item.action === 'toggleTheme') useSettings.getState().toggleTheme();
    else if (item.action === 'toggleLang') useSettings.getState().setLang(lang === 'id' ? 'en' : 'id');
    else if (item.to) navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      run(results[active]);
    }
  };

  let lastGroup = '';
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/40 px-3 pt-[10vh]"
      onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.search')}
        className="w-full max-w-xl border-2 border-line-strong bg-surface shadow-[6px_6px_0_var(--fs-line-strong)]"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b-2 border-line-strong px-3">
          <Search size={18} aria-hidden className="text-ink-2" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${results[active].id}` : undefined}
            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-ink-2"
          />
          <button type="button" onClick={() => setOpen(false)} className="num text-xs text-ink-2">
            Esc
          </button>
        </div>
        <ul id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
          {results.length === 0 && <li className="px-4 py-6 text-ink-2">{t('search.empty')}</li>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup;
            lastGroup = r.group;
            return (
              <li key={r.id} role="presentation">
                {header && (
                  <div className="station-label px-4 pb-1 pt-3">{t(`search.groups.${r.group}`)}</div>
                )}
                <div
                  id={`sr-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => run(r)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${
                    i === active ? 'bg-ink text-paper' : ''
                  }`}
                >
                  <span className="flex-1 truncate">{r.title}</span>
                  {r.subtitle && <span className="num truncate text-xs opacity-70">{r.subtitle}</span>}
                  {i === active && <CornerDownLeft size={14} aria-hidden />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
