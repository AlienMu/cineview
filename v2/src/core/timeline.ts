/**
 * An element's timeline as the page sees it (`el.timeline`, plan v3 §3.6; replaces 1.x render-prop
 * children and the Animate timeline MotionValues). Inputs publish one frame per change: drag (every
 * element of the rendered scenes), zones (while in the activation window) and entrances played on
 * the clock (`enter`, `eye`). Elements without time effects (only `view`, `page` or signal sources)
 * stay idle: their progress is a position, not time.
 */
export type TimelinePhase = 'idle' | 'entering' | 'entered' | 'exiting' | 'exited';
export type TimelineSource =
  'idle' | 'gesture' | 'continuation' | 'programmatic' | 'scroll' | 'visibility' | 'clock';

/** One atomic sample of an element's timeline: progress, phase and what drives it. */
export interface TimelineFrame {
  /** 0–1 through the entrance, or through the departure while exiting. */
  progress: number;
  /** Departure under drag: negative when leaving backwards (to the previous scene). */
  signedProgress: number;
  phase: TimelinePhase;
  source: TimelineSource;
}

export const IDLE_FRAME: TimelineFrame = {
  progress: 0,
  signedProgress: 0,
  phase: 'idle',
  source: 'idle',
};

/** Read-only view of an element's timeline. */
export interface CvTimeline {
  /** The current frame (computed on read during a clock-played entrance or exit). */
  readonly frame: TimelineFrame;
  readonly progress: number;
  readonly signedProgress: number;
  readonly phase: TimelinePhase;
  readonly source: TimelineSource;
  /**
   * Called with each new frame, at most once per animation frame; returns the unsubscribe
   * function. During a clock-played entrance the element ticks only while it has subscribers.
   */
  subscribe(listener: (frame: TimelineFrame) => void): () => void;
}
