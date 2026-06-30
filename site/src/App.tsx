import { Route, Routes } from 'react-router-dom';
import { BackgroundRibbon } from './components/BackgroundRibbon';
import { LangToggle } from './components/LangToggle';
import HomePage from './pages/HomePage';
import DemoPage from './pages/DemoPage';
import DocsPage from './pages/DocsPage';

export default function App(): JSX.Element {
  return (
    <>
      <BackgroundRibbon />
      <LangToggle />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:slug" element={<DocsPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </>
  );
}
