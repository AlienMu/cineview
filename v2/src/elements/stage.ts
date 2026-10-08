/**
 * <cv-stage>: the root. Registration flows upward on connect (animate → scene → stage); the stage
 * rebuilds once per microtask after any change, then hands motion to its input. Drag input loads
 * on demand so scroll pages never pay for it.
 */
import { FirstScreenGate } from '../assets/first-screen';
import { adoptBoot } from '../boot';
import { onEffectDefined, type Source } from '../core/fx';
import type { InputEngine } from '../input/engine';
import { ScrollInput } from '../input/scroll';
import { ElementBase, onReducedMotionChange, prefersReducedMotion } from '../platform';
import { Clock } from '../render/clock';
import type { CvScene } from './scene';

type Input = 'scroll' | 'drag';

export class CvStage extends ElementBase {
  static readonly observedAttributes = [
    'input',
    'fallback',
    'paused',
    'design-width',
    'margin',
    'first-scene-timeout',
    'transition-duration',
    'threshold',
    'unit',
    'scale',
  ];

  scenes = new Set<CvScene>();
  ordered: CvScene[] = [];
  readyAt = 0;
  engine: InputEngine | null = null;
  /** Entrances played on time and loops; paused together. */
  readonly clock = new Clock();
  /** The first-screen gate, created by the first build and kept across rebuilds. */
  firstScreen: FirstScreenGate | null = null;
  /**
   * Elapsed time of the CSS-first entrance adopted by the first build (ms): the first screen's
   * entrance starts that far in. 0 afterwards.
   */
  bootOffset = 0;
  private scheduled = false;
  private generation = 0;
  private live: HTMLDivElement | null = null;

  get input(): Input {
    return this.getAttribute('input') === 'drag' ? 'drag' : 'scroll';
  }

  private stopListening: Array<() => void> = [];

  connectedCallback(): void {
    this.style.display = 'block';
    this.style.overflowX = 'clip';
    this.ensureShadow();
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
    this.firstScreen?.dispose();
    this.firstScreen = null;
    this.booted = false;
    this.teardown();
  }

  /**
   * Shadow root: an inner frame (100% wide, at most the design width, centred; the inline-size
   * container behind `--cv-unit`) holding the default slot, and a polite live region.
   */
  private ensureShadow(): void {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent =
      '.frame{position:relative;width:100%;max-width:calc(var(--cv-dw,750) * 1px);margin-inline:auto;container-type:inline-size}' +
      ':host([input=drag]) .frame{height:100%}' +
      '.live{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}';
    const frame = document.createElement('div');
    frame.className = 'frame';
    frame.setAttribute('part', 'frame');
    frame.append(document.createElement('slot'));
    const live = document.createElement('div');
    live.className = 'live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    root.append(style, frame, live);
    this.live = live;
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

  /**
   * Go to a scene by index or id (of the scene or anything inside it). Drag pages to it; scroll
   * scrolls its top into view. Unknown targets are ignored.
   */
  goTo(target: number | string, options: { animated?: boolean } = {}): void {
    const index = typeof target === 'number' ? target : this.sceneIndexOf(target);
    if (index === null || !this.engine) return;
    if (this.engine.goTo) {
      this.engine.goTo(index, options);
      return;
    }
    this.ordered[Math.max(0, Math.min(this.ordered.length - 1, Math.round(index)))]?.scrollIntoView(
      {
        behavior: options.animated === false ? 'instant' : 'smooth',
        block: 'start',
      }
    );
  }

  /** Index of the scene that is, or contains, the element with this id. */
  sceneIndexOf(id: string): number | null {
    if (!id) return null;
    const scene = document.getElementById(id)?.closest('cv-scene');
    const i = scene ? this.ordered.indexOf(scene as CvScene) : -1;
    return i >= 0 ? i : null;
  }

  /** Polite screen-reader announcement (scene changes under drag). */
  announce(text: string): void {
    const live = this.live;
    if (!live) return;
    // Same text twice in a row (A → B → A) must still be read: clear, then set on the next frame.
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = text));
  }

  private teardown(): void {
    this.generation++;
    this.engine?.destroy();
    this.engine = null;
    for (const s of this.scenes) for (const a of s.animates) a.cancelNatives();
  }

  private async build(): Promise<void> {
    const resumeAt = this.engine && this.input === 'drag' ? this.engine.currentIndex() : undefined;
    this.teardown();
    const input = this.input;
    const dw = Number(this.getAttribute('design-width'));
    if (dw > 0) this.style.setProperty('--cv-dw', String(dw));
    else this.style.removeProperty('--cv-dw');
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

    const first = this.firstBuild();
    if (input === 'drag') {
      const generation = this.generation;
      const { createDragEngine } = await import('../input/drag');
      // A later build (or a disconnect) superseded this one while the chunk loaded.
      if (generation !== this.generation || !this.isConnected) return;
      if (first)
        this.startFirstScreen(
          resumeAt ?? this.sceneIndexOf(decodeURIComponent(location.hash.slice(1))) ?? 0
        );
      this.engine = createDragEngine(this, resumeAt);
    } else {
      if (first) this.startFirstScreen(0);
      this.engine = new ScrollInput(this);
    }
    // Same task as the engine's first writes and clock animations: the CSS-first entrance and the
    // hidden boot state hand over without a frame in between.
    this.bootOffset = 0;
    for (const s of this.ordered) for (const a of s.animates) a.setAttribute('data-cv-live', '');
    this.markReady();
  }

  private booted = false;

  /** True once per connection: the build that opens the page. */
  private firstBuild(): boolean {
    if (this.booted) return false;
    this.booted = true;
    return true;
  }

  /** Gate the opening scene on its assets and adopt a CSS-first entrance running on it. */
  private startFirstScreen(index: number): void {
    const scene = this.ordered[index] ?? null;
    const timeout = Number(this.getAttribute('first-scene-timeout') ?? 3000);
    this.firstScreen = new FirstScreenGate(this, scene, Number.isFinite(timeout) ? timeout : 3000);
    const offset = adoptBoot();
    this.bootOffset = index === 0 ? offset : 0;
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
