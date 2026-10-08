/**
 * <cv-stage>, <cv-scene>, <cv-animate>.
 *
 * Registration flows upward on connect (animate → scene → stage); the stage
 * rebuilds once per microtask after any change. Per-frame work never reads
 * layout: geometry is measured in refresh() and reused until the next one.
 */
import { parseFromTo, parseFx, sampleKeyframes, type Effect, type Source } from './fx';
import {
  buildLayers,
  progressIn,
  sceneKeyframes,
  writeLayer,
  type Layer,
  type LayerKind,
} from './layers';
import { parseAfter, solveScene, type SceneSolution, type Solved, type TimeSpec } from './time';

const num = (el: Element, name: string, fallback: number): number => {
  const v = el.getAttribute(name);
  if (v === null || v === '') return fallback;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

type LayerPlan = Omit<Layer, 'el' | 'used' | 'frame' | 'scratch' | 'last'>;

/** Platform APIs missing from older DOM typings (ViewTimeline: Chrome 115 / Safari 26; rIC: not in Safari). */
type ViewTimelineCtor = new (options: {
  subject: Element;
  axis?: 'block' | 'inline';
}) => AnimationTimeline;
interface IdleDeadlineLike {
  timeRemaining(): number;
}
interface PlatformExtras {
  ViewTimeline?: ViewTimelineCtor;
  requestIdleCallback?: (
    cb: (deadline: IdleDeadlineLike) => void,
    options?: { timeout: number }
  ) => number;
}
const platform = window as unknown as PlatformExtras;

/** Properties Chrome can animate on the compositor (no pixel-moving filters, no clip-path). */
const COMPOSITOR_PROPS = new Set(['x', 'y', 'yp', 'scale', 'rotate', 'opacity']);
const compositorEligible = (layer: Layer): boolean =>
  [...layer.used].every((p) => COMPOSITOR_PROPS.has(p));
const ATTACH_CHUNK = 96;

export class CvAnimate extends HTMLElement {
  scene: CvScene | null = null;
  layers: Layer[] = [];
  solved: Solved | null = null;
  natives: Animation[] = [];
  /** Effects that play on a clock once the element enters (normal flow). */
  enterLayers: Layer[] = [];
  entered = false;

  connectedCallback(): void {
    const scene = this.closest('cv-scene');
    if (!scene) return;
    if (scene instanceof CvScene) {
      this.scene = scene;
      scene.registerAnimate(this);
    } else {
      // Parent not upgraded yet (defined later): register once it is.
      void customElements.whenDefined('cv-scene').then(() => {
        if (this.isConnected && !this.scene) this.connectedCallback();
      });
    }
  }

  disconnectedCallback(): void {
    this.cancelNatives();
    this.scene?.unregisterAnimate(this);
    this.scene = null;
  }

  timeSpec(): TimeSpec {
    return {
      name: this.getAttribute('name'),
      duration: num(this, 'duration', 600),
      delay: num(this, 'delay', 0),
      after: parseAfter(this.getAttribute('after')),
      exitDuration: this.hasAttribute('exit-to') ? num(this, 'exit-duration', 300) : 0,
    };
  }

  /** Decide layers from attributes and context (plan v3 §3.5 precedence). */
  plan(context: { timeSource: Source }, report: (m: string) => void): LayerPlan[] {
    const effects: Effect[] = parseFx(this.getAttribute('fx'), report);
    const raw = parseFromTo(this.getAttribute('from'), this.getAttribute('to'));
    if (raw) effects.push(raw);
    const exitRaw = parseFromTo(null, this.getAttribute('exit-to'));
    const explicit = this.getAttribute('on');
    const explicitSource = explicit?.startsWith('view') ? 'view' : (explicit as Source | null);
    const subject: 'scene' | 'self' = explicit === 'view(self)' ? 'self' : 'scene';

    const bySource = new Map<Source, Effect[]>();
    for (const e of effects) {
      const source: Source = explicitSource ?? (e.rate ? e.defaultSource : context.timeSource);
      const list = bySource.get(source) ?? [];
      list.push(e);
      bySource.set(source, list);
    }

    const plans: LayerPlan[] = [];
    for (const [source, list] of bySource) {
      const kind: LayerKind = source === 'view' ? 'space' : 'time';
      const nonClip = list.filter((e) => Object.keys(e.tracks).some((k) => k !== 'clip'));
      const clips = list.filter((e) => e.tracks.clip);
      const exits = kind === 'time' && exitRaw ? [exitRaw] : [];
      if (nonClip.length || exits.length) {
        plans.push({
          kind,
          source,
          subject,
          effects: nonClip,
          exitEffects: exits,
          clipOnly: false,
        });
      }
      if (clips.length) {
        plans.push({
          kind: 'clip',
          source,
          subject,
          effects: clips,
          exitEffects: [],
          clipOnly: true,
        });
      }
    }
    return plans;
  }

  build(plans: LayerPlan[]): void {
    this.cancelNatives();
    this.layers = buildLayers(this, plans);
    this.enterLayers = this.layers.filter((l) => l.source === 'enter');
    this.entered = false;
  }

  cancelNatives(): void {
    for (const a of this.natives) a.cancel();
    this.natives = [];
  }
}

export class CvScene extends HTMLElement {
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

type Input = 'scroll' | 'drag';

export interface DragEngine {
  refresh(): void;
  destroy(): void;
  currentIndex(): number;
}

export class CvStage extends HTMLElement {
  scenes = new Set<CvScene>();
  ordered: CvScene[] = [];
  readyAt = 0;
  private scheduled = false;
  private built = false;
  private native = false;
  private vh = 0;
  private frameQueued = false;
  private io: IntersectionObserver | null = null;
  private nativeIo: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  drag: DragEngine | null = null;

  get input(): Input {
    return this.getAttribute('input') === 'drag' ? 'drag' : 'scroll';
  }

  connectedCallback(): void {
    this.style.display = 'block';
    this.style.overflowX = 'clip';
    this.invalidate();
  }

  disconnectedCallback(): void {
    this.teardown();
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

  private teardown(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    this.io?.disconnect();
    this.nativeIo?.disconnect();
    this.ro?.disconnect();
    this.drag?.destroy();
    this.drag = null;
    for (const s of this.scenes) for (const a of s.animates) a.cancelNatives();
  }

  private async build(): Promise<void> {
    this.teardown();
    const input = this.input;
    this.ordered = [...this.scenes].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    this.native =
      input === 'scroll' &&
      !this.hasAttribute('fallback') &&
      typeof platform.ViewTimeline === 'function';

    for (const scene of this.ordered) {
      const timeSource: Source = input === 'drag' || scene.isZone ? 'scene' : 'enter';
      for (const a of scene.animates) {
        a.build(a.plan({ timeSource }, (m) => this.report(m, a)));
      }
      scene.solve();
      for (const e of scene.solution.errors) this.report(e, scene);
      if (input === 'scroll' && scene.isZone) {
        scene.style.height = `calc(100svh + ${scene.solution.total}px)`;
      }
    }

    if (input === 'drag') {
      const { createDragEngine } = await import('./drag');
      this.drag = createDragEngine(this);
    } else {
      this.bindScroll();
    }
    this.built = true;
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

  // ---- scroll input -------------------------------------------------------

  private bindScroll(): void {
    this.refresh();
    if (this.native) this.startNative();
    this.bindEnter();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
    this.ro = new ResizeObserver(() => this.onResize());
    for (const s of this.ordered) this.ro.observe(s);
    this.frame();
  }

  /** Measure geometry once. Never called from the frame loop. */
  refresh(): void {
    if (this.input === 'drag') {
      this.drag?.refresh();
      return;
    }
    this.vh = window.innerHeight;
    const y = window.scrollY;
    for (const s of this.ordered) {
      const r = s.getBoundingClientRect();
      s.docTop = r.top + y;
      s.height = r.height;
    }
  }

  private onResize = (): void => {
    if (!this.built) return;
    this.refresh();
    this.queueFrame();
  };

  /** Direct-write layers (fallback mode, or main-thread-only layers in native mode) follow scroll here. */
  private onScroll = (): void => {
    if (this.native && !this.hasJsWork()) return;
    this.queueFrame();
  };

  /** True when any layer currently needs direct writes (non-eligible, or native not yet attached). Cached. */
  private jsWork: boolean | null = null;
  private hasJsWork(): boolean {
    if (this.jsWork !== null) return this.jsWork;
    this.jsWork = false;
    outer: for (const s of this.ordered) {
      for (const a of s.ordered) {
        for (const l of a.layers) {
          if (!l.native && (l.source === 'scene' || l.source === 'view')) {
            this.jsWork = true;
            break outer;
          }
        }
      }
    }
    return this.jsWork;
  }

  private queueFrame(): void {
    if (this.frameQueued) return;
    this.frameQueued = true;
    requestAnimationFrame(() => {
      this.frameQueued = false;
      this.frame();
    });
  }

  /** Fallback path: all reads first (scroll offset, live rects of view(self) subjects), then all writes. */
  private frame(): void {
    const y = window.scrollY;
    const vh = this.vh;
    const work: Array<{ layer: Layer; p: number; px: number }> = [];
    for (const s of this.ordered) {
      const near = s.docTop < y + vh * 2 && s.docTop + s.height > y - vh;
      if (!near) continue;
      const t = s.isZone ? Math.min(Math.max(y - s.docTop, 0), s.solution.total) : 0;
      const sceneView = (y + vh - s.docTop) / (vh + s.height);
      for (const a of s.ordered) {
        let selfView = Number.NaN;
        for (const layer of a.layers) {
          // Native layers are driven by the compositor; skip them without further work.
          if (layer.native) continue;
          if (layer.source === 'scene') {
            const w = a.solved;
            if (!w) continue;
            work.push({
              layer,
              p: progressIn(t, w.start, w.end),
              px: layer.exitEffects.length ? progressIn(t, w.exitStart, w.exitEnd) : -1,
            });
          } else if (layer.source === 'view') {
            let v = sceneView;
            if (layer.subject === 'self') {
              if (Number.isNaN(selfView)) selfView = this.selfView(a, vh);
              v = selfView;
            }
            work.push({ layer, p: Math.min(Math.max(v, 0), 1), px: -1 });
          }
        }
      }
    }
    for (const w of work) writeLayer(w.layer, w.p, w.px);
  }

  private selfView(a: CvAnimate, vh: number): number {
    // Elements inside a sticky shell move with it; measure live in the read phase (plan v3 §8).
    const r = a.getBoundingClientRect();
    return (vh - r.top) / (vh + r.height);
  }

  /**
   * Native path: scroll-driven WAAPI animations, one per layer, created only for scenes inside an
   * activation window (about one viewport above and below). Chrome services every live scroll-driven
   * animation on the main thread each frame, so far scenes must not keep animations alive
   * (phase-0 measurement: 3.9 s vs 1.2 s main-thread time at 512/scene without the window).
   */
  private startNative(): void {
    const VT = platform.ViewTimeline!;
    for (const s of this.ordered) s.timeline = new VT({ subject: s, axis: 'block' });
    this.nativeIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const s = entry.target as CvScene;
          if (entry.isIntersecting) this.attachNative(s);
          else this.detachNative(s);
        }
      },
      // Two viewports ahead: creation happens in idle time well before the scene is visible.
      { rootMargin: '200% 0px 200% 0px' }
    );
    for (const s of this.ordered) this.nativeIo.observe(s);
  }

  private attachNative(s: CvScene): void {
    if (s.nativeAttached) return;
    s.nativeAttached = true;
    const generation = ++s.nativeGeneration;
    const VT = platform.ViewTimeline!;
    const sceneTimeline = s.timeline;
    const jobs: Array<() => void> = [];
    for (const a of s.ordered) {
      for (const layer of a.layers) {
        // Main-thread-only properties stay on direct writes even in native mode (phase-0 measurement).
        if (!compositorEligible(layer)) continue;
        if (layer.source === 'scene' && s.isZone && a.solved) {
          const w = a.solved;
          jobs.push(() => {
            layer.native = layer.el.animate(sceneKeyframes(layer, w, s.solution.total), {
              timeline: sceneTimeline,
              rangeStart: 'contain 0%',
              rangeEnd: 'contain 100%',
              fill: 'both',
              easing: 'linear',
            } as KeyframeAnimationOptions);
            a.natives.push(layer.native);
          });
        } else if (layer.source === 'view') {
          jobs.push(() => {
            const timeline =
              layer.subject === 'self' ? new VT({ subject: a, axis: 'block' }) : sceneTimeline;
            layer.native = layer.el.animate(sampleKeyframes(layer.effects, layer.clipOnly), {
              timeline,
              rangeStart: 'cover 0%',
              rangeEnd: 'cover 100%',
              fill: 'both',
              easing: 'linear',
            } as KeyframeAnimationOptions);
            a.natives.push(layer.native);
          });
        }
      }
    }
    // Create in idle time, a little at a time; a stale batch from an earlier attach never runs.
    const idle = platform.requestIdleCallback?.bind(window);
    const step = (deadline?: IdleDeadlineLike): void => {
      if (!s.nativeAttached || s.nativeGeneration !== generation) return;
      let made = 0;
      while (jobs.length && (deadline ? deadline.timeRemaining() > 2 : made < ATTACH_CHUNK)) {
        jobs.shift()!();
        made++;
      }
      this.jsWork = null;
      if (jobs.length) {
        if (idle) idle(step, { timeout: 200 });
        else setTimeout(step, 0);
      }
    };
    if (idle) idle(step, { timeout: 200 });
    else setTimeout(step, 0);
  }

  private detachNative(s: CvScene): void {
    s.nativeAttached = false;
    s.nativeGeneration++;
    this.jsWork = null;
    for (const a of s.ordered) {
      a.cancelNatives();
      for (const layer of a.layers) layer.native = null;
    }
  }

  /** Normal-flow entrances: IntersectionObserver trigger, fresh clock animation (plan v3 §6). */
  private bindEnter(): void {
    const pending: CvAnimate[] = [];
    for (const s of this.ordered) {
      for (const a of s.ordered) {
        if (!a.enterLayers.length) continue;
        for (const layer of a.enterLayers) writeLayer(layer, 0, -1);
        pending.push(a);
      }
    }
    if (!pending.length) return;
    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const a = entry.target as CvAnimate;
          this.io?.unobserve(a);
          this.playEnter(a);
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    for (const a of pending) this.io.observe(a);
  }

  playEnter(a: CvAnimate): void {
    if (a.entered) return;
    a.entered = true;
    const w = a.solved;
    const duration = w ? w.end - w.start : 600;
    const delay = w ? w.start : 0;
    for (const layer of a.enterLayers) {
      layer.el.style.cssText = '';
      layer.last.clear();
      const anim = layer.el.animate(sampleKeyframes(layer.effects, layer.clipOnly), {
        duration,
        delay,
        fill: 'both',
        easing: 'linear',
      });
      a.natives.push(anim);
    }
  }

  currentIndex(): number {
    if (this.drag) return this.drag.currentIndex();
    const y = window.scrollY + this.vh / 2;
    let index = 0;
    this.ordered.forEach((s, i) => {
      if (s.docTop <= y) index = i;
    });
    return index;
  }
}

/** Parents first, so children find upgraded parents when they connect. */
export function define(): void {
  if (!customElements.get('cv-stage')) customElements.define('cv-stage', CvStage);
  if (!customElements.get('cv-scene')) customElements.define('cv-scene', CvScene);
  if (!customElements.get('cv-animate')) customElements.define('cv-animate', CvAnimate);
}
