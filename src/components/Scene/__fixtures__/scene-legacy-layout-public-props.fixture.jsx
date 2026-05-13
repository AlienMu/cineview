// @ts-check
import { Scene } from '../../../index';

export function LegacySceneLayoutPublicPropsFixture() {
  return (
    <Scene sceneWidth="80vw" sceneHeight="auto" sceneAnchor="top-center" sceneOverflow="visible">
      <div>Legacy scene layout props should not be public</div>
    </Scene>
  );
}
