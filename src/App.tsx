import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header, MobileNav } from './ui/Header';
import { CommandPalette } from './ui/CommandPalette';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { useSettings } from './store/settings';

const Home = lazy(() => import('./pages/Home'));
const LiveCity = lazy(() => import('./pages/LiveCity'));
const Editor = lazy(() => import('./pages/Editor'));
const Lab = lazy(() => import('./pages/Lab'));
const Transit = lazy(() => import('./pages/Transit'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Glossary = lazy(() => import('./pages/Glossary'));
const About = lazy(() => import('./pages/About'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 items-center justify-center p-8" role="status">
      <span className="station-label">{t('app.loading')}</span>
    </div>
  );
}

/** Judul dokumen & fokus ke konten utama tiap ganti halaman. */
function RouteEffects() {
  const location = useLocation();
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  useEffect(() => {
    const seg = location.pathname.split('/')[1] ?? '';
    const known = ['city', 'editor', 'lab', 'transit', 'analytics', 'glossary', 'about'];
    const title = known.includes(seg)
      ? `${t(`nav.${seg}`)} — ${t('app.name')}`
      : `${t('app.name')} — ${t('app.tagline')}`;
    document.title = title;
  }, [location.pathname, t, lang]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <RouteEffects />
      <div className="flex min-h-full flex-col">
        <Header />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col pb-16 outline-none xl:pb-0">
          <ErrorBoundary>
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/city" element={<LiveCity />} />
                <Route path="/editor" element={<Editor />} />
                <Route path="/lab" element={<Lab />} />
                <Route path="/lab/:id" element={<Lab />} />
                <Route path="/transit" element={<Transit />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/glossary" element={<Glossary />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <MobileNav />
        <CommandPalette />
      </div>
    </HashRouter>
  );
}
