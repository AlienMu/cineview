import type { TimelineFrame } from '../core/timeline';
import type { CvAnimate } from '../elements/animate';

/**
 * The contract between <cv-stage> and an input. The stage owns structure (registration, solving,
 * layers); the input owns motion: it decides each scene's time and position and is the only writer
 * while it runs.
 */
export interface InputEngine {
  /** Re-measure geometry. Never called from the frame loop. */
  refresh(): void;
  destroy(): void;
  currentIndex(): number;
  /** Navigate using the input's measured Scene positions. */
  goTo?(index: number, options?: { animated?: boolean }): void;
  /**
   * An element's frame when its time comes from this input (drag, zones), computed on read:
   * inputs send frames only to subscribed elements. Null: the element keeps its own.
   */
  frameOf?(a: CvAnimate): TimelineFrame | null;
}
