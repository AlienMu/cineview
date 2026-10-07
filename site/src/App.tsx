import { lazy, Suspense } from 'react';
import { matchPath, Route, Routes, useLocation } from 'react-router-dom';
import { useI18n } from './i18n';
import { BackgroundRibbon } from './components/BackgroundRibbon';
import { LangToggle } from './components/LangToggle';
import HomePage from './pages/HomePage';
import DragPage from './pages/DragPage';
import ScrollBasicsPreviewPage from './pages/ScrollBasicsPreviewPage';
import DragBasicsPreviewPage from './pages/DragBasicsPreviewPage';
import VideoTimelinePreviewPage from './pages/VideoTimelinePreviewPage';

const DocsPage = lazy(() => import('./pages/DocsPage'));
const VideoDragAcceptancePage = lazy(() => import('./pages/VideoDragAcceptancePage'));
const HorizontalScrollFixture = lazy(() => import('./pages/HorizontalScrollFixture'));

export default function App(): import('react').JSX.Element {
  const { lang } = useI18n();
  // /drag mounts its own LangToggle INSIDE act 1's <Scene> (SceneRolling's
  // GatedLangToggle) so the button enters and exits on the drag timeline with the
  // rest of the act. The hidden acceptance route also owns the whole viewport and
  // deliberately excludes shell chrome so trusted CDP input always lands on its
  // Cineview scene surface.
  const pathname = useLocation().pathname;
  const isDrag = matchPath('/drag', pathname) !== null;
  const isAcceptance = pathname.startsWith('/__acceptance/');
  // The /docs toggle is mounted by DocsShell in the app bar; must exclude here, otherwise both would render.
  const isDocs = pathname === '/docs' || pathname.startsWith('/docs/');
  const isDocsPreview = pathname.startsWith('/__docs/');

  return (
    <>
      <BackgroundRibbon />
      {isDrag || isAcceptance || isDocs || isDocsPreview ? null : <LangToggle />}
      <Suspense
        fallback={
          <div className="route-loading" role="status">
            {lang === 'zh' ? '正在加载…' : 'Loading…'}
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/drag" element={<DragPage />} />
          <Route path="/__acceptance/video-drag" element={<VideoDragAcceptancePage />} />
          <Route path="/__acceptance/horizontal-scroll" element={<HorizontalScrollFixture />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/docs/:slug" element={<DocsPage />} />
          <Route path="/__docs/scroll-basics" element={<ScrollBasicsPreviewPage />} />
          <Route path="/__docs/drag-basics" element={<DragBasicsPreviewPage />} />
          <Route path="/__docs/video-timeline" element={<VideoTimelinePreviewPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </>
  );
}
