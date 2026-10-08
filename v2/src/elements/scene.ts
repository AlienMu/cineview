/**
 * <cv-scene>: one shot. Owns its timeline (solved from its animates in document order) and, in
 * scroll input, the sticky shell of a zone.
 */
import { parseMs, solveScene, type SceneSolution, type TimeError } from '../core/time';
import { ElementBase } from '../platform';
import { assignWindows } from '../render/layers';
import type { CvAnimate } from './animate';
import { CvStage } from './stage';

export class CvScene extends ElementBase {
  static readonly observedAttributes = ['zone', 'sequence'];

  stage: CvStage | null = null;
  animates = new Set<CvAnimate>();
  solution: SceneSolution = { entranceEnd: 0, total: 0, byIndex: [], errors: [] };
  /** Animates on the timeline, in the solver's index order. */
  timed: CvAnimate[] = [];
  ordered: CvAnimate[] = [];
  shell: HTMLElement | null = null;
  /** Document offset and height, measured in refresh(). */
  docTop = 0;
  height = 0;
  timeline: AnimationTimeline | null = null;
  nativeAttached = false;
  /** Inside the activation window (scroll: about one viewport around). */
  active = false;
  /** Zone time last reported as cv-progress (scroll); NaN before the first report. */
  zoneTime = Number.NaN;
  /** Zone time last published to element timelines (scroll). */
  frameTime = Number.NaN;
  /** Attached, but some eligible layers wait for native budget. */
  nativePending = false;
  nativeGeneration = 0;

  get isZone(): boolean {
    return this.hasAttribute('zone');
  }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent =
        ':host{display:block;position:relative}' +
        '.shell{position:relative;height:100%}' +
        ':host([zone]) .shell{position:sticky;top:0;height:100svh}';
      const shell = document.createElement('div');
      shell.className = 'shell';
      shell.setAttribute('part', 'shell');
      shell.append(document.createElement('slot'));
      root.append(style, shell);
      this.shell = shell;
    }
    const stage = this.closest('cv-stage');
    if (stage instanceof CvStage) {
      this.stage = stage;
      stage.registerScene(this);
    } else if (stage) {
      void customElements.whenDefined('cv-stage').then(() => {
        if (this.isConnected && !this.stage) this.connectedCallback();
      });
    }
  }

  attributeChangedCallback(_name: string, before: string | null, after: string | null): void {
    if (before !== after) this.stage?.invalidate();
  }

  disconnectedCallback(): void {
    this.stage?.unregisterScene(this);
    this.stage = null;
  }

  registerAnimate(a: CvAnimate): void {
    this.animates.add(a);
    this.stage?.invalidate();
  }

  unregisterAnimate(a: CvAnimate): void {
    this.animates.delete(a);
    this.stage?.invalidate();
  }

  /**
   * Solve the timeline in document order. Drag runs exits on the page travel instead of scene time
   * (1.x two-track), so they stay off the total there.
   */
  solve(exitsOnTimeline: boolean): Array<{ error: TimeError; element: Element }> {
    this.ordered = [...this.animates].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    this.timed = this.ordered.filter((a) => a.timed);
    const sequence = this.getAttribute('sequence');
    this.solution = solveScene(
      this.timed.map((a) => a.timeSpec()),
      { sequence: sequence === null ? null : parseMs(sequence, 0), exitsOnTimeline }
    );
    for (const a of this.ordered) a.solved = null;
    this.timed.forEach((a, i) => {
      a.solved = this.solution.byIndex[i] ?? null;
    });
    for (const a of this.ordered) assignWindows(a.layers, a.solved);
    return this.solution.errors.map((error) => ({
      error,
      element: this.timed[error.index] ?? this,
    }));
  }
}
