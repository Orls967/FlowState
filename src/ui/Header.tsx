import { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Sun, Moon, Monitor, SlidersHorizontal, X } from 'lucide-react';
import { MODULES } from './modules';
import { useSettings, type ThemePref, type QualityPref } from '../store/settings';
import { useUi } from '../store/ui';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="3" className="fill-ink" />
      <path
        d="M5 22 L13 10 L19 18 L27 8"
        fill="none"
        className="stroke-accent"
        strokeWidth="3.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="13" cy="10" r="3" className="fill-paper stroke-ink" strokeWidth="1.6" />
      <circle cx="19" cy="18" r="3" className="fill-paper stroke-ink" strokeWidth="1.6" />
    </svg>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex border-2 border-line-strong">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.label}
          onClick={() => onChange(o.value)}
          className={`flex min-h-9 min-w-9 items-center justify-center gap-1 px-2 text-xs font-semibold ${
            value === o.value ? 'bg-ink text-paper' : 'hover:bg-surface-2'
          }`}
        >
          {o.icon}
          <span className={o.icon ? 'sr-only' : ''}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SettingsControls({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { themePref, setThemePref, lang, setLang, qualityPref, setQualityPref } = useSettings();
  return (
    <div className={`flex ${compact ? 'items-center gap-2' : 'flex-col gap-4'}`}>
      <div className={compact ? '' : 'flex flex-col gap-1'}>
        {!compact && <span className="station-label">{t('settings.language')}</span>}
        <Segmented
          label={t('settings.language')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'id', label: 'ID' },
            { value: 'en', label: 'EN' },
          ]}
        />
      </div>
      <div className={compact ? '' : 'flex flex-col gap-1'}>
        {!compact && <span className="station-label">{t('settings.theme')}</span>}
        <Segmented<ThemePref>
          label={t('settings.theme')}
          value={themePref}
          onChange={setThemePref}
          options={[
            { value: 'light', label: t('settings.light'), icon: <Sun size={16} aria-hidden /> },
            { value: 'dark', label: t('settings.dark'), icon: <Moon size={16} aria-hidden /> },
            { value: 'system', label: t('settings.system'), icon: <Monitor size={16} aria-hidden /> },
          ]}
        />
      </div>
      {!compact && (
        <div className="flex flex-col gap-1">
          <span className="station-label">{t('settings.quality')}</span>
          <Segmented<QualityPref>
            label={t('settings.quality')}
            value={qualityPref}
            onChange={setQualityPref}
            options={[
              { value: 'auto', label: t('settings.qualityAuto') },
              { value: 'low', label: t('settings.qualityLow') },
              { value: 'medium', label: t('settings.qualityMedium') },
              { value: 'high', label: t('settings.qualityHigh') },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function SettingsPopover() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('settings.settings')}
        data-testid="settings-button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center border-2 border-line-strong hover:bg-surface-2"
      >
        {open ? <X size={18} aria-hidden /> : <SlidersHorizontal size={18} aria-hidden />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 border-2 border-line-strong bg-surface p-4 shadow-[4px_4px_0_var(--fs-line-strong)]">
          <SettingsControls />
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { t } = useTranslation();
  const openSearch = useUi((s) => s.setSearchOpen);
  return (
    <header className="sticky top-0 z-40 border-b-2 border-line-strong bg-paper/95 backdrop-blur-[2px]">
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('app.skip')}
      </a>
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-4">
        <Link to="/" className="flex items-center gap-2" aria-label={`${t('app.name')} — ${t('nav.home')}`}>
          <Logo />
          <span className="font-display text-xl font-semibold tracking-wide">{t('app.name')}</span>
        </Link>
        <nav aria-label={t('nav.modules')} className="ml-4 hidden flex-1 xl:block">
          <ol className="relative flex items-center">
            <span aria-hidden className="absolute left-2 right-2 top-1/2 h-[3px] -translate-y-1/2 bg-ink" />
            {MODULES.filter((m) => m.main).map((m) => (
              <li key={m.key} className="relative z-10 flex-1">
                <NavLink
                  to={m.path}
                  className={({ isActive }) =>
                    `group flex items-center gap-1.5 whitespace-nowrap px-1 py-1 text-[0.82rem] ${isActive ? 'font-semibold' : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden
                        className={`h-3.5 w-3.5 shrink-0 rounded-full border-[3px] ${
                          isActive
                            ? 'border-accent bg-accent'
                            : 'border-ink bg-paper group-hover:bg-accent-soft'
                        }`}
                      />
                      <span className={`bg-paper px-1 ${isActive ? 'text-accent' : ''}`}>
                        <span className="num mr-1 text-[0.7rem] text-ink-2">{m.code}</span>
                        {t(`nav.${m.key}`)}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openSearch(true)}
            data-testid="search-button"
            className="flex h-9 items-center gap-2 border-2 border-line-strong px-2 text-sm hover:bg-surface-2"
            aria-label={t('nav.search')}
          >
            <Search size={16} aria-hidden />
            <span className="num hidden text-xs text-ink-2 md:inline">{t('search.hint')}</span>
          </button>
          <div className="hidden sm:block">
            <SettingsControls compact />
          </div>
          <NavLink
            to="/about"
            className="hidden h-9 items-center px-2 text-sm underline-offset-4 hover:underline 2xl:flex"
          >
            {t('nav.about')}
          </NavLink>
          <SettingsPopover />
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('nav.modules')}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line-strong bg-paper pb-[env(safe-area-inset-bottom)] xl:hidden"
    >
      <ol className="relative flex overflow-x-auto">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <li key={m.key} className="min-w-[4.4rem] flex-1">
              <NavLink
                to={m.path}
                className={({ isActive }) =>
                  `flex h-14 flex-col items-center justify-center gap-0.5 text-[0.68rem] leading-tight ${
                    isActive ? 'bg-ink text-paper' : ''
                  }`
                }
              >
                <Icon size={18} aria-hidden />
                <span className="max-w-full truncate px-1">{t(`nav.${m.key}`)}</span>
              </NavLink>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
