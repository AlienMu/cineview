import { Scene } from '../../../index';

export function LegacyScenePublicPropsFixture(): JSX.Element {
  return (
    <Scene
      mode="scroll"
      slideDirection="y"
      slideDuration={900}
      sceneWidth="80vw"
      sceneHeight="auto"
      sceneAnchor="top-center"
      sceneZIndex={3}
      sceneOverflow="visible"
      sceneStackMode="cover"
      scrollSpeed={1.25}
      scrollControlled={true}
      scrollCommitThreshold={0.35}
      scrollReleaseDuration={180}
      scrollLockToSingleScene={true}
      scrollEnterLength={120}
      scrollHoldLength={480}
      scrollExitLength={120}
      preloadImages={['/legacy-hero.png']}
    >
      <div>Legacy scene props should not be public</div>
    </Scene>
  );
}
