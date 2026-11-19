import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles/index.css';
import './i18n';
import { watchSystemTheme } from './store/settings';
import { App } from './App';

watchSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker sederhana agar bisa dipakai offline setelah dimuat (hanya produksi).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
