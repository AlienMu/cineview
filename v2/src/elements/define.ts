import { CvAnimate } from './animate';
import { CvScene } from './scene';
import { CvStage } from './stage';

/** Parents first, so children find upgraded parents when they connect. */
export function define(): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get('cv-stage')) customElements.define('cv-stage', CvStage);
  if (!customElements.get('cv-scene')) customElements.define('cv-scene', CvScene);
  if (!customElements.get('cv-animate')) customElements.define('cv-animate', CvAnimate);
}

export { CvAnimate, CvScene, CvStage };
