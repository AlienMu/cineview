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
import type { TimelineFrame } from '../media/ownership';
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

/** Resizes that change only the height while scrolling are the mobile URL bar: defer them. */
const GESTURE_QUIET_MS = 250;
import type { InputEngine } from './engine';
import { EnterController, parseMargins } from './enter';

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
  private stage: CvStage;
  private clock: Clock;
  private native: boolean;
  private vh = 0;
  private vw = 0;
  /** Real px per design px (stage width / design-width), for visibility margins. */
  private unit = 1;
  private docHeight = 0;
  private frameQueued = false;
  private destroyed = false;
  private nativeIo: IntersectionObserver | null = null;
  private activeIo: IntersectionObserver;
  /** Scenes crossing the viewport's middle line (current scene). */
  private centerIo: IntersectionObserver;
  private atCenter = new Set<number>();
  /** Zones inside the activation window: their progress events need the frame loop. */
  private activeZones = 0;
  private ro: ResizeObserver;
  private enter: EnterController;
  private pageTimeline: AnimationTimeline | null = null;
  private lastScroll = 0;
  private deferred = 0;
  /** True when the frame loop has work in native mode (direct-write layers, zone loops). Cached. */
  private jsWork: boolean | null = null;
  /** Live native animations, against NATIVE_BUDGET. */
  private live = 0;

  constructor(stage: CvStage) {
    this.stage = stage;
    this.scenes = stage.ordered;
    this.clock = stage.clock;
    this.native = !stage.hasAttribute('fallback') && typeof platform.ViewTimeline === 'function';
    const gate = stage.firstScreen;
    this.enter = new EnterController(this.clock, {
      held: (): boolean => gate?.held ?? false,
      offset: stage.bootOffset,
    });
    if (gate?.held) {
      gate.whenReleased((): void => {
        if (!this.destroyed) this.queueFrame();
      });
    }
    this.refresh();
    if (this.native) this.startNative();
    this.bindEnter();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('load', this.onLoad);
    document.fonts?.ready.then(this.onLoad, () => undefined);
    this.ro = new ResizeObserver(() => this.onResize());
    for (const s of this.scenes) this.ro.observe(s);
    // Activation window (plan v3 §7, scroll): about one viewport around; events and media only.
    this.activeIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const s = entry.target as CvScene;
          s.toggleAttribute('data-cv-active', entry.isIntersecting);
          if (entry.isIntersecting === s.active) continue;
          s.active = entry.isIntersecting;
          if (!s.active) for (const a of s.ordered) a.stopLoops();
          for (const a of s.ordered) a.activated(s.active);
          s.dispatchEvent(
            new CustomEvent(s.active ? 'cv-activate' : 'cv-deactivate', { bubbles: true })
          );
        }
        const zones = this.scenes.filter((s) => s.isZone && s.active).length;
        // A zone leaving the window (also by a jump) gets its end value reported.
        if (zones !== this.activeZones || zones) this.queueFrame();
        this.activeZones = zones;
      },
      { rootMargin: '100% 0px 100% 0px' }
    );
    for (const s of this.scenes) this.activeIo.observe(s);
    // Current scene (1.x): the one under the middle of the viewport; at a shared edge the later
    // one; in a gap between scenes (other content) the last one stays current.
    this.centerIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const i = this.scenes.indexOf(entry.target as CvScene);
          if (entry.isIntersecting) this.atCenter.add(i);
          else this.atCenter.delete(i);
        }
        if (this.atCenter.size) this.stage.setCurrent(Math.max(...this.atCenter));
        else if (this.stage.current < 0) this.stage.setCurrent(this.currentIndex());
      },
      { rootMargin: '-50% 0px -50% 0px' }
    );
    for (const s of this.scenes) this.centerIo.observe(s);
    this.frame();
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('load', this.onLoad);
    clearTimeout(this.deferred);
    this.nativeIo?.disconnect();
    this.activeIo.disconnect();
    this.centerIo.disconnect();
    this.ro.disconnect();
    this.enter.destroy();
    for (const s of this.scenes) s.active = false;
  }

  refresh(): void {
    this.vh = window.innerHeight;
    this.vw = window.innerWidth;
    const design = Number(this.stage.getAttribute('design-width')) || 750;
    this.unit = (this.stage.clientWidth || this.vw) / design;
    this.docHeight = document.documentElement.scrollHeight;
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
    // A height-only change during a gesture is the mobile browser bar; measuring mid-gesture
    // makes view progress jump, so wait until scrolling settles.
    if (window.innerWidth === this.vw && performance.now() - this.lastScroll < GESTURE_QUIET_MS) {
      clearTimeout(this.deferred);
      this.deferred = window.setTimeout(this.onResize, GESTURE_QUIET_MS);
      return;
    }
    this.refresh();
    this.queueFrame();
  };

  private onLoad = (): void => {
    this.refresh();
    this.queueFrame();
  };

  /** Direct-write layers, gates and zone loop gates follow scroll here; pure native pages skip it. */
  private onScroll = (): void => {
    this.lastScroll = performance.now();
    if (this.native && !this.hasJsWork() && !this.activeZones) return;
    this.queueFrame();
  };

  private hasJsWork(): boolean {
    if (this.jsWork !== null) return this.jsWork;
    this.jsWork =
      this.enter.size > 0 ||
      this.scenes.some((s) =>
        s.ordered.some(
          (a) =>
            (s.isZone && (a.loopItems.length > 0 || a.frameSink !== null)) ||
            a.layers.some(
              (l) =>
                !l.native && (l.source === 'scene' || l.source === 'view' || l.source === 'page')
            )
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

  /** All reads first (scroll offset, live rects), then all writes. */
  private frame(): void {
    const y = window.scrollY;
    const vh = this.vh;
    const work: Array<{ layer: Layer; p: number; px: number }> = [];
    const loops: Array<{ a: CvAnimate; on: boolean }> = [];
    const frames: Array<{ a: CvAnimate; t: number }> = [];
    const zones: Array<{ s: CvScene; index: number; t: number }> = [];
    const isNear = (s: CvScene): boolean => s.docTop < y + vh * 2 && s.docTop + s.height > y - vh;
    const gated = this.enter.measure((a) => a.scene !== null && isNear(a.scene));
    const page = Math.min(Math.max(y / Math.max(1, this.docHeight - vh), 0), 1);
    this.scenes.forEach((s, index) => {
      if (s.isZone)
        zones.push({ s, index, t: Math.min(Math.max(y - s.docTop, 0), s.solution.total) });
    });
    for (const s of this.scenes) {
      const near = isNear(s);
      if (!near) {
        if (s.isZone) for (const a of s.ordered) if (a.looping) loops.push({ a, on: false });
        continue;
      }
      const t = s.isZone ? Math.min(Math.max(y - s.docTop, 0), s.solution.total) : 0;
      const sceneView = (y + vh - s.docTop) / (vh + s.height);
      for (const a of s.ordered) {
        // Zone loops run once the entrance is complete (1.x: playable phase and visible).
        if (s.isZone && a.loopItems.length) loops.push({ a, on: !a.solved || t >= a.solved.end });
        if (s.isZone && a.frameSink) frames.push({ a, t });
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
          } else if (layer.source === 'page') {
            work.push({ layer, p: page, px: 0 });
          }
        }
      }
    }
    for (const w of work) writeLayer(w.layer, w.p, w.px);
    for (const { a, t } of frames) a.sendFrame(zoneFrame(a, t));
    this.enter.apply(gated, vh, this.unit);
    for (const { a, on } of loops) {
      if (on) a.startLoops(this.clock);
      else a.stopLoops();
    }
    // Last: listeners may read layout.
    for (const z of zones) reportZone(z.s, z.index, z.t);
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
    const ST = platform.ScrollTimeline;
    if (ST) this.pageTimeline = new ST({ source: document.documentElement, axis: 'block' });
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
        if (
          (layer.source === 'scene' && s.isZone && layer.window) ||
          layer.source === 'view' ||
          (layer.source === 'page' && this.pageTimeline)
        ) {
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
        const page = layer.source === 'page';
        const timeline = zone
          ? s.timeline
          : page
            ? this.pageTimeline
            : layer.subject === 'self'
              ? new VT({ subject: a, axis: 'block' })
              : s.timeline;
        const keyframes = zone ? sceneKeyframes(layer, w, s.solution.total) : layerKeyframes(layer);
        clearLayer(layer);
        layer.native = layer.el.animate(keyframes, {
          timeline,
          ...(page
            ? {}
            : {
                rangeStart: zone ? 'contain 0%' : 'cover 0%',
                rangeEnd: zone ? 'contain 100%' : 'cover 100%',
              }),
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

  /** Normal-flow entrances and loops: the visibility gate machine (input/enter.ts). */
  private bindEnter(): void {
    const margins = parseMargins(this.stage.getAttribute('margin'), [50, 50]);
    this.scenes.forEach((s, i) => {
      if (s.isZone) return;
      for (const a of s.ordered) this.enter.add(a, { first: i === 0, margins });
    });
    this.enter.link();
  }
}

/**
 * A zone's state for the page (1.x onZoneProgress / onZoneEnter / onZoneLeave): `data-cv-stuck`
 * while its shell is pinned and between its ends, and `cv-progress` `{ kind: 'zone', index,
 * progress }` on the scene when it moved more than half a pixel or reached an end.
 */
function reportZone(s: CvScene, index: number, t: number): void {
  const total = s.solution.total;
  s.toggleAttribute('data-cv-stuck', t > 0.5 && t < total - 0.5);
  const last = s.zoneTime;
  const atEnd = t === 0 || t === total;
  if (!Number.isNaN(last) && Math.abs(t - last) <= 0.5 && !(atEnd && t !== last)) return;
  s.zoneTime = t;
  s.dispatchEvent(
    new CustomEvent('cv-progress', {
      bubbles: true,
      detail: { kind: 'zone', index, progress: total > 0 ? t / total : 0 },
    })
  );
}

/** An element's timeline frame in a zone: scene time from scroll (for <cv-video>). */
function zoneFrame(a: CvAnimate, t: number): TimelineFrame {
  const w = a.solved;
  if (!w) return { progress: 0, signedProgress: 0, phase: 'idle', source: 'scroll' };
  if (w.exitDuration > 0 && t > w.exitStart) {
    const px = progressIn(t, w.exitStart, w.exitEnd);
    return {
      progress: px,
      signedProgress: px,
      phase: px >= 1 ? 'exited' : 'exiting',
      source: 'scroll',
    };
  }
  const p = progressIn(t, w.start, w.end);
  return {
    progress: p,
    signedProgress: p,
    phase: p >= 1 ? 'entered' : 'entering',
    source: 'scroll',
  };
}
