/** Cineview 2.0 prototype entry: core + scroll input + first presets. Drag input loads on demand. */
import { define } from './elements/define';
import { bootCss, captureBoot, HEAD_SNIPPET } from './boot';
import { isBrowser } from './platform';

export { CvAnimate, CvPause, CvScene, CvStage, CvVideo } from './elements/define';
export { defineEffect, presetNames, type EffectDefinition } from './core/fx';
/** For build tools and servers: the boot stylesheet and the <head> snippet that sets `.cv-js`. */
export { bootCss, HEAD_SNIPPET };

/**
 * Boot styles: pages should load cineview.css in <head> (plan v3 §10), so they apply before the first
 * layout of static HTML. Without it the module injects the same rules when it loads.
 */
if (isBrowser && !document.getElementById('cv-boot-style') && !hasBootSheet()) {
  const style = document.createElement('style');
  style.id = 'cv-boot-style';
  style.textContent = bootCss();
  document.head.append(style);
}

function hasBootSheet(): boolean {
  return getComputedStyle(document.documentElement).getPropertyValue('--cv-boot').trim() === '1';
}

if (isBrowser) {
  const restore = captureBoot();
  define();
  restore();
} else {
  define();
}
