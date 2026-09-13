import { useRef, useState } from 'react';
import { Cineview } from 'cineview';
import type { CineviewRef } from 'cineview';
import ExperienceOverlayChrome from '../components/ExperienceOverlayChrome';
import { ProfileBoundary } from '../components/ProfileBoundary';
import { renderScrollScenes } from '../components/ScrollScenes';
import { PERFORMANCE_EXPERIENCE } from '../content/performanceExperience';
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics';

export default function ScrollModePage(): import('react').JSX.Element {
  const cineviewRef = useRef<CineviewRef>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const metrics = usePerformanceMetrics(cineviewRef, monitorOpen);

  return (
    <ExperienceOverlayChrome
      currentScene={currentScene}
      loadProgress={loadProgress}
      metrics={metrics}
      mode="scroll"
      monitorOpen={monitorOpen}
      onGoToScene={(index) => cineviewRef.current?.goToScene(index, false)}
      onToggleMonitor={() => setMonitorOpen((current) => !current)}
      subtitle="Real document scroll with ordinary reading sections and Scene.scroll takeover chapters."
      totalScenes={PERFORMANCE_EXPERIENCE.sections.length}
    >
      <ProfileBoundary id="cineview-runtime">
        <Cineview
          ref={cineviewRef}
          callbacks={{
            onLoadProgress: (progress) => setLoadProgress(progress),
            onSceneLeave: (detail) => setCurrentScene(detail.toIndex),
          }}
          designWidth={1440}
          mode="scroll"
          direction="y"
          sceneSizing="content"
          monitor={monitorOpen}
          scrollbar={{ enabled: true, width: 10, autoHide: false }}
        >
          {renderScrollScenes(PERFORMANCE_EXPERIENCE.sections)}
        </Cineview>
      </ProfileBoundary>
    </ExperienceOverlayChrome>
  );
}
