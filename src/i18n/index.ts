import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { id } from './locales/id';
import { en } from './locales/en';
import { safeGet } from '../lib/storage';

export type Lang = 'id' | 'en';
export const LANGS: readonly Lang[] = ['id', 'en'];
export const LANG_KEY = 'flowstate.lang';

export function initialLang(): Lang {
  const stored = safeGet(LANG_KEY);
  return stored === 'en' ? 'en' : 'id';
}

void i18n.use(initReactI18next).init({
  resources: { id: { translation: id }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
