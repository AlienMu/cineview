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
  /** Inputs that page (drag) navigate themselves; scroll input leaves this to the stage. */
  goTo?(index: number, options?: { animated?: boolean }): void;
}
