import { useEffect, useMemo, useRef, useState } from 'react';
import { Animate, CineView, Container, OptimizedImage, Position, Scene } from 'cineview';
import type { CineViewRef, PerformanceMetrics, ScrollMode } from 'cineview';
import PerformanceMonitor from './components/PerformanceMonitor';
import SceneNavigation from './components/SceneNavigation';
import { generateScenes } from './utils/sceneGenerator';

function SceneContent({
  scene,
  index,
}: {
  scene: ReturnType<typeof generateScenes>[number];
  index: number;
}): JSX.Element {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: scene.background,
        }}
      />

      <Container>
        <Position at={{ x: 375, y: 200 }}>
          <Animate
            animateId={`scene-${index}-title`}
            enterAnimation="slide-down"
            exitAnimation="slide-up"
            duration={{ enter: 800, exit: 800 }}
          >
            <h1
              style={{
                fontSize: '60px',
                fontWeight: 'bold',
                color: '#fff',
                textAlign: 'center',
                textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                transform: 'translateX(-50%)',
                width: '600px',
              }}
            >
              Scene {index + 1}
            </h1>
          </Animate>
        </Position>

        <Position at={{ x: 375, y: 320 }}>
          <Animate
            animateId={`scene-${index}-copy`}
            enterAnimation="slide-up"
            exitAnimation="slide-down"
            duration={{ enter: 800, exit: 800 }}
            timeline={{ delay: 240 }}
          >
            <p
              style={{
                fontSize: '24px',
                color: '#fff',
                textAlign: 'center',
                transform: 'translateX(-50%)',
                width: '620px',
                lineHeight: 1.6,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {scene.description}
            </p>
          </Animate>
        </Position>
      </Container>

      <Container>
        {scene.elements.slice(0, 4).map((element, elementIndex) => (
          <Position key={elementIndex} at={{ x: element.x, y: element.y }}>
            <Animate
              animateId={`scene-${index}-element-${elementIndex}`}
              enterAnimation={element.animation}
              exitAnimation="fade-out"
              infiniteAnimation={element.infiniteAnimation}
              duration={{ enter: element.duration, exit: element.duration }}
              timeline={{ delay: element.delay }}
            >
              <div
                style={{
                  width: `${element.size}px`,
                  height: `${element.size}px`,
                  background: element.color,
                  borderRadius: element.shape === 'circle' ? '50%' : '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              />
            </Animate>
          </Position>
        ))}
      </Container>

      {scene.images[0] && (
        <Position at={{ x: 375, y: 650 }}>
          <Animate
            animateId={`scene-${index}-image`}
            enterAnimation="zoom-in"
            exitAnimation="zoom-out"
            duration={{ enter: 700, exit: 700 }}
            timeline={{ delay: 640 }}
          >
            <div style={{ transform: 'translateX(-50%)' }}>
              <OptimizedImage
                src={scene.images[0]}
                alt={`Scene ${index + 1}`}
                width={400}
                height={300}
                placeholder="rgba(255,255,255,0.1)"
                style={{ borderRadius: '12px', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}
              />
            </div>
          </Animate>
        </Position>
      )}
    </>
  );
}

export default function App(): JSX.Element {
  const cineViewRef = useRef<CineViewRef>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [mode, setMode] = useState<Exclude<ScrollMode, 'scroll'>>('snap');

  const scenes = useMemo(() => generateScenes(8), []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (cineViewRef.current) {
        setMetrics(cineViewRef.current.getPerformanceMetrics());
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentScene(0);
  }, [mode]);

  return (
    <>
      <CineView
        key={mode}
        ref={cineViewRef}
        mode={mode}
        modes={{
          snap: { direction: 'y', duration: 800 },
          drag: { direction: 'y', transitionDuration: 800 },
        }}
        config={{ width: 750, height: 1334, unit: 'px' }}
        callbacks={{
          common: {
            onSceneDidChange: (detail) => setCurrentScene(detail.toIndex),
            onLoadProgress: (progress) => setLoadProgress(progress),
          },
        }}
        performance={{ preset: 'smooth' }}
      >
        {scenes.map((scene, index) => (
          <Scene
            key={index}
            transition={{
              enterAnimation: scene.enterAnimation,
              exitAnimation: scene.exitAnimation,
              exitDuration: 800,
            }}
            assets={{ preloadImages: scene.images }}
          >
            <SceneContent scene={scene} index={index} />
          </Scene>
        ))}
      </CineView>

      {metrics && (
        <PerformanceMonitor
          metrics={metrics}
          currentScene={currentScene}
          totalScenes={scenes.length}
          loadProgress={loadProgress}
          mode={mode}
          transitionDuration={800}
        />
      )}

      <SceneNavigation
        currentScene={currentScene}
        totalScenes={scenes.length}
        onGoToScene={(index) => cineViewRef.current?.goToScene(index, true)}
        mode={mode}
      />

      <button
        onClick={() => setMode((current) => (current === 'snap' ? 'drag' : 'snap'))}
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 10000,
          padding: '10px 16px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(10,12,18,0.76)',
          color: '#fff',
          cursor: 'pointer',
          backdropFilter: 'blur(14px)',
        }}
      >
        Switch to {mode === 'snap' ? 'drag' : 'snap'}
      </button>
    </>
  );
}
