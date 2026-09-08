import { useRef } from 'react';
import { Animate, CineView, Position, Scene, type CineViewScrollRef } from 'cineview';

/** Browser acceptance fixture for horizontal document flow and scene-owned zones. */
export default function HorizontalScrollFixture(): React.JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const apiRef = useRef<CineViewScrollRef>(null);
  const params = new URLSearchParams(window.location.search);
  const screenSizing = params.get('sizing') === 'screen';
  const zoneWidth = params.get('zone') === 'narrow' ? '50vw' : '100vw';

  return (
    <main ref={rootRef} data-horizontal-fixture style={{ height: '100vh', color: '#fff' }}>
      <CineView
        ref={apiRef}
        mode="scroll"
        direction="x"
        designWidth={1000}
        sceneSizing={screenSizing ? 'screen' : 'content'}
        scrollbar={{ enabled: true, autoHide: false, ariaLabel: 'Horizontal acceptance scroll' }}
        callbacks={{
          onReady: () => {
            if (rootRef.current) rootRef.current.dataset.ready = 'true';
          },
          onZoneProgress: (detail) => {
            if (rootRef.current) rootRef.current.dataset.zoneProgress = String(detail.progress);
          },
        }}
      >
        <Scene
          sceneId="full"
          layout={{ width: '100%', height: '100vh' }}
          style={{ background: '#15354d' }}
        >
          <h1>Horizontal scroll acceptance</h1>
          <p>Full width scene</p>
        </Scene>
        <Scene
          sceneId="half"
          layout={{ width: '50%', height: '100vh' }}
          style={{ background: '#523459' }}
        >
          <h2>Half width scene</h2>
        </Scene>
        <aside data-flow-content style={{ width: '75%', height: '100vh', background: '#435321' }}>
          Ordinary child at 75% width
        </aside>
        <Scene
          sceneId="pixels"
          layout={{ width: 320, height: '100vh' }}
          style={{ background: '#643829' }}
        >
          <h2>320 pixel scene</h2>
        </Scene>
        <Scene
          sceneId="intrinsic"
          layout={{ width: 'auto', height: '100vh' }}
          style={{ background: '#173f3b' }}
        >
          <div data-intrinsic-content style={{ width: '130vw' }}>
            Content width: 130vw
          </div>
        </Scene>
        <Scene
          sceneId="zone"
          layout={{ width: zoneWidth, height: '100vh' }}
          scroll={{ zoneId: 'horizontal-zone', trigger: 'center-lock' }}
          style={{ background: '#262947' }}
        >
          <Position fixed at={{ x: 24, y: 24 }}>
            <div data-horizontal-fixed>Scene fixed layer</div>
          </Position>
          <div style={{ display: 'grid', gap: 12, paddingTop: 100 }}>
            {Array.from({ length: 4 }, (_, index) => (
              <Animate
                key={index}
                animateId={`horizontal-animation-${index}`}
                enterAnimation={{ initial: { opacity: 0, x: -80 }, animate: { opacity: 1, x: 0 } }}
                duration={{ enter: 1200 }}
              >
                <div data-horizontal-animation={index}>Concurrent animation {index + 1}</div>
              </Animate>
            ))}
          </div>
        </Scene>
        <Scene
          sceneId="tail"
          layout={{ width: '100vw', height: '100vh' }}
          style={{ background: '#173622' }}
        >
          <h2>Final scene</h2>
        </Scene>
      </CineView>
    </main>
  );
}
