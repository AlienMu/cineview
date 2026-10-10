/**
 * JSX for React 19 (plan v3 §3.6), opt in with `import type {} from 'cineview/jsx'` (or list it
 * under `types`). React 19 renders custom elements natively: string props become attributes,
 * `on<event>` props become listeners for that exact event name, so `oncv-enter={…}` listens to
 * `cv-enter`. Props that name an element property are assigned as properties; the elements keep
 * those in step with their attributes (`input`, `paused`, `after`).
 *
 * Server rendering: React 19 (19.2) does not attach `on…` props of custom elements while it
 * hydrates server markup, only on a later render that sets them again (facebook/react#35446). In
 * hydrated components, add listeners in an effect through a ref, and await `stage.ready` for the
 * moment `cv-ready` may already have passed. State attributes (`data-cv-*`) that a build writes
 * before React hydrates an element show up in React's development-build mismatch report; React
 * leaves them in place.
 */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type {
  CvAnimateElement,
  CvEventMap,
  CvPauseElement,
  CvSceneElement,
  CvStageElement,
  CvVideoElement,
} from './types';

type Flag = boolean | '';
type Num = number | string;

/** Every cineview event bubbles, so any element (and any ancestor) can listen. */
export type CvEventProps = {
  [K in keyof CvEventMap as `on${K}`]?: (event: CvEventMap[K]) => void;
};

export interface CvStageAttributes {
  input?: 'scroll' | 'drag';
  fallback?: Flag;
  paused?: boolean;
  'design-width'?: Num;
  margin?: Num;
  'first-scene-timeout'?: Num;
  'transition-duration'?: Num;
  threshold?: string;
  unit?: 'time' | 'percent';
  scale?: Num;
}

export interface CvSceneAttributes {
  zone?: Flag;
  /** Hold this scene while the next one covers it. */
  stack?: Flag;
  sequence?: Num;
  /** Present: wait for the scene's images and videos on the first screen; or a URL list. */
  preload?: Flag | string;
  drag?: 'off';
  threshold?: string;
  unit?: 'time' | 'percent';
  scale?: Num;
}

export interface CvAnimateAttributes {
  fx?: string;
  from?: string;
  to?: string;
  exit?: string;
  'exit-duration'?: Num;
  on?: string;
  ease?: string;
  name?: string;
  duration?: Num;
  delay?: Num;
  after?: string;
  at?: string;
  stagger?: Flag | Num;
  target?: string;
  loop?: string;
  'loop-duration'?: Num;
  margin?: Num;
  replay?: Flag;
}

export interface CvVideoAttributes extends CvAnimateAttributes {
  src?: string;
  /** Seconds, `from to`. */
  range?: string;
  /** Whole-file preload into the blob cache: on unless `none`. */
  preload?: Flag | 'none';
  poster?: string;
  'playback-rate'?: Num;
}

export interface CvPauseAttributes {
  /** id of the stage to control; default: the closest stage, else the first. */
  for?: string;
}

export type CvProps<T, A> = DetailedHTMLProps<HTMLAttributes<T>, T> & A & CvEventProps;

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'cv-stage': CvProps<CvStageElement, CvStageAttributes>;
      'cv-scene': CvProps<CvSceneElement, CvSceneAttributes>;
      'cv-animate': CvProps<CvAnimateElement, CvAnimateAttributes>;
      'cv-video': CvProps<CvVideoElement, CvVideoAttributes>;
      'cv-pause': CvProps<CvPauseElement, CvPauseAttributes>;
    }
  }
}
