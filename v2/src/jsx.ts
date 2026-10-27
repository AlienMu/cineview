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
  CvFixedElement,
  CvPauseElement,
  CvSceneElement,
  CvStackElement,
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
  /** Override default short-swipe/long-drag release with slow ratio, fast ratio, speed (px/s). */
  threshold?: string;
  unit?: 'time' | 'percent';
  scale?: Num;
}

export interface CvSceneAttributes {
  zone?: Flag;
  /** Hold this scene while the next one covers it. */
  stack?: Flag;
  /** How a stacked scene looks while the next one covers it. */
  covered?: 'dim' | 'recede';
  /** Lay the content out in a row that moves sideways along scene time (a zone in scroll). */
  track?: 'x';
  /** At eye level, shown on the stage as `data-cv-theme` for the page's palette. */
  theme?: string;
  sequence?: Num;
  /** Present: wait for the scene's images and videos on the first screen; or a URL list. */
  preload?: Flag | string;
  drag?: 'off';
  /** Override this scene's drag release: slow ratio, fast ratio, speed (px/s). */
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
  /** clock: real time from current-Scene entry, replayed on reentry without adding zone distance. */
  on?: string;
  ease?: string;
  name?: string;
  duration?: Num;
  delay?: Num;
  after?: string;
  at?: string;
  stagger?: Flag | Num;
  /** Animate the text word by word or line by line, on a measured copy. */
  split?: 'words' | 'lines';
  target?: string;
  loop?: string;
  'loop-duration'?: Num;
  margin?: Num;
  replay?: Flag;
}

export interface CvStackAttributes {
  /** px between the cards' tops on the deck. */
  step?: Num;
  /** How a card looks while the next one covers it. */
  covered?: 'dim' | 'recede';
  /** Each card's arrival (zones, drag). */
  duration?: Num;
  delay?: Num;
  after?: string;
  name?: string;
  at?: string;
  ease?: string;
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
      'cv-stack': CvProps<CvStackElement, CvStackAttributes>;
      'cv-fixed': CvProps<CvFixedElement, object>;
      'cv-video': CvProps<CvVideoElement, CvVideoAttributes>;
      'cv-pause': CvProps<CvPauseElement, CvPauseAttributes>;
    }
  }
}
