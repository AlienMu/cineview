import { useCallback, useEffect, useState, useRef } from 'react';
import { CineView, Scene, type CineViewRef } from 'cineview';
import { PerfPanel } from 'cineview/dev';
import 'cineview/dev/style.css';
import { useI18n } from '../i18n';
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
 * Preload /drag experience: After CineView onReady, create a hidden iframe to fetch
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
  const { lang } = useI18n();
  const [dragPreloadArmed, setDragPreloadArmed] = useState(false);
  const [cineViewSource, setCineViewSource] = useState<CineViewRef | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const cineViewRef = useRef<CineViewRef>(null);
  const armDragPreload = useCallback((api: CineViewRef): void => {
    cineViewRef.current = api;
    setCineViewSource(api);
    setDragPreloadArmed(true);
  }, []);
  return (
    <div className="home-page">
      <label className="home-debug-toggle">
        <input
          type="checkbox"
          checked={debugEnabled}
          onChange={(event) => setDebugEnabled(event.target.checked)}
        />
        <span>{lang === 'zh' ? '参数调试' : 'Parameter debug'}</span>
      </label>
      {/* Site-wide background ribbon = App-level <BackgroundRibbon /> (original mechanism restored, 2026-08-13),
          no longer mounted from this page (see task-flow 2026-08-13 追加轮). */}
      <CineView
        ref={cineViewRef}
        designWidth={1440}
        mode="scroll"
        monitor={debugEnabled}
        debug={debugEnabled}
        scrollbar={{
          enabled: true,
          width: 8,
          autoHide: true,
          trackColor: 'rgba(26, 24, 20, 0.06)',
          thumbColor: 'var(--accent)',
          thumbHoverColor: 'rgba(255, 255, 255, 0.9)',
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
          scroll={{ zoneId: 'cap-film-zone', trigger: 'center-lock' }}
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
          scroll={{ zoneId: 'canvas-extensibility-zone', trigger: 'center-lock' }}
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
          scroll={{ zoneId: 'demo-video-zone', trigger: 'center-lock' }}
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
          scroll={{ zoneId: 'cinema-entrance', trigger: 'center-lock' }}
        >
          <Scene5Cinema />
        </Scene>
      </CineView>
      {debugEnabled ? (
        <PerfPanel
          source={cineViewSource}
          position="top-right"
          defaultExpanded={false}
          draggable
          enabled={debugEnabled}
          lang={lang}
        />
      ) : null}
      <DragExperiencePreloader active={dragPreloadArmed} />
    </div>
  );
}
