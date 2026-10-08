/**
 * <cv-scene>: one shot. Owns its timeline (solved from its animates in document order) and, in
 * scroll input, the sticky shell of a zone.
 */
import { solveScene, type SceneSolution } from '../core/time';
import { ElementBase } from '../platform';
import type { CvAnimate } from './animate';
import { CvStage } from './stage';

export class CvScene extends ElementBase {
  stage: CvStage | null = null;
  animates = new Set<CvAnimate>();
  solution: SceneSolution = { entranceEnd: 0, total: 0, byIndex: [], errors: [] };
  ordered: CvAnimate[] = [];
  shell: HTMLElement | null = null;
  /** Document offset and height, measured in refresh(). */
  docTop = 0;
  height = 0;
  timeline: AnimationTimeline | null = null;
  nativeAttached = false;
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

  /** Solve the timeline in document order. */
  solve(): void {
    this.ordered = [...this.animates].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    this.solution = solveScene(this.ordered.map((a) => a.timeSpec()));
    this.ordered.forEach((a, i) => {
      a.solved = this.solution.byIndex[i] ?? null;
    });
  }
}
