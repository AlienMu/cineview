/** Cineview 2.0 prototype entry: core + scroll input + first presets. Drag input loads on demand. */
import { define } from './elements/define';
import { isBrowser } from './platform';

export { CvAnimate, CvScene, CvStage } from './elements/define';
export { defineEffect, presetNames, type EffectDefinition } from './core/fx';

/**
 * Boot styles. In the product these ship in cineview.css (loaded in <head>) so they apply before the
 * first layout of static HTML; the prototype injects them at module load. Drag scenes beyond the first
 * two start skipped, so the first layout does not pay for every scene (phase-0 heavy fixture).
 */
if (isBrowser && !document.getElementById('cv-boot-style')) {
  const style = document.createElement('style');
  style.id = 'cv-boot-style';
  style.textContent =
    'cv-stage,cv-scene,cv-animate{display:block}' +
    'cv-stage[input=drag]{position:fixed;inset:0;overflow:hidden}' +
    'cv-stage[input=drag]>cv-scene{position:absolute;inset:0}' +
    'cv-stage[input=drag]>cv-scene:nth-of-type(n+3){content-visibility:hidden}';
  document.head.append(style);
}

define();
