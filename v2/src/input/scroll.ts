/**
 * Scroll input: the document scrolls natively; zones turn scroll distance into scene time
 * (1 px = 1 ms) and `view` sources follow each subject through the viewport.
 *
 * Output is hybrid (phase-0 measurement): compositor-eligible layers run as native scroll-driven
 * animations where supported, everything else is written directly once per frame. Geometry is
 * measured in refresh() and reused; the frame loop reads only the scroll offset and live rects of
 * `view(self)` subjects, all before any write.
 */
import { sampleKeyframes } from '../core/fx';
import type { CvAnimate } from '../elements/animate';
import type { CvScene } from '../elements/scene';
import type { CvStage } from '../elements/stage';
import { progressIn, sceneKeyframes, writeLayer, type Layer } from '../render/layers';
import { platform, whenIdle, type IdleDeadlineLike } from '../platform';
import type { InputEngine } from './engine';

/** Properties Chrome can animate on the compositor (no pixel-moving filters, no clip-path). */
const COMPOSITOR_PROPS = new Set(['x', 'y', 'yp', 'scale', 'rotate', 'opacity']);
const compositorEligible = (layer: Layer): boolean =>
  [...layer.used].every((p) => COMPOSITOR_PROPS.has(p));
const ATTACH_CHUNK = 96;

export class ScrollInput implements InputEngine {
  private scenes: CvScene[];
  private native: boolean;
  private vh = 0;
  private frameQueued = false;
  private io: IntersectionObserver | null = null;
  private nativeIo: IntersectionObserver | null = null;
  private ro: ResizeObserver;
  /** True when any layer currently needs direct writes (non-eligible, or native not yet attached). Cached. */
  private jsWork: boolean | null = null;

  constructor(stage: CvStage) {
    this.scenes = stage.ordered;
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

  /** Direct-write layers (fallback mode, or main-thread-only layers in native mode) follow scroll here. */
  private onScroll = (): void => {
    if (this.native && !this.hasJsWork()) return;
    this.queueFrame();
  };

  private hasJsWork(): boolean {
    if (this.jsWork !== null) return this.jsWork;
    this.jsWork = false;
    outer: for (const s of this.scenes) {
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

  /** All reads first (scroll offset, live rects of view(self) subjects), then all writes. */
  private frame(): void {
    const y = window.scrollY;
    const vh = this.vh;
    const work: Array<{ layer: Layer; p: number; px: number }> = [];
    for (const s of this.scenes) {
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
   * activation window (two viewports ahead). Chrome services every live scroll-driven animation on
   * the main thread each frame, so far scenes must not keep animations alive (phase-0 measurement:
   * 3.9 s vs 1.2 s main-thread time at 512/scene without the window).
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
      },
      { rootMargin: '200% 0px 200% 0px' }
    );
    for (const s of this.scenes) this.nativeIo.observe(s);
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
    const step = (deadline?: IdleDeadlineLike): void => {
      if (!s.nativeAttached || s.nativeGeneration !== generation) return;
      let made = 0;
      while (jobs.length && (deadline ? deadline.timeRemaining() > 2 : made < ATTACH_CHUNK)) {
        jobs.shift()!();
        made++;
      }
      this.jsWork = null;
      if (jobs.length) whenIdle(step);
    };
    whenIdle(step);
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
    for (const s of this.scenes) {
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

  private playEnter(a: CvAnimate): void {
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
}
