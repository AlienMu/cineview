import { useRef, useState } from 'react';
import { Cineview } from 'cineview';
import type { CineviewRef } from 'cineview';
import ExperienceOverlayChrome from '../components/ExperienceOverlayChrome';
import { ProfileBoundary } from '../components/ProfileBoundary';
import { renderDragScenes } from '../components/PagedScenes';
import { PERFORMANCE_EXPERIENCE } from '../content/performanceExperience';
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics';

export default function DragModePage(): import('react').JSX.Element {
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
      mode="drag"
      monitorOpen={monitorOpen}
      onGoToScene={(index) => cineviewRef.current?.goToScene(index, true)}
      onToggleMonitor={() => setMonitorOpen((current) => !current)}
      subtitle="Weighted vertical chapters with deliberate release, settle, and premium product staging."
      totalScenes={PERFORMANCE_EXPERIENCE.sections.length}
    >
      <ProfileBoundary id="cineview-runtime">
        <Cineview
          ref={cineviewRef}
          callbacks={{
            onLoadProgress: (progress) => setLoadProgress(progress),
            onDragEnd: (detail) => setCurrentScene(detail.targetSceneIndex),
          }}
          designWidth={1440}
          mode="drag"
          direction="y"
          transitionDuration={920}
          monitor={monitorOpen}
        >
          {renderDragScenes(PERFORMANCE_EXPERIENCE.sections)}
        </Cineview>
      </ProfileBoundary>
    </ExperienceOverlayChrome>
  );
}
