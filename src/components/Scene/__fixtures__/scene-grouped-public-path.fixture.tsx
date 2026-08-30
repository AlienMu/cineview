import { CineView, Scene, Animate, Position } from '../../../index';

export function GroupedPublicPathFixture(): JSX.Element {
  return (
    <CineView designWidth={1440} mode="scroll" direction={'y'} zoneTrigger={'center-lock'}>
      <Scene
        sceneId="intro"
        layout={{
          width: '100%',
          height: 'auto',
          anchor: 'top-center',
          overflow: 'visible',
          overlap: 'cover',
          zIndex: 2,
        }}
        scroll={{
          zoneId: 'hero-sequence',
          trigger: 'center-lock',
        }}
        transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out' }}
        assets={{ preloadImages: ['/hero.png'] }}
        callbacks={{
          onVisibilityChange: (detail) => {
            void detail.progress;
          },
        }}
      >
        <Position at={{ x: 120, y: 80 }} fixed>
          <Animate
            animateId="headline"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
            timeline={{ delay: 120, phase: { start: 0.1, end: 0.8 } }}
          >
            <div>Headline</div>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
}
