import { CvAnimate } from './animate';
import { CvPause } from './pause';
import { CvScene } from './scene';
import { CvStage } from './stage';
import { CvVideo } from './video';

/** Parents first, so children find upgraded parents when they connect. */
export function define(): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get('cv-stage')) customElements.define('cv-stage', CvStage);
  if (!customElements.get('cv-scene')) customElements.define('cv-scene', CvScene);
  if (!customElements.get('cv-animate')) customElements.define('cv-animate', CvAnimate);
  if (!customElements.get('cv-pause')) customElements.define('cv-pause', CvPause);
  if (!customElements.get('cv-video')) customElements.define('cv-video', CvVideo);
}

export { CvAnimate, CvPause, CvScene, CvStage, CvVideo };
