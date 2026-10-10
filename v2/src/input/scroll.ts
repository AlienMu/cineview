/**
 * Scroll input: the document scrolls natively; zones turn scroll distance into scene time
 * (1 px = 1 ms), `view` sources follow each subject through the viewport, stacked scenes stick
 * until the next scene covers them (dimming or receding meanwhile with `covered`), and `track`
 * rows move sideways on zone time.
 *
 * Output is hybrid (phase-0 measurement): compositor-eligible layers run as native scroll-driven
 * animations where supported, everything else is written directly once per frame. Geometry is
 * measured in refresh() and reused; the frame loop reads only the scroll offset and live rects of
 * element subjects (`view(self)`, `view(#id)`), all before any write.
 */
import { compositorEligible } from '../core/props';
import type { TimelineFrame, TimelinePhase } from '../core/timeline';
import { rangeCss, viewProgress } from '../core/view';
import type { CvAnimate } from '../elements/animate';
import type { CvScene } from '../elements/scene';
import type { CvStack } from '../elements/stack';
import type { CvStage } from '../elements/stage';
import { blink, platform, whenIdle, type IdleDeadlineLike } from '../platform';
import type { Clock } from '../render/clock';
import {
  clearCover,
  COVER_RANGE,
  coverKeyframes,
  writeCover,
  type CoverLook,
} from '../render/covered';
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
 * Most native scroll-driven animations alive at once in Blink, which services each live one on the
 * main thread every frame; past this, extra layers are written directly instead (phase-0 gate:
 * Chrome 256-per-scene mix, native 75% complete frames vs 96% direct). Tuned in P1.12. WebKit has
 * no such per-frame cost and is slower on direct writes (P1.12, WebKit mix 256: 33 frames over
 * 50 ms uncapped vs 54 capped), so it runs uncapped.
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
  private ro: ResizeObserver;
  private enter: EnterController;
  private pageTimeline: AnimationTimeline | null = null;
  private lastScroll = 0;
  private deferred = 0;
  /** True when the frame loop has work in native mode (direct-write layers, zone loops). Cached. */
  private jsWork: boolean | null = null;
  /** Live native animations, against the budget. */
  private live = 0;
  /** NATIVE_BUDGET in Blink, uncapped elsewhere. */
  private budget = blink ? NATIVE_BUDGET : Infinity;
  /** Scenes inside the activation window, covered or not. */
  private inView = new Set<CvScene>();
  /** Scenes inside the native window, covered or not. */
  private inNative = new Set<CvScene>();
  /** Stacked scenes, each with the scene that covers it (the last scene has none: not held). */
  private stacks: Array<{ s: CvScene; next: CvScene }> = [];
  private held = new Set<CvScene>();
  /** Stacked scenes with a `covered` look; natives when the next scene's ViewTimeline drives it. */
  private covers: Array<{ s: CvScene; next: CvScene; look: CoverLook; natives: Animation[] }> = [];
  /** <cv-stack> decks: sticking ones follow the scroll offset, dealt ones (zones) zone time. */
  private decks: Array<{ s: CvScene; k: CvStack }> = [];
  /** `track="x"` scenes with a row to move; native: one scroll-driven animation each. */
  private tracks: Array<{ s: CvScene; native: Animation | null }> = [];

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
    // A rebuild re-solves elements: every zone publishes afresh.
    for (const s of this.scenes) s.frameTime = Number.NaN;
    // Scene `stack` (plan v3 §8): the scene sticks (refresh() places it), and the next one,
    // later in paint order, scrolls over it.
    this.scenes.forEach((s, i) => {
      const next = this.scenes[i + 1];
      if (!s.isStacked || !next) return;
      this.stacks.push({ s, next });
      this.held.add(s);
    });
    for (const { s, next } of this.stacks) {
      if (s.cover) this.covers.push({ s, next, look: s.cover, natives: [] });
    }
    for (const s of this.scenes) {
      for (const a of s.ordered) if (isDeck(a)) this.decks.push({ s, k: a });
      if (s.isTrack && s.travel > 0) this.tracks.push({ s, native: null });
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
          if (entry.isIntersecting) this.inView.add(s);
          else this.inView.delete(s);
          this.activate(s);
        }
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
    for (const s of this.scenes) {
      s.active = false;
      s.covered = false;
      s.removeAttribute('data-cv-covered');
      s.style.visibility = '';
    }
    for (const { s } of this.stacks) {
      s.style.position = '';
      s.style.top = '';
    }
    for (const c of this.covers) {
      for (const n of c.natives) n.cancel();
      c.s.coverProgress = Number.NaN;
      clearCover(c.s, c.s.veil!);
    }
    for (const { k } of this.decks) k.clearWrites();
    for (const track of this.tracks) {
      track.native?.cancel();
      track.s.clearTrack();
    }
  }

  refresh(): void {
    this.vh = window.innerHeight;
    this.vw = window.innerWidth;
    const design = Number(this.stage.getAttribute('design-width')) || 750;
    this.unit = (this.stage.clientWidth || this.vw) / design;
    this.docHeight = document.documentElement.scrollHeight;
    const y = window.scrollY;
    // A held scene's rect is where it sticks: measure stacked scenes where they sit in the flow,
    // and unscaled (`covered`; important beats the native animation; the frame writes it again).
    for (const { s } of this.stacks) {
      s.style.position = '';
      s.style.top = '';
    }
    for (const { s, look } of this.covers) {
      if (look.scale !== 1) s.style.setProperty('scale', 'none', 'important');
    }
    for (const s of this.scenes) {
      const r = s.getBoundingClientRect();
      s.docTop = r.top + y;
      s.height = r.height;
    }
    for (const { s, k } of this.decks) {
      if (k.dealt) k.measureDealt(s.shell!.getBoundingClientRect().top, this.vh);
      else k.measureFlow(y);
    }
    for (const { s, look } of this.covers) {
      if (look.scale === 1) continue;
      s.style.removeProperty('scale');
      s.coverProgress = Number.NaN;
    }
    // Whether sticking decks need frames depends on what they measure.
    this.jsWork = null;
    // Held from the moment its bottom meets the viewport's bottom: a zone once its time has run,
    // a scene taller than the screen once its end arrives, any other at the top.
    for (const { s } of this.stacks) {
      s.style.position = 'sticky';
      s.style.top = s.isZone ? `${-s.solution.total}px` : `min(0px, calc(100svh - ${s.height}px))`;
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

  /**
   * Zone state (data-cv-stuck, cv-progress, data-cv-phase, subscribed timelines) follows the scroll
   * event itself; direct-write layers, gates and zone loop gates follow in a frame. Pure native
   * pages request no frames: per-frame main-thread work would cost them the compositor's
   * independence from a busy main thread (phase-0 blocking test).
   */
  private onScroll = (): void => {
    this.lastScroll = performance.now();
    this.zoneWork();
    this.stackWork();
    if (this.native && !this.hasJsWork()) return;
    this.queueFrame();
  };

  private hasJsWork(): boolean {
    if (this.jsWork !== null) return this.jsWork;
    this.jsWork =
      this.enter.size > 0 ||
      this.covers.some((c) => !c.natives.length) ||
      this.decks.some(({ k }) => k.dealt || k.followsScroll) ||
      this.tracks.some((track) => !track.native) ||
      this.scenes.some((s) =>
        s.ordered.some(
          (a) =>
            (s.isZone && a.loopItems.length > 0) ||
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
    const rects = new Map<Element, DOMRect>();
    const isNear = (s: CvScene): boolean => s.docTop < y + vh * 2 && s.docTop + s.height > y - vh;
    const gated = this.enter.measure(
      (a) => a.scene !== null && isNear(a.scene) && !a.scene.covered
    );
    const page = Math.min(Math.max(y / Math.max(1, this.docHeight - vh), 0), 1);
    // A receding scene is scaled about its origin (`covered`); view progress is where the subject
    // sits unscaled, as drag measures it. Read once per scene and frame, before any write.
    const lenses = new Map<CvScene, { origin: number; k: number } | null>();
    const lens = (s: CvScene): { origin: number; k: number } | null => {
      if (!s.cover || s.cover.scale === 1) return null;
      let l = lenses.get(s);
      if (l === undefined) {
        const k = parseFloat(getComputedStyle(s).scale) || 1;
        let r = rects.get(s);
        if (!r) rects.set(s, (r = s.getBoundingClientRect()));
        const o = Math.max(s.height / 2, s.height - vh / 2);
        l = k === 1 ? null : { origin: r.top + o * k, k };
        lenses.set(s, l);
      }
      return l;
    };
    for (const s of this.scenes) {
      // Covered scenes are not painted: nothing to write until they show again.
      if (!isNear(s) || s.covered) {
        if (s.isZone) for (const a of s.ordered) if (a.looping) loops.push({ a, on: false });
        continue;
      }
      const zone = s.isZone;
      const t = zone ? Math.min(Math.max(y - s.docTop, 0), s.solution.total) : 0;
      for (const a of s.ordered) {
        // Zone loops run once the entrance is complete (1.x: playable phase and visible).
        if (zone && a.loopItems.length) loops.push({ a, on: !a.solved || t >= a.solved.end });
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
            const subject = a.viewSubject(layer);
            let top = s.docTop - y;
            let height = s.height;
            if (subject !== s || this.held.has(s)) {
              // Elements inside a sticky shell move with it, a held scene stays put: live rects,
              // read before any write (plan v3 §8), once per subject and frame.
              let r = rects.get(subject);
              if (!r) rects.set(subject, (r = subject.getBoundingClientRect()));
              const l = this.held.has(s) ? lens(s) : null;
              top = l ? l.origin + (r.top - l.origin) / l.k : r.top;
              height = l ? r.height / l.k : r.height;
            }
            work.push({ layer, p: viewProgress(top, height, vh, layer.range), px: 0 });
          } else if (layer.source === 'page') {
            work.push({ layer, p: page, px: 0 });
          }
        }
      }
    }
    // Covering progress: the next scene's entry. It moves in the flow until it has covered this
    // one (a stacked next scene sticks only after that), so its offset is exact.
    const covers: Array<{ s: CvScene; look: CoverLook; p: number }> = [];
    for (const { s, next, look, natives } of this.covers) {
      if (natives.length || s.covered) continue;
      const p = viewProgress(next.docTop - y, next.height, vh, COVER_RANGE);
      if (p !== s.coverProgress) covers.push({ s, look, p });
    }
    const decks: Array<{ k: CvStack; at: number }> = [];
    for (const { s, k } of this.decks) {
      if (!isNear(s) || s.covered || !(k.dealt || k.followsScroll)) continue;
      decks.push({ k, at: k.dealt ? Math.min(Math.max(y - s.docTop, 0), s.solution.total) : y });
    }
    const rows: Array<{ s: CvScene; t: number }> = [];
    for (const { s, native } of this.tracks) {
      if (native || !isNear(s) || s.covered) continue;
      rows.push({ s, t: Math.min(Math.max(y - s.docTop, 0), s.solution.total) });
    }
    for (const w of work) writeLayer(w.layer, w.p, w.px);
    for (const { s, t } of rows) s.writeTrack(t);
    for (const { k, at } of decks) {
      if (k.dealt) k.writeTime(at);
      else k.writeScroll(at);
    }
    for (const { s, look, p } of covers) {
      s.coverProgress = p;
      writeCover(s, s.veil!, look, p);
    }
    this.enter.apply(gated, vh, this.unit);
    for (const { a, on } of loops) {
      if (on) a.startLoops(this.clock);
      else a.stopLoops();
    }
    // Last: listeners may read layout. Covers changes without a scroll event (refresh, load).
    // The offset read above: reading it again after the writes would force a style recalc.
    this.zoneWork(y);
    this.stackWork(y);
  }

  /**
   * A stacked scene is covered once the next scene's top reaches the viewport's top: from there on
   * the next scene and what follows it fill the screen. Covered, it is not painted (plan v3 §8),
   * which also takes it out of focus and hit testing, and it is deactivated (1.x `covered`).
   */
  private stackWork(y = window.scrollY): void {
    for (const { s, next } of this.stacks) {
      const covered = y >= next.docTop - 0.5;
      if (covered === s.covered) continue;
      s.covered = covered;
      s.toggleAttribute('data-cv-covered', covered);
      s.style.visibility = covered ? 'hidden' : '';
      if (covered) for (const a of s.ordered) a.stopLoops();
      this.activate(s);
      if (this.native) {
        if (!covered && this.inNative.has(s)) this.attachNative(s);
        else this.detachNative(s);
        this.refill();
      }
      this.queueFrame();
    }
  }

  /** Active: inside the activation window and not covered. Events and media follow (plan v3 §7). */
  private activate(s: CvScene): void {
    const on = this.inView.has(s) && !s.covered;
    s.toggleAttribute('data-cv-active', on);
    if (on === s.active) return;
    s.active = on;
    if (!on) for (const a of s.ordered) a.stopLoops();
    for (const a of s.ordered) a.activated(on);
    s.dispatchEvent(new CustomEvent(on ? 'cv-activate' : 'cv-deactivate', { bubbles: true }));
  }

  /**
   * Zones whose time moved: phase attributes, subscribed element timelines (<cv-video>), then
   * `data-cv-stuck` and `cv-progress`. A few comparisons per element; frames are built only for
   * subscribers (others compute theirs on read, frameOf). Every zone is visited, so one jumped
   * over still lands on its end value.
   */
  private zoneWork(y = window.scrollY): void {
    this.scenes.forEach((s, index) => {
      if (!s.isZone) return;
      const t = Math.min(Math.max(y - s.docTop, 0), s.solution.total);
      if (t !== s.frameTime) {
        s.frameTime = t;
        for (const a of s.ordered) {
          if (!a.timed) continue;
          if (a.subscribed) a.sendFrame(zoneFrame(a, t));
          else a.showPhase(zonePhase(a, t));
        }
      }
      reportZone(s, index, t);
    });
  }

  /** An element's current frame (el.timeline read): zone elements only; others keep their own. */
  frameOf(a: CvAnimate): TimelineFrame | null {
    const s = a.scene;
    if (!s?.isZone || this.destroyed) return null;
    return zoneFrame(a, Math.min(Math.max(window.scrollY - s.docTop, 0), s.solution.total));
  }

  /**
   * Native path: scroll-driven WAAPI animations, one per eligible layer, alive only for scenes
   * inside an activation window (two viewports ahead) and, in Blink, only up to NATIVE_BUDGET at
   * once. Chrome services every live scroll-driven animation on the main thread each frame, so
   * far scenes must not keep animations alive (phase-0: 3.9 s vs 1.2 s main-thread time at
   * 512/scene).
   */
  private startNative(): void {
    const VT = platform.ViewTimeline!;
    for (const s of this.scenes) s.timeline = new VT({ subject: s, axis: 'block' });
    const ST = platform.ScrollTimeline;
    if (ST) this.pageTimeline = new ST({ source: document.documentElement, axis: 'block' });
    // Covered looks follow the next scene's entry for the whole page: two animations per stacked
    // scene at most, outside the budget. A held next scene sticks, which stretches its
    // ViewTimeline (nativeView): written directly instead.
    for (const c of this.covers) {
      if (this.held.has(c.next)) continue;
      const frames = coverKeyframes(c.look);
      const options = {
        timeline: c.next.timeline,
        ...rangeCss(COVER_RANGE),
        fill: 'both',
        easing: 'linear',
      } as KeyframeAnimationOptions;
      c.natives.push(c.s.veil!.animate(frames.veil, options));
      if (frames.host) c.natives.push(c.s.animate(frames.host, options));
    }
    // Track rows: the row moves over the first `travel` px of its zone, then stays. One animation
    // per track scene, outside the budget; the direct value holds until it takes effect.
    const y = window.scrollY;
    for (const track of this.tracks) {
      const { s } = track;
      const total = s.solution.total;
      const end = `${-s.travel}px 0px`;
      const frames: Keyframe[] = [{ offset: 0, translate: '0px 0px' }];
      if (s.travel < total) frames.push({ offset: s.travel / total, translate: end });
      frames.push({ offset: 1, translate: end });
      s.writeTrack(Math.min(Math.max(y - s.docTop, 0), total));
      track.native = s.track!.animate(frames, {
        timeline: s.timeline,
        rangeStart: 'contain 0%',
        rangeEnd: 'contain 100%',
        fill: 'both',
        easing: 'linear',
      } as KeyframeAnimationOptions);
    }
    this.nativeIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const s = entry.target as CvScene;
          if (entry.isIntersecting) this.inNative.add(s);
          else this.inNative.delete(s);
          if (entry.isIntersecting && !s.covered) this.attachNative(s);
          else if (s.nativeAttached) this.detachNative(s);
        }
        // Budget freed by a detach goes to scenes still waiting, nearest first.
        this.refill();
      },
      { rootMargin: '200% 0px 200% 0px' }
    );
    for (const s of this.scenes) this.nativeIo.observe(s);
  }

  /**
   * View progress is where the subject is on screen; a ViewTimeline instead counts the stretch a
   * sticky subject (or one inside a sticky box) is held as passage, so its progress runs on while
   * the subject stands still. Subjects in a zone's shell and in held scenes are written directly,
   * from live rects (plan v3 §8); drag gives the same values from the displayed offset (F7).
   */
  private nativeView(s: CvScene, layer: Layer): boolean {
    if (this.held.has(s)) return false;
    return !s.isZone || layer.subject === 'scene';
  }

  /** Eligible layers of a scene still on direct writes. */
  private pendingNative(s: CvScene): Array<{ a: CvAnimate; layer: Layer }> {
    const out: Array<{ a: CvAnimate; layer: Layer }> = [];
    for (const a of s.ordered) {
      for (const layer of a.layers) {
        if (layer.native || !compositorEligible(layer.used)) continue;
        if (
          (layer.source === 'scene' && s.isZone && layer.window) ||
          (layer.source === 'view' && this.nativeView(s, layer)) ||
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
        if (this.live >= this.budget) {
          // Over budget: the rest stay on direct writes until a detach frees room.
          s.nativePending = true;
          break;
        }
        const { a, layer } = jobs.shift()!;
        if (layer.native) continue;
        const w = layer.window;
        const zone = layer.source === 'scene' && w !== null;
        const page = layer.source === 'page';
        const subject = zone || page ? s : a.viewSubject(layer);
        const timeline = zone
          ? s.timeline
          : page
            ? this.pageTimeline
            : subject === s
              ? s.timeline
              : new VT({ subject, axis: 'block' });
        const keyframes = zone ? sceneKeyframes(layer, w, s.solution.total) : layerKeyframes(layer);
        const native = layer.el.animate(keyframes, {
          timeline,
          ...(page
            ? {}
            : zone
              ? { rangeStart: 'contain 0%', rangeEnd: 'contain 100%' }
              : rangeCss(layer.range)),
          fill: 'both',
          easing: 'linear',
        } as KeyframeAnimationOptions);
        layer.native = native;
        // The direct-written value stays under the animation until it takes effect: a new
        // scroll-driven animation is pending for a frame, and clearing it now would show the
        // unanimated layer for that frame (a jump into a zone that just entered the window).
        void native.ready.then(
          () => layer.native === native && clearLayer(layer),
          () => undefined
        );
        a.natives.push(native);
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
    if (this.live >= this.budget) return;
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

const isDeck = (a: CvAnimate): a is CvStack => a.localName === 'cv-stack';

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

/** The phase alone, without building a frame (runs per scroll event for every zone element). */
function zonePhase(a: CvAnimate, t: number): TimelinePhase {
  const w = a.solved;
  if (!w) return 'idle';
  if (w.exitDuration > 0 && t > w.exitStart) {
    return progressIn(t, w.exitStart, w.exitEnd) >= 1 ? 'exited' : 'exiting';
  }
  return progressIn(t, w.start, w.end) >= 1 ? 'entered' : 'entering';
}

/** An element's timeline frame in a zone: scene time from scroll. */
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
