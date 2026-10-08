/**
 * Public types (plan v3 §3.6): the elements as the page sees them, their events, and the global
 * maps that make `document.querySelector('cv-stage')` and `addEventListener('cv-enter', …)` typed.
 * The element classes implement these interfaces; their other members are internal.
 */
import type { CvErrorDetail, ErrorCode } from './core/errors';
import type { CvTimeline, TimelineFrame, TimelinePhase, TimelineSource } from './core/timeline';

export type { CvErrorDetail, CvTimeline, ErrorCode, TimelineFrame, TimelinePhase, TimelineSource };

export type CvDirection = 'forward' | 'backward';

export interface CvStageElement extends HTMLElement {
  /** `input` attribute: `scroll` (default) or `drag`. */
  input: 'scroll' | 'drag';
  /** `paused` attribute: loops and clock-played entrances hold (WCAG 2.2.2). */
  paused: boolean;
  /** Index of the current scene; -1 before the first build. */
  readonly current: number;
  /**
   * Settles with this connection's `cv-ready`, also when it already fired (a new promise after the
   * stage is removed and added again). For listeners attached after the event, such as React
   * hydrating server-rendered markup.
   */
  readonly ready: Promise<void>;
  /** Go to a scene by index or id (of the scene or anything inside it). */
  goTo(target: number | string, options?: { animated?: boolean }): void;
  play(): void;
  pause(): void;
  /** Measure geometry again (after a layout change the stage cannot observe). */
  refresh(): void;
}

export type CvSceneElement = HTMLElement;

export interface CvAnimateElement extends HTMLElement {
  readonly timeline: CvTimeline;
}

export interface CvVideoElement extends CvAnimateElement {
  /** The current <video> node (replaced when the cached copy arrives); null before connection. */
  readonly video: HTMLVideoElement | null;
}

export type CvPauseElement = HTMLElement;

// ---- events ---------------------------------------------------------------------------------------

/** `cv-enter` (on the new scene) and `cv-leave` (on the scene left), scene indices. */
export interface CvSceneChangeDetail {
  from: number;
  to: number;
  direction: CvDirection;
}

/** `cv-progress`: first-screen loading (stage), a zone's time (scene), the drag page (stage). */
export type CvProgressDetail =
  | { kind: 'load'; progress: number; loaded: number; total: number }
  | { kind: 'zone'; index: number; progress: number }
  | { kind: 'page'; index: number; progress: number; direction: CvDirection | null };

export interface CvDragStartDetail {
  index: number;
  direction: CvDirection;
}

/** After the switch: `index` is the new scene; progress at release; element time of the target. */
export interface CvDragEndDetail {
  index: number;
  from: number;
  to: number;
  direction: CvDirection | null;
  progress: number;
  elapsed?: number;
  total?: number;
}

export interface CvDragCancelDetail {
  index: number;
  direction: CvDirection | null;
  progress: number;
}

export interface CvDragBlockedDetail {
  index: number;
  target: number;
  direction: CvDirection;
}

/** `cv-timeout` (cancelable: cancelled, the first screen keeps waiting). */
export interface CvTimeoutDetail {
  loaded: number;
  total: number;
}

/** Every event cineview dispatches. All bubble. */
export interface CvEventMap {
  'cv-ready': CustomEvent<null>;
  'cv-enter': CustomEvent<CvSceneChangeDetail>;
  'cv-leave': CustomEvent<CvSceneChangeDetail>;
  'cv-progress': CustomEvent<CvProgressDetail>;
  'cv-activate': CustomEvent<null>;
  'cv-deactivate': CustomEvent<null>;
  'cv-dragstart': CustomEvent<CvDragStartDetail>;
  'cv-dragend': CustomEvent<CvDragEndDetail>;
  'cv-dragcancel': CustomEvent<CvDragCancelDetail>;
  'cv-dragblocked': CustomEvent<CvDragBlockedDetail>;
  'cv-timeout': CustomEvent<CvTimeoutDetail>;
  'cv-error': CustomEvent<CvErrorDetail>;
  'cv-pause': CustomEvent<null>;
  'cv-play': CustomEvent<null>;
}

declare global {
  interface HTMLElementTagNameMap {
    'cv-stage': CvStageElement;
    'cv-scene': CvSceneElement;
    'cv-animate': CvAnimateElement;
    'cv-video': CvVideoElement;
    'cv-pause': CvPauseElement;
  }
  // Elements, document and window all see the bubbling events.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface GlobalEventHandlersEventMap extends CvEventMap {}
}
