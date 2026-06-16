import { useRef, useState } from 'react';
import { CineView } from 'cineview';
import type { CineViewRef } from 'cineview';
import ExperienceOverlayChrome from '../components/ExperienceOverlayChrome';
import { renderSnapScenes } from '../components/PagedScenes';
import { PERFORMANCE_EXPERIENCE } from '../content/performanceExperience';
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics';

export default function SnapModePage(): JSX.Element {
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
      mode="snap"
      monitorOpen={monitorOpen}
      onGoToScene={(index) => cineViewRef.current?.goToScene(index, true)}
      onToggleMonitor={() => setMonitorOpen((current) => !current)}
      subtitle="Full-screen chapters with a single focus point per scene."
      totalScenes={PERFORMANCE_EXPERIENCE.sections.length}
    >
      <CineView
        ref={cineViewRef}
        callbacks={{
          common: {
            onLoadProgress: (progress) => setLoadProgress(progress),
            onSceneDidChange: (detail) => setCurrentScene(detail.toIndex),
          },
        }}
        config={{ width: 1440, height: 1080, unit: 'px' }}
        mode="snap"
        modes={{ snap: { direction: 'y', duration: 860 } }}
        performance={{ preset: 'smooth', monitor: monitorOpen }}
      >
        {renderSnapScenes(PERFORMANCE_EXPERIENCE.sections)}
      </CineView>
    </ExperienceOverlayChrome>
  );
}
