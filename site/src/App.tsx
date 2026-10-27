import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useI18n } from './i18n';

// The homepage (/) and the examples are static pages in public/; this app renders the docs.
const DocsPage = lazy(() => import('./pages/DocsPage'));

export default function App(): import('react').JSX.Element {
  const { lang } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          {lang === 'zh' ? '正在加载…' : 'Loading…'}
        </div>
      }
    >
      <Routes>
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:slug" element={<DocsPage />} />
        <Route path="*" element={<Navigate to="/docs" replace />} />
      </Routes>
    </Suspense>
  );
}
