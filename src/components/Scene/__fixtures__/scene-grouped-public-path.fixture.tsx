import { CineView, Scene, ScrollZone, Animate, Position } from '../../../index';

export function GroupedPublicPathFixture(): JSX.Element {
  return (
    <CineView
      config={{ width: 1440, height: 900, unit: 'px' }}
      mode="scroll"
      modes={{
        scroll: {
          direction: 'y',
          zoneTrigger: 'center-lock',
          replayOnReenter: true,
        },
      }}
    >
      <Scene
        sceneId="intro"
        layout={{ width: '100%', height: 'auto', anchor: 'top-center', overflow: 'visible' }}
        stack={{ mode: 'cover', zIndex: 2 }}
        transition={{ replayOnReenter: true }}
        assets={{ preloadImages: ['/hero.png'] }}
        callbacks={{
          onVisibilityChange: (detail) => {
            void detail.progress;
          },
        }}
      >
        <ScrollZone
          zoneId="hero-sequence"
          trigger="center-lock"
          replayOnReenter={true}
          budget="auto"
        >
          <Position at={{ x: 120, y: 80 }} layer={{ fixed: true }}>
            <Animate
              animateId="headline"
              enterAnimation="fade-in"
              duration={{ enter: 600 }}
              timeline={{ driver: 'scroll', delay: 120, phase: { start: 0.1, end: 0.8 } }}
            >
              <div>Headline</div>
            </Animate>
          </Position>
        </ScrollZone>
      </Scene>
    </CineView>
  );
}
