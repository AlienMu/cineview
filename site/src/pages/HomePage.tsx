import { useCallback, useEffect, useState } from 'react';
import { Cineview, Scene } from 'cineview';
import { HeroScene } from '../components/HeroScene';
import { CapabilityFilmStripScene } from '../components/CapabilityScene';
import { AboutScenesScene } from '../components/AboutScenesScene';
import { CanvasExtensibilityScene } from '../components/CanvasExtensibilityScene';
import { EditorialIndexScene } from '../components/EditorialIndexScene';
import { DemoVideoScene } from '../components/DemoVideoScene';
import { HomeSceneCanvas } from '../components/HomeSceneCanvas';
import { Scene5Cinema } from '../components/Scene5Cinema';
import '../components/HomeDemoControls.css';

/**
 * Preload /drag experience: After Cineview onReady, create a hidden iframe to fetch
 * /drag's HTML/JS/CSS into cache (preload=true renders only the shell with zero animations
 * and zero rAF), then remove it onLoad. Non-blocking for home page render, no visual or
 * interaction side effects.
 */
function DragExperiencePreloader({ active }: { active: boolean }): null {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const iframe = document.createElement('iframe');
    iframe.src = '/drag?preload=true';
    iframe.style.cssText =
      'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.title = 'preload';
    const handleLoad = (): void => iframe.remove();
    iframe.addEventListener('load', handleLoad);
    document.body.appendChild(iframe);
    return (): void => {
      iframe.removeEventListener('load', handleLoad);
      iframe.remove();
    };
  }, [active]);

  return null;
}

/**
 * Official home page — seven-scene scroll instance for the entire page.
 * Natural sections alternate with locally owned film, Canvas, video, and Cinema zones.
 */
export default function HomePage(): import('react').JSX.Element {
  const [dragPreloadArmed, setDragPreloadArmed] = useState(false);
  const armDragPreload = useCallback((): void => {
    setDragPreloadArmed(true);
  }, []);
  return (
    <div className="home-page">
      {/* Site-wide background ribbon = App-level <BackgroundRibbon /> (original mechanism restored, 2026-08-13),
          no longer mounted from this page (see task-flow 2026-08-13 追加轮). */}
      <Cineview
        designWidth={1440}
        mode="scroll"
        scrollbar={{
          enabled: true,
          width: 8,
          autoHide: true,
          trackColor: 'rgba(26, 24, 20, 0.06)',
          thumbColor: 'var(--accent)',
        }}
        callbacks={{ onReady: armDragPreload }}
      >
        <Scene
          sceneId="hero"
          className="home-scene home-scene--hero"
          layout={{ width: '100%', height: '100vh' }}
        >
          <HomeSceneCanvas>
            <HeroScene />
          </HomeSceneCanvas>
        </Scene>

        {/* Shot 02: nine presets share one local center-lock zone. */}
        <Scene
          sceneId="cap-film"
          className="home-scene home-scene--film"
          layout={{ width: '100%', height: '100vh' }}
          scroll={{ zoneId: 'cap-film-zone' }}
        >
          <HomeSceneCanvas>
            <CapabilityFilmStripScene />
          </HomeSceneCanvas>
        </Scene>

        {/* Shot 03: Scenes introduction follows ordinary page scroll. */}
        <Scene
          sceneId="about-scenes"
          className="home-scene home-scene--about-scenes"
          layout={{ width: '100%', height: 'auto', overflow: 'visible' }}
          style={{ minHeight: '100svh' }}
        >
          <AboutScenesScene />
        </Scene>

        {/* Shot 04: one native scroll zone owns the extensibility Canvas progress. */}
        <Scene
          sceneId="canvas-extensibility"
          className="home-scene home-scene--canvas-extensibility"
          layout={{ width: '100%', height: '100vh' }}
          scroll={{ zoneId: 'canvas-extensibility-zone' }}
        >
          <CanvasExtensibilityScene />
        </Scene>

        <Scene
          sceneId="editorial-index"
          className="home-scene home-scene--editorial-index"
          layout={{ width: '100%', height: 'auto', overflow: 'visible' }}
          style={{ minHeight: '100svh' }}
        >
          <EditorialIndexScene />
        </Scene>

        {/* Shot 06: Scroll-driven video (center-lock takeover, AnimateVideo scrubs frame by frame). */}
        <Scene
          sceneId="demo-video"
          className="home-scene home-scene--demo"
          layout={{ width: '100%', height: '100vh' }}
          scroll={{ zoneId: 'demo-video-zone' }}
          assets={{ preloadImages: ['/video.mp4'] }}
        >
          <HomeSceneCanvas>
            <DemoVideoScene />
          </HomeSceneCanvas>
        </Scene>

        {/* Shot 07: Cinema Entrance (lights out → phone lights up → iframe enters /drag). */}
        <Scene
          sceneId="cinema-entrance"
          className="home-scene home-scene--cinema"
          layout={{ width: '100%', height: '100vh' }}
          scroll={{ zoneId: 'cinema-entrance' }}
        >
          <Scene5Cinema />
        </Scene>
      </Cineview>
      <DragExperiencePreloader active={dragPreloadArmed} />
    </div>
  );
}
