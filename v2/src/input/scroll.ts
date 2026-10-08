/**
 * Scroll input: the document scrolls natively; zones turn scroll distance into scene time
 * (1 px = 1 ms) and `view` sources follow each subject through the viewport.
 *
 * Output is hybrid (phase-0 measurement): compositor-eligible layers run as native scroll-driven
 * animations where supported, everything else is written directly once per frame. Geometry is
 * measured in refresh() and reused; the frame loop reads only the scroll offset and live rects of
 * `view(self)` subjects, all before any write.
 */
import { compositorEligible } from '../core/props';
import type { CvAnimate } from '../elements/animate';
import type { CvScene } from '../elements/scene';
import type { CvStage } from '../elements/stage';
import { platform, whenIdle, type IdleDeadlineLike } from '../platform';
import type { Clock } from '../render/clock';
import {
  clearLayer,
  layerKeyframes,
  progressIn,
  sceneKeyframes,
  writeLayer,
  type Layer,
} from '../render/layers';
import type { InputEngine } from './engine';

/** Native animations created per idle slice when the browser has no idle deadline. */
const ATTACH_CHUNK = 96;
/**
 * Most native scroll-driven animations alive at once. The browser services each live one on the
 * main thread every frame; past this, extra layers are written directly instead (phase-0 gate:
 * Chrome 256-per-scene mix, native 75% complete frames vs 96% direct). Tuned in P1.12.
 */
export const NATIVE_BUDGET = 256;

export class ScrollInput implements InputEngine {
  private scenes: CvScene[];
  private clock: Clock;
  private native: boolean;
  private vh = 0;
  private frameQueued = false;
  private io: IntersectionObserver | null = null;
  private nativeIo: IntersectionObserver | null = null;
  private ro: ResizeObserver;
  /** True when the frame loop has work in native mode (direct-write layers, zone loops). Cached. */
  private jsWork: boolean | null = null;
  /** Live native animations, against NATIVE_BUDGET. */
  private live = 0;

  constructor(stage: CvStage) {
    this.scenes = stage.ordered;
    this.clock = stage.clock;
    this.native = !stage.hasAttribute('fallback') && typeof platform.ViewTimeline === 'function';
    this.refresh();
    if (this.native) this.startNative();
    this.bindEnter();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
    this.ro = new ResizeObserver(() => this.onResize());
    for (const s of this.scenes) this.ro.observe(s);
    this.frame();
  }

  destroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    this.io?.disconnect();
    this.nativeIo?.disconnect();
    this.ro.disconnect();
  }

  refresh(): void {
    this.vh = window.innerHeight;
    const y = window.scrollY;
    for (const s of this.scenes) {
      const r = s.getBoundingClientRect();
      s.docTop = r.top + y;
      s.height = r.height;
    }
  }

  currentIndex(): number {
    const y = window.scrollY + this.vh / 2;
    let index = 0;
    this.scenes.forEach((s, i) => {
      if (s.docTop <= y) index = i;
    });
    return index;
  }

  private onResize = (): void => {
    this.refresh();
    this.queueFrame();
  };

  /** Direct-write layers and zone loop gates follow scroll here; pure native pages skip the frame. */
  private onScroll = (): void => {
    if (this.native && !this.hasJsWork()) return;
    this.queueFrame();
  };

  private hasJsWork(): boolean {
    if (this.jsWork !== null) return this.jsWork;
    this.jsWork = this.scenes.some((s) =>
      s.ordered.some(
        (a) =>
          (s.isZone && a.loopItems.length > 0) ||
          a.layers.some((l) => !l.native && (l.source === 'scene' || l.source === 'view'))
      )
    );
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

  /** All reads first (scroll offset, live rects of view(self) subjects), then all writes. */
  private frame(): void {
    const y = window.scrollY;
    const vh = this.vh;
    const work: Array<{ layer: Layer; p: number; px: number }> = [];
    const loops: Array<{ a: CvAnimate; on: boolean }> = [];
    for (const s of this.scenes) {
      const near = s.docTop < y + vh * 2 && s.docTop + s.height > y - vh;
      if (!near) {
        if (s.isZone) for (const a of s.ordered) if (a.looping) loops.push({ a, on: false });
        continue;
      }
      const t = s.isZone ? Math.min(Math.max(y - s.docTop, 0), s.solution.total) : 0;
      const sceneView = (y + vh - s.docTop) / (vh + s.height);
      for (const a of s.ordered) {
        // Zone loops run once the entrance is complete (1.x: playable phase and visible).
        if (s.isZone && a.loopItems.length) loops.push({ a, on: !a.solved || t >= a.solved.end });
        let selfView = Number.NaN;
        for (const layer of a.layers) {
          // Native layers are driven by the compositor; skip them without further work.
          if (layer.native) continue;
          if (layer.source === 'scene') {
            const w = layer.window;
            if (!w) continue;
            work.push({
              layer,
              p: progressIn(t, w.start, w.end),
              px: layer.exitEffects.length ? progressIn(t, w.exitStart, w.exitEnd) : 0,
            });
          } else if (layer.source === 'view') {
            let v = sceneView;
            if (layer.subject === 'self') {
              if (Number.isNaN(selfView)) selfView = this.selfView(a, vh);
              v = selfView;
            }
            work.push({ layer, p: Math.min(Math.max(v, 0), 1), px: 0 });
          }
        }
      }
    }
    for (const w of work) writeLayer(w.layer, w.p, w.px);
    for (const { a, on } of loops) {
      if (on) a.startLoops(this.clock);
      else a.stopLoops();
    }
  }

  private selfView(a: CvAnimate, vh: number): number {
    // Elements inside a sticky shell move with it; measure live in the read phase (plan v3 §8).
    const r = a.getBoundingClientRect();
    return (vh - r.top) / (vh + r.height);
  }

  /**
   * Native path: scroll-driven WAAPI animations, one per eligible layer, alive only for scenes
   * inside an activation window (two viewports ahead) and only up to NATIVE_BUDGET at once.
   * Chrome services every live scroll-driven animation on the main thread each frame, so far
   * scenes must not keep animations alive (phase-0: 3.9 s vs 1.2 s main-thread time at 512/scene).
   */
  private startNative(): void {
    const VT = platform.ViewTimeline!;
    for (const s of this.scenes) s.timeline = new VT({ subject: s, axis: 'block' });
    this.nativeIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const s = entry.target as CvScene;
          if (entry.isIntersecting) this.attachNative(s);
          else this.detachNative(s);
        }
        // Budget freed by a detach goes to scenes still waiting, nearest first.
        this.refill();
      },
      { rootMargin: '200% 0px 200% 0px' }
    );
    for (const s of this.scenes) this.nativeIo.observe(s);
  }

  /** Eligible layers of a scene still on direct writes. */
  private pendingNative(s: CvScene): Array<{ a: CvAnimate; layer: Layer }> {
    const out: Array<{ a: CvAnimate; layer: Layer }> = [];
    for (const a of s.ordered) {
      for (const layer of a.layers) {
        if (layer.native || !compositorEligible(layer.used)) continue;
        if ((layer.source === 'scene' && s.isZone && layer.window) || layer.source === 'view') {
          out.push({ a, layer });
        }
      }
    }
    return out;
  }

  private attachNative(s: CvScene): void {
    if (s.nativeAttached && !s.nativePending) return;
    s.nativeAttached = true;
    s.nativePending = false;
    const generation = ++s.nativeGeneration;
    const VT = platform.ViewTimeline!;
    const jobs = this.pendingNative(s);
    // Create in idle time, a little at a time; a stale batch from an earlier attach never runs.
    const step = (deadline?: IdleDeadlineLike): void => {
      if (!s.nativeAttached || s.nativeGeneration !== generation) return;
      let made = 0;
      while (jobs.length && (deadline ? deadline.timeRemaining() > 2 : made < ATTACH_CHUNK)) {
        if (this.live >= NATIVE_BUDGET) {
          // Over budget: the rest stay on direct writes until a detach frees room.
          s.nativePending = true;
          break;
        }
        const { a, layer } = jobs.shift()!;
        if (layer.native) continue;
        const w = layer.window;
        const zone = layer.source === 'scene' && w !== null;
        const timeline = zone
          ? s.timeline
          : layer.subject === 'self'
            ? new VT({ subject: a, axis: 'block' })
            : s.timeline;
        const keyframes = zone ? sceneKeyframes(layer, w, s.solution.total) : layerKeyframes(layer);
        clearLayer(layer);
        layer.native = layer.el.animate(keyframes, {
          timeline,
          rangeStart: zone ? 'contain 0%' : 'cover 0%',
          rangeEnd: zone ? 'contain 100%' : 'cover 100%',
          fill: 'both',
          easing: 'linear',
        } as KeyframeAnimationOptions);
        a.natives.push(layer.native);
        this.live++;
        made++;
      }
      this.jsWork = null;
      if (jobs.length && !s.nativePending) whenIdle(step);
    };
    whenIdle(step);
  }

  private detachNative(s: CvScene): void {
    s.nativeAttached = false;
    s.nativePending = false;
    s.nativeGeneration++;
    this.jsWork = null;
    for (const a of s.ordered) {
      for (const layer of a.layers) {
        if (!layer.native) continue;
        layer.native.cancel();
        layer.native = null;
        this.live--;
      }
      a.natives = a.natives.filter((n) => n.playState !== 'idle');
    }
    // Direct writes take over at once, so a cancelled layer never shows its unanimated state.
    this.queueFrame();
  }

  private refill(): void {
    if (this.live >= NATIVE_BUDGET) return;
    const y = window.scrollY;
    const waiting = this.scenes
      .filter((s) => s.nativeAttached && s.nativePending)
      .sort((p, q) => Math.abs(p.docTop - y) - Math.abs(q.docTop - y));
    for (const s of waiting) this.attachNative(s);
  }

  /** Normal-flow entrances (and loops): IntersectionObserver trigger, fresh clock animations. */
  private bindEnter(): void {
    const pending: CvAnimate[] = [];
    for (const s of this.scenes) {
      for (const a of s.ordered) {
        if (!a.enterLayers.length && !(a.loopItems.length && !s.isZone)) continue;
        for (const layer of a.enterLayers) writeLayer(layer, 0, 0);
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

  private playEnter(a: CvAnimate): void {
    if (a.entered) return;
    a.entered = true;
    const played: Animation[] = [];
    for (const layer of a.enterLayers) {
      const w = layer.window;
      clearLayer(layer);
      const anim = layer.el.animate(layerKeyframes(layer), {
        duration: w ? w.end - w.start : 600,
        delay: w ? w.start : 0,
        fill: 'both',
        easing: 'linear',
      });
      a.natives.push(this.clock.add(anim));
      played.push(anim);
    }
    // Loops start once the entrance has played (1.x: loop after enterAnimation completes).
    if (a.loopItems.length) {
      void Promise.all(played.map((p) => p.finished)).then(
        () => {
          if (a.isConnected && a.entered) a.startLoops(this.clock);
        },
        () => undefined
      );
    }
  }
}
