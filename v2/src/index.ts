/** Cineview 2.0 prototype entry: core + scroll input + first presets. Drag input loads on demand. */
import * as elements from './elements/define';
import { bootCss, captureBoot, HEAD_SNIPPET } from './boot';
import { isBrowser } from './platform';
import type {
  CvAnimateElement,
  CvFixedElement,
  CvPauseElement,
  CvSceneElement,
  CvStackElement,
  CvStageElement,
  CvVideoElement,
} from './types';

const { define } = elements;

/** An element class, typed by its public interface (instanceof, subclassing); internals stay out. */
export interface CvElementClass<T extends HTMLElement> {
  new (): T;
  readonly prototype: T;
}
export const CvStage: CvElementClass<CvStageElement> = elements.CvStage;
export const CvScene: CvElementClass<CvSceneElement> = elements.CvScene;
export const CvAnimate: CvElementClass<CvAnimateElement> = elements.CvAnimate;
export const CvStack: CvElementClass<CvStackElement> = elements.CvStack;
export const CvFixed: CvElementClass<CvFixedElement> = elements.CvFixed;
export const CvVideo: CvElementClass<CvVideoElement> = elements.CvVideo;
export const CvPause: CvElementClass<CvPauseElement> = elements.CvPause;

export { defineEffect, presetNames, type EffectDefinition } from './core/fx';
export type {
  CvAnimateElement,
  CvDirection,
  CvDragBlockedDetail,
  CvDragCancelDetail,
  CvDragEndDetail,
  CvDragStartDetail,
  CvErrorDetail,
  CvEventMap,
  CvFixedElement,
  CvPauseElement,
  CvProgressDetail,
  CvSceneChangeDetail,
  CvSceneElement,
  CvStackElement,
  CvStageElement,
  CvTimeline,
  CvTimeoutDetail,
  CvVideoElement,
  ErrorCode,
  TimelineFrame,
  TimelinePhase,
  TimelineSource,
} from './types';
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
