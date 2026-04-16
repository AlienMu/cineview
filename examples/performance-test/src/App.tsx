import React, { useRef, useState, useEffect } from 'react';
import {
  CineView,
  Scene,
  Animate,
  Position,
  Container,
  OptimizedImage,
  useConvertSize,
} from 'cineview';
import type { CineViewRef, PerformanceMetrics } from 'cineview';
import PerformanceMonitor from './components/PerformanceMonitor';
import SceneNavigation from './components/SceneNavigation';
import { generateScenes } from './utils/sceneGenerator';

// 单个场景内容组件
const SceneContent: React.FC<{
  scene: ReturnType<typeof generateScenes>[0];
  index: number;
}> = ({ scene, index }) => {
  const convertSize = useConvertSize();

  return (
    <>
      {/* Background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: scene.background,
          zIndex: 0,
        }}
      />

      {/* 使用 Container 包裹标题和描述 */}
      <Container>
        <Position x={375} y={200}>
          <Animate
            enterAnimation="slide-down"
            enterDuration={800}
            delay={0}
            animateId={`scene-${index}-title`}
          >
            <h1
              style={{
                fontSize: convertSize(80),
                fontWeight: 'bold',
                color: '#fff',
                textAlign: 'center',
                textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                transform: 'translateX(-50%)',
                width: convertSize(600),
              }}
            >
              Scene {index + 1}
            </h1>
          </Animate>
        </Position>

        <Position x={375} y={320}>
          <Animate
            enterAnimation="slide-up"
            enterDuration={800}
            delay={200}
            animateId={`scene-${index}-desc`}
          >
            <p
              style={{
                fontSize: convertSize(24),
                color: '#fff',
                textAlign: 'center',
                transform: 'translateX(-50%)',
                width: convertSize(600),
                lineHeight: 1.6,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {scene.description}
            </p>
          </Animate>
        </Position>
      </Container>

      {/* 使用 Container 包裹动画元素 */}
      <Container>
        {scene.elements.map((element, elemIndex) => (
          <Position key={elemIndex} x={element.x} y={element.y}>
            <Animate
              enterAnimation={element.animation}
              enterDuration={element.duration}
              delay={element.delay}
              infiniteAnimation={element.infiniteAnimation}
              animateId={`scene-${index}-elem-${elemIndex}`}
            >
              <div
                style={{
                  width: convertSize(element.size),
                  height: convertSize(element.size),
                  background: element.color,
                  borderRadius: element.shape === 'circle' ? '50%' : convertSize(8),
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              />
            </Animate>
          </Position>
        ))}
      </Container>

      {/* Image Test */}
      {scene.images.length > 0 && (
        <Position x={375} y={500}>
          <Animate
            enterAnimation="zoom-in"
            enterDuration={800}
            delay={600}
            animateId={`scene-${index}-image`}
          >
            <div style={{ transform: 'translateX(-50%)' }}>
              <OptimizedImage
                src={scene.images[0]}
                alt={`Scene ${index} test`}
                width={convertSize(400)}
                height={convertSize(300)}
                placeholder="rgba(255,255,255,0.1)"
                style={{
                  borderRadius: convertSize(12),
                  boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
                }}
              />
            </div>
          </Animate>
        </Position>
      )}

      {/* Performance Info */}
      <Position x={375} y={scene.images.length > 0 ? 850 : 650}>
        <Animate enterAnimation="slide-left" enterDuration={600} delay={800}>
          <div
            style={{
              fontSize: convertSize(14),
              color: 'rgba(255,255,255,0.7)',
              textAlign: 'center',
              transform: 'translateX(-50%)',
              width: convertSize(500),
            }}
          >
            <div>
              进场: {scene.enterAnimation} | 退场: {scene.exitAnimation}
            </div>
            {scene.images.length > 0 && (
              <div style={{ marginTop: convertSize(8) }}>📷 图片预加载测试</div>
            )}
          </div>
        </Animate>
      </Position>
    </>
  );
};

const App: React.FC = () => {
  const cineViewRef = useRef<CineViewRef>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  // Generate 25 scenes for performance testing
  const scenes = generateScenes(25);

  // Update performance metrics every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (cineViewRef.current) {
        const newMetrics = cineViewRef.current.getPerformanceMetrics();
        setMetrics(newMetrics);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSceneChange = (index: number): void => {
    setCurrentScene(index);
  };

  const handleLoadProgress = (progress: number): void => {
    setLoadProgress(progress);
  };

  return (
    <>
      <CineView
        ref={cineViewRef}
        config={{
          designSize: 750,
          unit: 'px',
        }}
        onAfterSceneChange={handleSceneChange}
        onLoadProgress={handleLoadProgress}
        performanceMode={true}
      >
        {scenes.map((scene, index) => (
          <Scene
            key={index}
            slideDirection="y"
            slideMode="snap"
            slideDuration={800}
            enterAnimation={scene.enterAnimation}
            exitAnimation={scene.exitAnimation}
            exitDuration={800}
            preloadImages={scene.images}
          >
            <SceneContent scene={scene} index={index} />
          </Scene>
        ))}
      </CineView>

      {/* Performance Monitor Overlay */}
      {metrics && (
        <PerformanceMonitor
          metrics={metrics}
          currentScene={currentScene}
          totalScenes={scenes.length}
          loadProgress={loadProgress}
        />
      )}

      {/* Scene Navigation */}
      <SceneNavigation
        currentScene={currentScene}
        totalScenes={scenes.length}
        onGoToScene={(index) => cineViewRef.current?.goToScene(index)}
      />
    </>
  );
};

export default App;
