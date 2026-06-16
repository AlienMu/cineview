import type { PerformanceMetrics } from 'cineview';
import type { ReactNode } from 'react';
import type { ModeId } from '../routing';
import ExperienceHeader from './ExperienceHeader';
import PerformanceMonitor from './PerformanceMonitor';
import SceneNavigation from './SceneNavigation';

interface ExperienceOverlayChromeProps {
  children: ReactNode;
  currentScene: number;
  loadProgress: number;
  metrics: PerformanceMetrics | null;
  mode: ModeId;
  monitorOpen: boolean;
  onGoToScene: (index: number) => void;
  onToggleMonitor: () => void;
  subtitle: string;
  totalScenes: number;
}

export default function ExperienceOverlayChrome({
  children,
  currentScene,
  loadProgress,
  metrics,
  mode,
  monitorOpen,
  onGoToScene,
  onToggleMonitor,
  subtitle,
  totalScenes,
}: ExperienceOverlayChromeProps): JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #FFF9F0 0%, #F2F8FF 100%)',
        color: '#1F2A44',
      }}
    >
      {children}
      <ExperienceHeader mode={mode} subtitle={subtitle} />
      <PerformanceMonitor
        currentScene={currentScene}
        loadProgress={loadProgress}
        metrics={metrics}
        mode={mode}
        onToggle={onToggleMonitor}
        open={monitorOpen}
        totalScenes={totalScenes}
      />
      <SceneNavigation
        currentScene={currentScene}
        mode={mode}
        onGoToScene={onGoToScene}
        totalScenes={totalScenes}
      />
    </div>
  );
}
