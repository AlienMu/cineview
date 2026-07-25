import { useRef, useState } from 'react';
import { CineView } from 'cineview';
import type { CineViewRef } from 'cineview';
import ExperienceOverlayChrome from '../components/ExperienceOverlayChrome';
import { ProfileBoundary } from '../components/ProfileBoundary';
import { renderScrollScenes } from '../components/ScrollScenes';
import { PERFORMANCE_EXPERIENCE } from '../content/performanceExperience';
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics';

export default function ScrollModePage(): JSX.Element {
  const cineViewRef = useRef<CineViewRef>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const metrics = usePerformanceMetrics(cineViewRef, monitorOpen);

  return (
    <ExperienceOverlayChrome
      currentScene={currentScene}
      loadProgress={loadProgress}
      metrics={metrics}
      mode="scroll"
      monitorOpen={monitorOpen}
      onGoToScene={(index) => cineViewRef.current?.goToScene(index, false)}
      onToggleMonitor={() => setMonitorOpen((current) => !current)}
      subtitle="Real document scroll with ordinary reading sections and Scene.scroll takeover chapters."
      totalScenes={PERFORMANCE_EXPERIENCE.sections.length}
    >
      <ProfileBoundary id="cineview-runtime">
        <CineView
          ref={cineViewRef}
          callbacks={{
            onLoadProgress: (progress) => setLoadProgress(progress),
            onSceneDidChange: (detail) => setCurrentScene(detail.toIndex),
          }}
          config={{ size: 1440 }}
          mode="scroll"
          modes={{ scroll: { direction: 'y', sceneSizing: 'content' } }}
          performance={{ monitor: monitorOpen }}
          scrollbar={{ enabled: true, width: 10, autoHide: false }}
        >
          {renderScrollScenes(PERFORMANCE_EXPERIENCE.sections)}
        </CineView>
      </ProfileBoundary>
    </ExperienceOverlayChrome>
  );
}
