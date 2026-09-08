import { useCallback, useState } from 'react';
import type { SceneChangeDetail } from 'cineview';
import { AnimateVideo, CineView, Scene } from 'cineview';

const SCENES = [
  { id: 'video-accept-0', label: 'ALPHA', background: '#111827', dragEnabled: true },
  { id: 'video-accept-1', label: 'BETA', background: '#1f2937', dragEnabled: true },
  { id: 'video-accept-2', label: 'GAMMA', background: '#312e81', dragEnabled: false },
] as const;

type DragCounters = {
  starts: number;
  blocked: number;
  cancels: number;
  commits: number;
};

const INITIAL_DRAG_COUNTERS: DragCounters = {
  starts: 0,
  blocked: 0,
  cancels: 0,
  commits: 0,
};

export default function VideoDragAcceptancePage(): import('react').JSX.Element {
  const [currentScene, setCurrentScene] = useState(0);
  const [dragCounters, setDragCounters] = useState(INITIAL_DRAG_COUNTERS);
  const handleSceneDidChange = useCallback(({ toIndex }: SceneChangeDetail): void => {
    setCurrentScene(toIndex);
  }, []);
  const incrementDragCounter = useCallback((counter: keyof DragCounters): void => {
    setDragCounters((current) => ({ ...current, [counter]: current[counter] + 1 }));
  }, []);

  return (
    <main
      data-page="video-drag-acceptance"
      data-current-scene={currentScene}
      data-drag-starts={dragCounters.starts}
      data-drag-blocked={dragCounters.blocked}
      data-drag-cancels={dragCounters.cancels}
      data-drag-commits={dragCounters.commits}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#05070b' }}
    >
      <CineView
        designWidth={430}
        mode="drag"
        direction="y"
        transitionDuration={800}
        unit="percent"
        scale={1}
        callbacks={{
          onSceneLeave: handleSceneDidChange,
          onDragStart: () => incrementDragCounter('starts'),
          onDragBlocked: () => incrementDragCounter('blocked'),
          onDragCancel: () => incrementDragCounter('cancels'),
          onDragEnd: () => incrementDragCounter('commits'),
        }}
      >
        {SCENES.map((scene, index) => (
          <Scene
            key={scene.id}
            sceneId={scene.id}
            drag={{ enabled: scene.dragEnabled }}
            layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
            transition={{ exitDuration: 800 }}
          >
            <section
              data-acceptance-scene={index}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                background: scene.background,
                touchAction: 'none',
              }}
            >
              <AnimateVideo
                src="/video.mp4"
                aria-label={`acceptance-video-${index}`}
                animateId={`acceptance-video-${index}`}
                duration={{ enter: 1000 }}
                preload={index === 0}
                width="100%"
                height="100%"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  pointerEvents: 'none',
                  color: 'white',
                  font: '700 36px/1 system-ui, sans-serif',
                  textShadow: '0 2px 14px rgba(0,0,0,.8)',
                }}
              >
                {scene.label}
              </div>
            </section>
          </Scene>
        ))}
      </CineView>
      <output
        data-acceptance-status
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 100,
          padding: '5px 8px',
          borderRadius: 4,
          background: 'rgba(0,0,0,.72)',
          color: '#fff',
          font: '12px/1.2 monospace',
          pointerEvents: 'none',
        }}
      >
        scene:{currentScene}
      </output>
    </main>
  );
}
