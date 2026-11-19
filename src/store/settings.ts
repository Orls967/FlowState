import { create } from 'zustand';
import i18n, { LANG_KEY, initialLang, type Lang } from '../i18n';
import { safeGet, safeSet } from '../lib/storage';

export type ThemePref = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';
export type QualityPref = 'auto' | 'low' | 'medium' | 'high';
export type Quality = 'low' | 'medium' | 'high';

const THEME_KEY = 'flowstate.theme';
const QUALITY_KEY = 'flowstate.quality';

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function resolve(pref: ThemePref): Theme {
  if (pref === 'system') return systemDark() ? 'dark' : 'light';
  return pref;
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d1117' : '#f3efe4');
}

function readThemePref(): ThemePref {
  const v = safeGet(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function readQuality(): QualityPref {
  const v = safeGet(QUALITY_KEY);
  return v === 'low' || v === 'medium' || v === 'high' ? v : 'auto';
}

/** Tebakan awal kualitas dari kemampuan perangkat; disesuaikan lagi saat runtime oleh pemantau FPS. */
export function guessQuality(): Quality {
  if (typeof navigator === 'undefined') return 'medium';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const small = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (small || coarse) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  if (cores >= 8 && mem >= 8) return 'high';
  return 'medium';
}

interface SettingsState {
  themePref: ThemePref;
  theme: Theme;
  lang: Lang;
  qualityPref: QualityPref;
  /** Kualitas efektif (hasil otomatis atau pilihan pengguna). */
  quality: Quality;
  setThemePref: (p: ThemePref) => void;
  toggleTheme: () => void;
  setLang: (l: Lang) => void;
  setQualityPref: (q: QualityPref) => void;
  /** Dipanggil pemantau FPS saat mode otomatis. */
  setAutoQuality: (q: Quality) => void;
  syncSystemTheme: () => void;
}

export const useSettings = create<SettingsState>((set, get) => {
  const themePref = readThemePref();
  const qualityPref = readQuality();
  return {
    themePref,
    theme: resolve(themePref),
    lang: initialLang(),
    qualityPref,
    quality: qualityPref === 'auto' ? guessQuality() : qualityPref,
    setThemePref: (p) => {
      safeSet(THEME_KEY, p);
      const theme = resolve(p);
      applyTheme(theme);
      set({ themePref: p, theme });
    },
    toggleTheme: () => get().setThemePref(get().theme === 'dark' ? 'light' : 'dark'),
    setLang: (l) => {
      safeSet(LANG_KEY, l);
      document.documentElement.setAttribute('lang', l);
      void i18n.changeLanguage(l);
      set({ lang: l });
    },
    setQualityPref: (q) => {
      safeSet(QUALITY_KEY, q);
      set({ qualityPref: q, quality: q === 'auto' ? guessQuality() : q });
    },
    setAutoQuality: (q) => {
      if (get().qualityPref === 'auto' && get().quality !== q) set({ quality: q });
    },
    syncSystemTheme: () => {
      if (get().themePref !== 'system') return;
      const theme = resolve('system');
      applyTheme(theme);
      set({ theme });
    },
  };
});

/** Pasang listener perubahan tema sistem (dipanggil sekali di main.tsx). */
export function watchSystemTheme(): void {
  try {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => useSettings.getState().syncSystemTheme());
  } catch {
    /* peramban lama */
  }
}
