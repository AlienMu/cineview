/**
 * <cv-stage>: the root. Registration flows upward on connect (animate → scene → stage); the stage
 * rebuilds once per microtask after any change, then hands motion to its input. Drag input loads
 * on demand so scroll pages never pay for it.
 */
import { FirstScreenGate } from '../assets/first-screen';
import { adoptBoot } from '../boot';
import type { CvErrorDetail, ErrorCode } from '../core/errors';
import { onEffectDefined, type Source } from '../core/fx';
import { checkDragScene, checkStage } from '../dev/craft';
import type { InputEngine } from '../input/engine';
import { ScrollInput } from '../input/scroll';
import { ElementBase, onReducedMotionChange, prefersReducedMotion } from '../platform';
import { Clock } from '../render/clock';
import { parseCovered } from '../render/covered';
import type { CvStageElement } from '../types';
import type { CvScene } from './scene';

type Input = 'scroll' | 'drag';

export class CvStage extends ElementBase implements CvStageElement {
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
  /** The current scene's index, as last placed by the input; -1 before the first placement. */
  current = -1;
  /** The scene at eye level, whose `theme` the stage shows; -1 before the first placement. */
  eye = -1;
  private scheduled = false;
  private readySent = false;
  /** Settles `ready`; null once this connection's cv-ready has fired. */
  private settleReady: (() => void) | null = null;
  private readyPromise = this.pendingReady();
  /**
   * Errors (code and message per element) reported during the previous build and since the latest
   * one: an error that persists across rebuilds is dispatched once.
   */
  private errorsBefore = new WeakMap<Element, Set<string>>();
  private errorsNow = new WeakMap<Element, Set<string>>();
  private generation = 0;
  private live: HTMLDivElement | null = null;
  private frame: HTMLDivElement | null = null;

  /**
   * Settles with this connection's `cv-ready`, also when that already fired: listeners attached
   * late (React attaches `oncv-*` props of server-rendered markup only on a later render) await it.
   */
  get ready(): Promise<void> {
    return this.readyPromise;
  }

  private pendingReady(): Promise<void> {
    return new Promise((resolve) => (this.settleReady = resolve));
  }

  get input(): Input {
    return this.getAttribute('input') === 'drag' ? 'drag' : 'scroll';
  }

  // Writable, as React 19 assigns props the element has as properties.
  set input(value: Input) {
    this.setAttribute('input', value);
  }

  private stopListening: Array<() => void> = [];

  connectedCallback(): void {
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
    this.readySent = false;
    if (!this.settleReady) this.readyPromise = this.pendingReady();
    this.current = -1;
    this.teardown();
  }

  /**
   * Shadow root: an inner frame (100% wide, at most the design width, centred; the inline-size
   * container behind `--cv-unit`, from the first build) holding the default slot, and a polite live
   * region.
   */
  private ensureShadow(): void {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    // Host styles live here, not inline: the page can override them, nothing differs from
    // server-rendered markup when React hydrates, and switching input drops the drag ones.
    style.textContent =
      ':host{display:block;overflow-x:clip}' +
      // Vertical paging is ours; horizontal pans and pinch zoom stay native (1.x).
      // A gesture that reaches the end stays with the stage (lexicon #24).
      ':host([input=drag]){position:fixed;inset:0;overflow:hidden;overscroll-behavior:contain;touch-action:pan-x pinch-zoom;user-select:none}' +
      '.frame{position:relative;width:100%;max-width:calc(var(--cv-dw,750) * 1px);margin-inline:auto}' +
      '.sized{container-type:inline-size}' +
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
    this.frame = frame;
  }

  /**
   * Make the frame a size container once the content has been laid out in it. WebKit drops the
   * page's scroll offset when content is first laid out inside a new size container (the content
   * is skipped while the container is sized, so the page is briefly short): a restored or linked
   * position would be lost.
   */
  private sizeFrame(): void {
    const frame = this.frame;
    if (!frame || frame.classList.contains('sized')) return;
    void frame.offsetWidth;
    frame.classList.add('sized');
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

  set paused(value: boolean) {
    if (value) this.pause();
    else this.play();
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

  /**
   * An authoring error, in production too (plan v3 §3.6): a bubbling, cancelable `cv-error` on the
   * element at fault with `{ code, message, element }`. The development build also logs it unless
   * a listener cancels the event.
   */
  report(message: string, element: Element = this, code: ErrorCode = 'invalid-attribute'): void {
    const key = `${code} ${message}`;
    let now = this.errorsNow.get(element);
    if (!now) this.errorsNow.set(element, (now = new Set()));
    if (now.has(key)) return;
    now.add(key);
    if (this.errorsBefore.get(element)?.has(key)) return;
    const detail: CvErrorDetail = { code, message, element };
    const event = new CustomEvent('cv-error', { bubbles: true, cancelable: true, detail });
    const target = element.isConnected ? element : this;
    if (target.dispatchEvent(event) && __DEV__) {
      console.error(`[cineview] ${code}: ${message}`, element);
    }
  }

  /**
   * The input placed the current scene: `data-cv-current` on it, in-page links to scenes marked
   * (`aria-current` on the current one, `data-cv-before` / `data-cv-after` on the others), its
   * theme shown. A change after the first placement sets `data-cv-direction` on the stage and
   * dispatches `cv-leave` on the scene left, then `cv-enter` on the new one, both with
   * `{ from, to, direction }`.
   */
  setCurrent(index: number): void {
    const from = this.current;
    this.current = index;
    this.ordered.forEach((s, i) => s.toggleAttribute('data-cv-current', i === index));
    this.markLinks();
    this.showTheme(index);
    const scene = this.ordered[index];
    if (__DEV__ && scene && this.input === 'drag') {
      requestAnimationFrame(() => checkDragScene(scene));
    }
    if (from < 0 || from === index) return;
    const direction = index > from ? 'forward' : 'backward';
    this.setHeading(direction);
    const detail = { from, to: index, direction };
    this.ordered[from]?.dispatchEvent(new CustomEvent('cv-leave', { bubbles: true, detail }));
    this.ordered[index]?.dispatchEvent(new CustomEvent('cv-enter', { bubbles: true, detail }));
  }

  /**
   * Which way the reader moves (lexicon #20): `data-cv-direction` turns once the movement has gone
   * a dead zone the other way (scroll offset or drag page), and with every scene change.
   */
  setHeading(direction: 'forward' | 'backward'): void {
    if (this.getAttribute('data-cv-direction') !== direction) {
      this.setAttribute('data-cv-direction', direction);
    }
  }

  /**
   * Lexicon #41: the scene at eye level lends the stage its `theme` as `data-cv-theme`, at once (no
   * blend); a scene without one clears it. Scroll: the current scene (it crosses the middle of the
   * screen); drag: the scene past the middle of the page, before the slide lands. The page's CSS
   * swaps its palette on the attribute and transitions it (lexicon: about .7 s, none under reduced
   * motion). A server-rendered stage can carry the first scene's value from the start.
   */
  showTheme(index: number): void {
    this.eye = index;
    const theme = this.ordered[index]?.getAttribute('theme') ?? null;
    if (theme === this.getAttribute('data-cv-theme')) return;
    if (theme === null) this.removeAttribute('data-cv-theme');
    else this.setAttribute('data-cv-theme', theme);
  }

  /** A scene's `theme` changed: shown at once if it is the one at eye level. */
  themeChanged(scene: CvScene): void {
    if (this.eye >= 0 && this.ordered[this.eye] === scene) this.showTheme(this.eye);
  }

  private markLinks(): void {
    for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      let i: number | null = null;
      try {
        i = this.sceneIndexOf(decodeURIComponent(a.getAttribute('href')!.slice(1)));
      } catch {
        // Malformed escape in the href: not a scene link.
      }
      if (i === null) continue;
      if (i === this.current) a.setAttribute('aria-current', 'true');
      else if (a.getAttribute('aria-current') === 'true') a.removeAttribute('aria-current');
      a.toggleAttribute('data-cv-before', i < this.current);
      a.toggleAttribute('data-cv-after', i > this.current);
    }
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
    this.errorsBefore = this.errorsNow;
    this.errorsNow = new WeakMap();
    const input = this.input;
    const dw = Number(this.getAttribute('design-width'));
    if (dw > 0) this.style.setProperty('--cv-dw', String(dw));
    else this.style.removeProperty('--cv-dw');
    this.ordered = [...this.scenes].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    if (!this.ordered.length) {
      // Still parsing: scenes may follow (an async module can run before the markup is in).
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.invalidate(), { once: true });
      } else {
        this.report('<cv-stage> has no <cv-scene>', this, 'empty-stage');
      }
      return;
    }

    this.sizeFrame();
    const reducedMotion = prefersReducedMotion();
    if (this.paused) this.clock.pause();
    for (const scene of this.ordered) {
      const timeSource: Source = input === 'drag' || scene.isZone ? 'scene' : 'enter';
      for (const a of scene.animates) {
        a.build(a.plan({ timeSource, reducedMotion }, (m, code) => this.report(m, a, code)));
      }
      const track = scene.getAttribute('track');
      if (track !== null && !scene.isTrack) this.report(`track="${track}": expected x`, scene);
      scene.travel = scene.measureTravel();
      scene.watchTrack(scene.isTrack);
      for (const { error, element } of scene.solve(input === 'scroll')) {
        this.report(error.message, element, error.code);
      }
      scene.cover = parseCovered(scene.getAttribute('covered'), reducedMotion, (m, code) =>
        this.report(m, scene, code)
      );
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

  /** `cv-ready` once per connection, when the first build has rendered (1.x onReady). */
  private markReady(): void {
    const first = !this.readySent;
    this.readySent = true;
    const generation = this.generation;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (__DEV__ && generation === this.generation && this.isConnected) checkStage(this);
        if (!first || !this.isConnected) return;
        this.readyAt = performance.now();
        this.settleReady?.();
        this.settleReady = null;
        this.dispatchEvent(new CustomEvent('cv-ready', { bubbles: true }));
      })
    );
  }
}
