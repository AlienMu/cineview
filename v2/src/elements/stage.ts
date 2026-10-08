/**
 * <cv-stage>: the root. Registration flows upward on connect (animate → scene → stage); the stage
 * rebuilds once per microtask after any change, then hands motion to its input. Drag input loads
 * on demand so scroll pages never pay for it.
 */
import { onEffectDefined, type Source } from '../core/fx';
import type { InputEngine } from '../input/engine';
import { ScrollInput } from '../input/scroll';
import { ElementBase, onReducedMotionChange, prefersReducedMotion } from '../platform';
import { Clock } from '../render/clock';
import type { CvScene } from './scene';

type Input = 'scroll' | 'drag';

export class CvStage extends ElementBase {
  static readonly observedAttributes = ['input', 'fallback', 'paused', 'design-width', 'margin'];

  scenes = new Set<CvScene>();
  ordered: CvScene[] = [];
  readyAt = 0;
  engine: InputEngine | null = null;
  /** Entrances played on time and loops; paused together. */
  readonly clock = new Clock();
  private scheduled = false;
  private generation = 0;

  get input(): Input {
    return this.getAttribute('input') === 'drag' ? 'drag' : 'scroll';
  }

  private stopListening: Array<() => void> = [];

  connectedCallback(): void {
    this.style.display = 'block';
    this.style.overflowX = 'clip';
    if (!this.stopListening.length) {
      this.stopListening = [
        // A preset defined after the page built may be one this stage uses.
        onEffectDefined(() => this.invalidate()),
        onReducedMotionChange(() => this.invalidate()),
      ];
    }
    this.invalidate();
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    if (before === after) return;
    if (name === 'paused') {
      if (after === null) this.clock.play();
      else this.clock.pause();
      this.dispatchEvent(
        new CustomEvent(after === null ? 'cv-play' : 'cv-pause', { bubbles: true })
      );
      return;
    }
    if (this.isConnected) this.invalidate();
  }

  disconnectedCallback(): void {
    for (const stop of this.stopListening) stop();
    this.stopListening = [];
    this.teardown();
  }

  /** Pause entrances played on time and loops (scroll and drag still move scenes). */
  pause(): void {
    this.setAttribute('paused', '');
  }

  play(): void {
    this.removeAttribute('paused');
  }

  get paused(): boolean {
    return this.hasAttribute('paused');
  }

  registerScene(s: CvScene): void {
    this.scenes.add(s);
    this.invalidate();
  }

  unregisterScene(s: CvScene): void {
    this.scenes.delete(s);
    this.invalidate();
  }

  invalidate(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.isConnected) void this.build();
    });
  }

  report(message: string, element: Element = this): void {
    this.dispatchEvent(
      new CustomEvent('cv-error', { bubbles: true, detail: { message, element } })
    );
  }

  /** Measure geometry once. Never called from the frame loop. */
  refresh(): void {
    this.engine?.refresh();
  }

  currentIndex(): number {
    return this.engine?.currentIndex() ?? 0;
  }

  private teardown(): void {
    this.generation++;
    this.engine?.destroy();
    this.engine = null;
    for (const s of this.scenes) for (const a of s.animates) a.cancelNatives();
  }

  private async build(): Promise<void> {
    this.teardown();
    const input = this.input;
    this.ordered = [...this.scenes].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    const reducedMotion = prefersReducedMotion();
    if (this.paused) this.clock.pause();
    for (const scene of this.ordered) {
      const timeSource: Source = input === 'drag' || scene.isZone ? 'scene' : 'enter';
      for (const a of scene.animates) {
        a.build(a.plan({ timeSource, reducedMotion }, (m) => this.report(m, a)));
      }
      for (const { error, element } of scene.solve(input === 'scroll')) {
        this.report(error.message, element);
      }
      if (input === 'scroll' && scene.isZone) {
        scene.style.height = `calc(100svh + ${scene.solution.total}px)`;
      }
    }

    if (input === 'drag') {
      const generation = this.generation;
      const { createDragEngine } = await import('../input/drag');
      // A later build (or a disconnect) superseded this one while the chunk loaded.
      if (generation !== this.generation || !this.isConnected) return;
      this.engine = createDragEngine(this);
    } else {
      this.engine = new ScrollInput(this);
    }
    this.markReady();
  }

  private markReady(): void {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.readyAt = performance.now();
        this.dispatchEvent(new CustomEvent('cv-ready', { bubbles: true }));
      })
    );
  }
}
