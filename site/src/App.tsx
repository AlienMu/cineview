import { Route, Routes, useLocation } from 'react-router-dom';
import { BackgroundRibbon } from './components/BackgroundRibbon';
import { LangToggle } from './components/LangToggle';
import HomePage from './pages/HomePage';
import DocsPage from './pages/DocsPage';
import DragPage from './pages/DragPage';
import VideoDragAcceptancePage from './pages/VideoDragAcceptancePage';
import DualClockFixturePage from './pages/DualClockFixture'; // TEMP review fixture

export default function App(): JSX.Element {
  // /drag mounts its own LangToggle INSIDE act 1's <Scene> (SceneRolling's
  // GatedLangToggle) so the button enters and exits on the drag timeline with the
  // rest of the act. The hidden acceptance route also owns the whole viewport and
  // deliberately excludes shell chrome so trusted CDP input always lands on its
  // CineView scene surface.
  const pathname = useLocation().pathname;
  const isDrag = pathname === '/drag';
  const isAcceptance = pathname === '/__acceptance/video-drag';
  // /docs 的切换器由 DocsShell 挂在应用栏里；这里必须排除，否则两个都渲染。
  const isDocs = pathname === '/docs' || pathname.startsWith('/docs/');

  return (
    <>
      <BackgroundRibbon />
      {isDrag || isAcceptance || isDocs ? null : <LangToggle />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/drag" element={<DragPage />} />
        <Route path="/__acceptance/video-drag" element={<VideoDragAcceptancePage />} />
        <Route path="/__review/dual-clock" element={<DualClockFixturePage />} /> {/* TEMP */}
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:slug" element={<DocsPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </>
  );
}
