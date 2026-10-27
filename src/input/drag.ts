/**
 * Drag input: one-screen scenes paged by pointer, keyboard, hash links or goTo(), with the 1.x
 * drag transaction (site docs: drag gestures, ownership, two-track timelines, callbacks).
 *
 * Two tracks. The page (`pos`, a continuous scene index) follows the finger and settles on
 * release. Each scene has its own element time: the incoming scene's time follows the finger
 * (unit/scale), and after release it continues at real time to its end, in parallel with the page
 * slide, which commits the scene switch when it lands. The leaving scene runs its exits on the page
 * travel (transition-duration is the time base); leaving backwards reverses the entrance of
 * elements that declare an exit.
 *
 * Input only records intent; the frame loop is the only writer. All output is direct style writes
 * (plan v3 §6: no native scroll timeline here, no seek-then-resume).
 */
import { cubicBezier } from '../core/ease';
import type { CvAnimate } from '../elements/animate';
import type { CvScene } from '../elements/scene';
import type { CvStack } from '../elements/stack';
import type { CvStage } from '../elements/stage';
import type { TimelineFrame, TimelinePhase, TimelineSource } from '../core/timeline';
import { viewProgress } from '../core/view';
import { blink } from '../platform';
import { clearCover, writeCover } from '../render/covered';
import { progressIn, writeLayer } from '../render/layers';
import {
  cancelDuration,
  DEFAULT_THRESHOLD,
  mapDrag,
  parseMapping,
  parseThreshold,
  shouldCommit,
  slideDuration,
  type DragMapping,
  type Threshold,
} from './drag-rules';
import type { InputEngine } from './engine';
import { isSignal, Signals, writeSignal } from './signals';

/** Presses that start here never page (1.x list, plus role=button and <cv-pause>). */
const INTERACTIVE =
  'a,button,input,textarea,select,option,summary,[contenteditable=""],[contenteditable="true"],[role=button],cv-pause,[data-cv-ignore-drag],[data-cineview-ignore-drag]';
const TYPING = 'input,textarea,select,[contenteditable=""],[contenteditable="true"]';
/** No movement for this long before release means a held finger: velocity 0 (1.x). */
const VELOCITY_WINDOW_MS = 100;
/** Motion's easeOut, as 1.x settled the page. */
const easeOut = cubicBezier(0, 0, 0.58, 1);
const linear = (t: number): number => t;

type Side = 1 | -1;

interface Tween {
  from: number;
  to: number;
  t0: number;
  duration: number;
  ease: (t: number) => number;
}
const tweenAt = (tw: Tween, now: number): number => {
  if (tw.duration <= 0) return tw.to;
  const k = Math.min(1, Math.max(0, (now - tw.t0) / tw.duration));
  return tw.from + (tw.to - tw.from) * tw.ease(k);
};
const tweenDone = (tw: Tween, now: number): boolean => now - tw.t0 >= tw.duration;
/** Restart a tween from a frozen value, keeping its rate (real time) or its remaining share. */
const resumed = (tw: Tween, value: number, now: number, realTime: boolean): Tween => {
  const span = Math.abs(tw.to - tw.from);
  const left = Math.abs(tw.to - value);
  return {
    ...tw,
    from: value,
    t0: now,
    duration: realTime ? left : span > 0 ? (tw.duration * left) / span : 0,
  };
};

interface Lane {
  kind: 'commit' | 'cancel' | 'goto';
  page: Tween;
  /** Scene index the lane lands on. */
  target: number;
  /** Scene the transaction leaves (goTo may preposition past it). */
  from: number;
  /** Frozen by a press that may still turn into a drag. */
  frozen: boolean;
  /** cv-dragend / cv-dragcancel detail captured at release. */
  detail?: {
    progress: number;
    direction: 'forward' | 'backward' | null;
    elapsed?: number;
    total?: number;
  };
}

interface Press {
  id: number;
  x0: number;
  /** Original press coordinates/time, unaffected by ownership or later movement samples. */
  readonly startY: number;
  readonly startTime: number;
  y0: number;
  y: number;
  t: number;
  /** Signed velocity toward the next scene (px/s), from the last movement segment. */
  v: number;
  owning: boolean;
  rejected: Set<Side>;
  /** A lane or playheads were frozen at pointerdown and await resume or takeover. */
  froze: boolean;
  target: Element;
  /** Page displacement at ownership (takeover of a frozen transition, else 0). */
  base: number;
  /** Incoming scene time and drag ratio at ownership, so the takeover continues in place. */
  baseline: { scene: number; time: number; ratio: number } | null;
  blocked: Set<Side>;
  cancelled: boolean;
}

export interface DragEngine extends InputEngine {
  goTo(index: number, options?: { animated?: boolean }): void;
}

/** `start`: the scene to resume at after a rebuild; otherwise the hash entry or the first scene. */
export function createDragEngine(stage: CvStage, start?: number): DragEngine {
  return new DragInput(stage, start);
}

class DragInput implements DragEngine {
  private scenes: CvScene[];
  private vh: number;
  private index = 0;
  /** Displayed page position (continuous scene index). */
  private pos = 0;
  /** Element time per scene (ms). */
  private times: number[];
  /** Element-time playheads per scene. */
  private heads: Array<Tween | null>;
  private frozenHeads = false;
  private lane: Lane | null = null;
  private press: Press | null = null;
  /** A drag session is open: cv-dragstart sent, its single terminal event pending. */
  private session = false;
  private suppressClick = false;
  private raf = 0;
  private destroyed = false;
  private transition: number;
  private threshold: Threshold;
  private mapping: DragMapping;
  private inWindow: boolean[] = [];
  /** Scenes left by a committed switch, with the direction they left in (+1 forward). */
  private departed = new Map<number, Side>();
  private tickSource: TimelineSource | null = null;
  /** Page position last reported as cv-progress. */
  private reported = 0;
  /** Subject geometry relative to its scene, for per-element view progress (plan v3 F7). */
  private local = new Map<Element, { top: number; height: number }>();
  /** The reader's speed and direction, from the page as displayed (finger, then slide). */
  private signals = new Signals();
  /** Some element follows velocity or direction: frames continue until the signals rest. */
  private hasSignals: boolean;
  private restoreScenes: Array<() => void> = [];

  constructor(
    private stage: CvStage,
    resumeAt?: number
  ) {
    this.scenes = stage.ordered;
    this.vh = stage.clientHeight || window.innerHeight;
    this.hasSignals = this.scenes.some((s) =>
      s.ordered.some((a) => a.layers.some((l) => isSignal(l.source)))
    );
    this.times = this.scenes.map(() => 0);
    this.heads = this.scenes.map(() => null);
    this.transition = Math.max(0, Number(stage.getAttribute('transition-duration') ?? 800) || 0);
    this.threshold = parseThreshold(stage.getAttribute('threshold'), DEFAULT_THRESHOLD, (m) =>
      stage.report(m, stage)
    );
    const root = parseMapping(stage.getAttribute('unit'), stage.getAttribute('scale'), {
      unit: 'time',
      scale: 10,
    });
    this.mapping = root.mapping;
    const invalid = 'unit/scale: expected unit="time|percent" and a scale >= 0';
    if (root.invalid) stage.report(invalid, stage, 'invalid-drag-config');
    for (const s of this.scenes) {
      parseThreshold(s.getAttribute('threshold'), this.threshold, (m) => stage.report(m, s));
      if (parseMapping(s.getAttribute('unit'), s.getAttribute('scale'), this.mapping).invalid) {
        stage.report(invalid, s, 'invalid-drag-config');
      }
    }

    // Stage geometry (fixed, clipped, touch-action) is the stage's own :host([input=drag]) style.
    if (!stage.hasAttribute('role')) stage.setAttribute('role', 'region');
    if (!stage.hasAttribute('aria-roledescription')) {
      stage.setAttribute('aria-roledescription', 'carousel');
    }
    if (!stage.hasAttribute('tabindex')) stage.tabIndex = 0;
    for (const s of this.scenes) {
      // Restore only our writes; unrelated author style changes survive a mode switch.
      const styles = [
        'position',
        'top',
        'right',
        'bottom',
        'left',
        'height',
        'overflow-x',
        'overflow-y',
        'clip-path',
        'will-change',
        'translate',
        'content-visibility',
        'visibility',
      ].map((p) => [p, s.style.getPropertyValue(p), s.style.getPropertyPriority(p)] as const);
      const attrs = ['inert', 'aria-hidden'].map((p) => [p, s.getAttribute(p)] as const);
      this.restoreScenes.push(() => {
        for (const [p, value, priority] of styles) s.style.setProperty(p, value, priority);
        for (const [p, value] of attrs) {
          if (value === null) s.removeAttribute(p);
          else s.setAttribute(p, value);
        }
      });
      Object.assign(s.style, {
        position: 'absolute',
        inset: '0',
        height: '100%',
        // One screen per scene: taller content is cut off, as in 1.x (dev build warns). WebKit
        // clips with a clip path: it is slower on the first frame of a drag when a moving scene
        // clips its overflow (P1.12, heavy fixture: 51 ms vs 37 ms). Blink keeps overflow, its
        // measured baseline: the clip path showed no gain there (P1.12).
        ...(blink ? { overflow: 'clip' } : { clipPath: 'inset(0)' }),
        willChange: 'translate',
      });
    }

    // Entry: a hash naming a scene (or something inside one) starts there (`:target` entry).
    // A rebuild (attribute change, scene added) keeps the current scene.
    const start =
      resumeAt !== undefined
        ? Math.min(resumeAt, this.scenes.length - 1)
        : this.sceneFor(decodeURIComponent(location.hash.slice(1)));
    this.index = this.pos = Math.max(0, start ?? 0);
    this.reported = this.pos;
    stage.setCurrent(this.index);

    stage.addEventListener('pointerdown', this.onDown);
    stage.addEventListener('pointermove', this.onMove);
    stage.addEventListener('click', this.onClick, true);
    window.addEventListener('hashchange', this.onHash);
    stage.addEventListener('keydown', this.onKey);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('resize', this.onResize, { passive: true });
    // First screen (1.x cold start): its entrance plays on the clock, from where a CSS-first
    // entrance got to, once its assets are ready (plan v3 §10). A rebuild resumes at the end.
    const first = this.index;
    const gate = stage.firstScreen;
    if (resumeAt !== undefined) {
      this.times[first] = this.total(first);
    } else if (gate?.held) {
      gate.whenReleased(() => {
        // A gesture or navigation since then owns the scene.
        if (this.destroyed || this.index !== first || this.press?.owning || this.lane) return;
        if (this.heads[first]) return;
        this.play(first, 0, this.total(first));
        this.loop();
      });
    } else {
      const offset = Math.min(stage.bootOffset, this.total(first));
      this.times[first] = offset;
      this.play(first, offset, this.total(first));
    }
    this.refresh();
    this.loop();
  }

  currentIndex(): number {
    return this.index;
  }

  refresh(): void {
    this.vh = this.stage.clientHeight || window.innerHeight;
    this.local.clear();
    // Measured unscaled (`covered="recede"`); write() below scales again.
    for (const s of this.scenes) {
      if (!s.cover || s.cover.scale === 1) continue;
      s.style.scale = '';
      s.coverProgress = Number.NaN;
    }
    for (const s of this.scenes) {
      const base = s.getBoundingClientRect().top;
      for (const a of s.ordered) {
        // <cv-stack>: cards come up from the screen's bottom edge to their slots.
        if (isDeck(a)) a.measureDealt(base, this.vh);
        for (const l of a.layers) {
          if (l.source !== 'view' || l.subject === 'scene') continue;
          const subject = a.viewSubject(l);
          if (subject === s || this.local.has(subject)) continue;
          const r = subject.getBoundingClientRect();
          this.local.set(subject, { top: r.top - base, height: r.height });
        }
      }
    }
    this.applyWindow();
    this.write();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.stage.removeEventListener('pointerdown', this.onDown);
    this.stage.removeEventListener('pointermove', this.onMove);
    this.stage.removeEventListener('click', this.onClick, true);
    window.removeEventListener('hashchange', this.onHash);
    this.stage.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('resize', this.onResize);
    for (const s of this.scenes) {
      for (const a of s.ordered) {
        a.stopLoops();
        a.dragActive = undefined;
        if (isDeck(a)) a.clearWrites();
      }
      this.cover(s, false);
      s.removeAttribute('data-cv-stuck');
      if (s.cover) clearCover(s, s.veil!);
      s.coverProgress = Number.NaN;
      s.clearTrack();
      s.active = false;
      s.removeAttribute('data-cv-active');
    }
    for (const restore of this.restoreScenes) restore();
    this.endSession('cancel');
  }

  /** Programmatic navigation. Not a gesture: no drag events; cv-progress follows the slide. */
  goTo(target: number, options: { animated?: boolean } = {}): void {
    target = Math.max(0, Math.min(this.scenes.length - 1, Math.round(target)));
    if (this.press?.owning) return;
    if (target === this.index && !this.lane) return;
    this.endSession('cancel');
    if (this.destroyed) return;
    this.lane = null;
    this.frozenHeads = false;
    const from = this.index;
    if (options.animated === false || this.transition === 0) {
      this.heads = this.heads.map(() => null);
      this.times = this.times.map((_, i) => (i === target ? this.total(i) : 0));
      this.pos = this.reported = target;
      this.switchTo(target, from);
      this.write();
      return;
    }
    const side: Side = target > this.index ? 1 : -1;
    if (Math.abs(target - this.index) > 1) {
      // Jump next to the target first; scenes between are outside the window anyway. They are
      // marked departed (in the travel direction) so their phase reads "exited", not a stale 0.
      for (let i = Math.min(from, target) + 1; i < Math.max(from, target); i++) {
        this.departed.set(i, side);
        this.times[i] = this.total(i);
        this.heads[i] = null;
      }
      this.index = target - side;
      this.pos = this.reported = this.index;
      this.applyWindow();
    }
    this.times[target] = 0;
    this.play(target, 0, this.total(target));
    this.lane = {
      kind: 'goto',
      page: {
        from: this.pos,
        to: target,
        t0: performance.now(),
        duration: slideDuration(target - this.pos, this.transition),
        ease: easeOut,
      },
      target,
      from,
      frozen: false,
    };
    this.loop();
  }

  // ---- pointer -------------------------------------------------------------------------------------

  private onResize = (): void => this.refresh();

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || e.isPrimary === false || e.defaultPrevented) return;
    const target = e.target as Element;
    // A new press ends whatever the previous gesture left behind, whatever the target is: a
    // touch drag emits no click, and the next tap may land on a control inside the stage.
    this.suppressClick = false;
    if (target.closest?.(INTERACTIVE)) return;
    if (this.press) this.release(this.press);
    const froze = this.freeze();
    this.press = {
      id: e.pointerId,
      x0: e.clientX,
      startY: e.clientY,
      startTime: e.timeStamp,
      y0: e.clientY,
      y: e.clientY,
      t: e.timeStamp,
      v: 0,
      owning: false,
      rejected: new Set(),
      froze,
      target,
      base: 0,
      baseline: null,
      blocked: new Set(),
      cancelled: false,
    };
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    if (!p.owning) {
      const dy = e.clientY - p.y0;
      const dx = e.clientX - p.x0;
      // Direction gate: at least 1 px along the axis, and more than across it.
      if (Math.abs(dy) < 1 || Math.abs(dy) <= Math.abs(dx)) return;
      const side: Side = dy < 0 ? 1 : -1;
      if (p.rejected.has(side)) return;
      if (!this.mayDrag(side, p)) {
        p.rejected.add(side);
        return;
      }
      // Discard only the 1 px direction gate, not a whole coalesced movement sample.
      p.owning = true;
      p.y0 += Math.sign(dy);
      p.y = p.y0;
      this.takeOver(p);
      p.target.setPointerCapture?.(p.id);
      if (!this.session) {
        this.session = true;
        this.emit('cv-dragstart', {
          index: this.index,
          direction: side === 1 ? 'forward' : 'backward',
        });
      }
    }
    const dt = Math.max(e.timeStamp - p.t, 1);
    p.v = (-(e.clientY - p.y) / dt) * 1000;
    p.y = e.clientY;
    p.t = e.timeStamp;
    this.follow(p);
    if (e.cancelable) e.preventDefault();
  };

  private onUp = (e: PointerEvent): void => {
    const p = this.press;
    if (p && e.pointerId === p.id) this.release(p);
  };

  private onCancel = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    p.cancelled = true;
    this.release(p);
  };

  private onClick = (e: MouseEvent): void => {
    if (this.suppressClick) {
      this.suppressClick = false;
      // Keyboard and assistive activation have no preceding pointerdown and detail 0.
      if (e.detail !== 0) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
    }
    // Hash links to a scene page instead of jumping (plan v3 §9.2).
    const link = (e.target as Element).closest?.('a[href^="#"]');
    if (!link || e.defaultPrevented) return;
    const href = link.getAttribute('href')!;
    const scene = this.sceneFor(decodeURIComponent(href.slice(1)));
    if (scene === null) return;
    e.preventDefault();
    history.pushState(null, '', href);
    this.goTo(scene);
  };

  /**
   * A hash link outside the stage (a table of contents, lexicon #23) or history: page to the scene
   * it names. Links inside the stage page on click and push the hash themselves.
   */
  private onHash = (): void => {
    let scene: number | null = null;
    try {
      scene = this.sceneFor(decodeURIComponent(location.hash.slice(1)));
    } catch {
      // Malformed escape: not a scene.
    }
    if (scene !== null && scene !== this.index) this.goTo(scene);
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || this.press?.owning) return;
    if ((e.target as Element).closest?.(TYPING)) return;
    const last = this.scenes.length - 1;
    const to =
      e.key === 'ArrowDown' || e.key === 'PageDown'
        ? this.index + 1
        : e.key === 'ArrowUp' || e.key === 'PageUp'
          ? this.index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (to === null) return;
    e.preventDefault();
    if (to >= 0 && to <= last && to !== this.index) this.goTo(to);
  };

  /** May a drag start toward `side`? Reports a blocked scene once per side per press. */
  private mayDrag(side: Side, p: Press): boolean {
    // Re-grabbing a transition in flight: pulling it back toward the current scene is always
    // allowed (the takeover reverses it), even at the first or last scene.
    const travel = this.pos - this.index;
    if (p.froze && travel !== 0 && Math.sign(travel) === -side) return true;
    const next = this.index + side;
    if (next < 0 || next >= this.scenes.length) return false;
    const scene = this.scenes[next]!;
    if (scene.getAttribute('drag') === 'off') {
      if (!p.blocked.has(side)) {
        p.blocked.add(side);
        this.emit('cv-dragblocked', {
          index: this.index,
          target: next,
          direction: side === 1 ? 'forward' : 'backward',
        });
      }
      return false;
    }
    // A nested scroller that can still scroll this way keeps the gesture (edge handoff).
    const current = this.scenes[this.index];
    for (let el: Element | null = p.target; el && el !== current; el = el.parentElement) {
      if (!(el instanceof HTMLElement) || el.scrollHeight <= el.clientHeight + 1) continue;
      const overflow = getComputedStyle(el).overflowY;
      if (overflow !== 'auto' && overflow !== 'scroll') continue;
      const canScroll =
        side === 1 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
      if (canScroll) return false;
    }
    return true;
  }

  /** Pointerdown: freeze any transition reversibly (a tap must give it back). */
  private freeze(): boolean {
    const now = performance.now();
    let froze = false;
    if (this.lane && !this.lane.frozen) {
      this.pos = tweenAt(this.lane.page, now);
      this.lane.frozen = true;
      froze = true;
    }
    if (this.heads.some(Boolean) && !this.frozenHeads) {
      this.heads.forEach((h, i) => {
        if (h) this.times[i] = tweenAt(h, now);
      });
      this.frozenHeads = true;
      froze = true;
    }
    return froze;
  }

  /** The press ended without a drag: resume what it froze. */
  private resume(): void {
    const now = performance.now();
    if (this.lane?.frozen) {
      const lane = this.lane;
      lane.frozen = false;
      lane.page = resumed(lane.page, this.pos, now, false);
    }
    if (this.frozenHeads) {
      this.frozenHeads = false;
      this.heads = this.heads.map((h, i) =>
        h ? resumed(h, this.times[i] ?? 0, now, h.ease === linear) : null
      );
    }
    this.loop();
  }

  /** Ownership: the frozen transition becomes the finger's, in place (never flush-committed). */
  private takeOver(p: Press): void {
    // Grabbing the first screen while it waits for assets ends the wait (1.x preemption).
    this.stage.firstScreen?.preempt();
    p.base = this.pos - this.index;
    // A commit slide that had not landed is still a transition away from `index`.
    this.lane = null;
    this.heads = this.heads.map(() => null);
    this.frozenHeads = false;
    const side: Side = p.base >= 0 ? 1 : -1;
    const incoming = this.index + side;
    if (p.base !== 0 && incoming >= 0 && incoming < this.scenes.length) {
      p.baseline = { scene: incoming, time: this.times[incoming] ?? 0, ratio: Math.abs(p.base) };
    }
    this.loop();
  }

  /** While dragging: page follows the finger; the incoming scene's element time follows too. */
  private follow(p: Press): void {
    const last = this.scenes.length - 1;
    let r = p.base - (p.y - p.y0) / this.vh;
    if ((this.index === 0 && r < 0) || (this.index === last && r > 0)) r = 0;
    const blocked = (side: Side): boolean =>
      this.scenes[this.index + side]?.getAttribute('drag') === 'off';
    if ((r > 0 && blocked(1)) || (r < 0 && blocked(-1))) r = 0;
    r = Math.max(-1, Math.min(1, r));
    this.pos = this.index + r;
    for (const side of [1, -1] as const) {
      const k = this.index + side;
      if (k < 0 || k > last) continue;
      const fraction = Math.sign(r) === side ? Math.abs(r) : 0;
      const b = p.baseline?.scene === k ? p.baseline : null;
      const mapping = this.mappingFor(k);
      const total = this.total(k);
      this.times[k] = b
        ? Math.min(
            total,
            Math.max(
              0,
              b.time + mapDrag(fraction, total, mapping) - mapDrag(b.ratio, total, mapping)
            )
          )
        : mapDrag(fraction, total, mapping);
    }
    this.loop();
  }

  private release(p: Press): void {
    this.press = null;
    if (!p.owning) {
      if (p.froze) this.resume();
      return;
    }
    this.suppressClick = true;
    // A finger held still before release carries no velocity (1.x).
    const now = performance.now();
    const v = now - p.t > VELOCITY_WINDOW_MS ? 0 : p.v;
    const r = this.pos - this.index;
    const scene = this.scenes[this.index];
    const authored = scene?.getAttribute('threshold') ?? null;
    const threshold =
      authored !== null || this.stage.hasAttribute('threshold')
        ? parseThreshold(authored, this.threshold, (m) => this.stage.report(m, scene ?? this.stage))
        : null;
    if (
      r !== 0 &&
      shouldCommit(r, v, threshold, p.cancelled, {
        duration: now - p.startTime,
        displacement: p.startY - p.y,
        viewport: this.vh,
      })
    ) {
      const target = this.index + (r > 0 ? 1 : -1);
      this.lane = {
        kind: 'commit',
        page: {
          from: this.pos,
          to: target,
          t0: now,
          duration: slideDuration(target - this.pos, this.transition),
          ease: easeOut,
        },
        target,
        from: this.index,
        frozen: false,
        detail: {
          progress: Math.abs(r),
          direction: r > 0 ? 'forward' : 'backward',
          elapsed: this.times[target] ?? 0,
          total: this.total(target),
        },
      };
      // Element time continues at real time from where the finger left it, beside the slide.
      this.play(target, this.times[target] ?? 0, this.total(target));
    } else {
      const duration = cancelDuration(r, this.transition);
      this.lane = {
        kind: 'cancel',
        page: { from: this.pos, to: this.index, t0: now, duration, ease: easeOut },
        target: this.index,
        from: this.index,
        frozen: false,
        detail: {
          progress: Math.abs(r),
          direction: r > 0 ? 'forward' : r < 0 ? 'backward' : null,
        },
      };
      for (const side of [1, -1] as const) {
        const k = this.index + side;
        const time = this.times[k] ?? 0;
        if (time > 0) this.heads[k] = { from: time, to: 0, t0: now, duration, ease: easeOut };
      }
    }
    this.loop();
  }

  // ---- time tracks --------------------------------------------------------------------------------

  private total(i: number): number {
    return this.scenes[i]?.solution.total ?? 0;
  }

  private mappingFor(i: number): DragMapping {
    const s = this.scenes[i];
    if (!s) return this.mapping;
    return parseMapping(s.getAttribute('unit'), s.getAttribute('scale'), this.mapping).mapping;
  }

  /** Real-time playhead for a scene's element time. */
  private play(i: number, from: number, to: number): void {
    this.heads[i] = {
      from,
      to,
      t0: performance.now(),
      duration: Math.abs(to - from),
      ease: linear,
    };
  }

  private sceneFor(id: string): number | null {
    return this.stage.sceneIndexOf(id);
  }

  // ---- frame loop: the only writer -----------------------------------------------------------------

  private loop = (): void => {
    if (this.destroyed || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  };

  private tick = (): void => {
    this.raf = 0;
    // One time base per frame: tweens, freezes and resumes start from performance.now(), and a rAF
    // timestamp can trail it by seconds (a lazily loaded iframe), so a release would never land.
    const now = performance.now();
    // What drove time in this frame, before a landing lane or a finished playhead is cleared.
    this.tickSource = this.source();
    let busy = this.press?.owning ?? false;
    const lane = this.lane;
    if (lane && !lane.frozen) {
      this.pos = tweenAt(lane.page, now);
      if (tweenDone(lane.page, now)) {
        this.pos = lane.target;
        this.lane = null;
        // The landing value, against the scene being left; the new scene starts at rest.
        this.reportProgress();
        if (this.destroyed) return;
        this.land(lane);
        if (this.destroyed) return;
        this.reported = this.pos;
      } else busy = true;
    }
    this.reportProgress();
    if (this.destroyed) return;
    if (!this.frozenHeads) {
      for (let i = 0; i < this.heads.length; i++) {
        const h = this.heads[i];
        if (!h) continue;
        this.times[i] = tweenAt(h, now);
        if (tweenDone(h, now)) this.heads[i] = null;
        else busy = true;
      }
    }
    if (this.signals.sample(this.pos * this.vh, now)) {
      this.stage.setHeading(this.signals.heading > 0 ? 'forward' : 'backward');
    }
    this.signals.step(now);
    this.write();
    this.tickSource = null;
    if (busy || (this.hasSignals && !this.signals.resting)) this.loop();
  };

  /** A lane landed: commit the switch (commit, goTo) or close the session (cancel). */
  private land(lane: Lane): void {
    if (lane.kind === 'cancel') {
      this.endSession('cancel', lane.detail);
      return;
    }
    this.switchTo(lane.target, lane.from);
    if (lane.kind === 'commit') {
      this.endSession('end', lane.detail && { ...lane.detail, from: lane.from, to: lane.target });
    }
  }

  private switchTo(target: number, from: number): void {
    const previous = this.index;
    this.index = target;
    // The scene left behind returns to its start: dragging back to it plays its entrance again.
    if (previous !== target) {
      this.times[previous] = 0;
      this.heads[previous] = null;
      this.departed.set(previous, target > previous ? 1 : -1);
    }
    this.departed.delete(target);
    this.applyWindow();
    if (from !== target) {
      this.stage.setCurrent(target);
      this.stage.announceCurrent();
    }
  }

  private endSession(
    kind: 'end' | 'cancel',
    detail?: Lane['detail'] & { from?: number; to?: number }
  ): void {
    if (!this.session) return;
    if (!detail) {
      // Superseded (goTo during a transaction): where the page was.
      const travel = this.pos - this.index;
      detail = {
        progress: Math.min(1, Math.abs(travel)),
        direction: travel > 0 ? 'forward' : travel < 0 ? 'backward' : null,
      };
    }
    this.session = false;
    this.emit(kind === 'end' ? 'cv-dragend' : 'cv-dragcancel', { index: this.index, ...detail });
  }

  /** `cv-progress` on the stage when the page moved (1.x onDragProgress): travel from the scene. */
  private reportProgress(): void {
    if (this.pos === this.reported) return;
    this.reported = this.pos;
    const travel = this.pos - this.index;
    this.emit('cv-progress', {
      kind: 'page',
      index: this.index,
      progress: Math.min(1, Math.abs(travel)),
      direction: travel > 0 ? 'forward' : travel < 0 ? 'backward' : null,
    });
  }

  private emit(type: string, detail: object): void {
    this.stage.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  }

  /** Current scene ±1 stay rendered; the rest are inert and skipped (plan v3 §7, drag). */
  private applyWindow(): void {
    this.scenes.forEach((s, i) => {
      const inWindow = Math.abs(i - this.index) <= 1;
      const active = i === this.index;
      s.toggleAttribute('inert', !active);
      if (active) s.removeAttribute('aria-hidden');
      else s.setAttribute('aria-hidden', 'true');
      s.style.contentVisibility = inWindow ? 'visible' : 'hidden';
      // write() covers scenes in the window; the rest follow the current scene.
      if (!inWindow) {
        // content-visibility skips descendants, but still paints the scene's own background.
        s.style.translate = `0 ${(i - this.pos) * this.vh}px`;
        const behind = s.isStacked && i < this.index;
        this.cover(s, behind);
        this.coverLook(s, behind ? 1 : 0);
        s.removeAttribute('data-cv-stuck');
      }
      s.toggleAttribute('data-cv-active', inWindow);
      for (const a of s.ordered) a.dragActive = active;
      if (!inWindow) {
        for (const a of s.ordered) a.stopLoops();
        this.times[i] = 0;
        this.heads[i] = null;
      }
      if (this.inWindow[i] !== inWindow) {
        this.inWindow[i] = inWindow;
        // Content outside the window is not laid out (content-visibility): measure decks now.
        if (inWindow) {
          const top = s.getBoundingClientRect().top;
          for (const a of s.ordered) if (isDeck(a)) a.measureDealt(top, this.vh);
        }
        s.active = inWindow;
        for (const a of s.ordered) a.activated(inWindow);
        s.dispatchEvent(
          new CustomEvent(inWindow ? 'cv-activate' : 'cv-deactivate', { bubbles: true })
        );
      }
    });
  }

  private write(): void {
    const vh = this.vh;
    const lo = Math.max(0, Math.floor(this.pos) - 1);
    const hi = Math.min(this.scenes.length - 1, Math.ceil(this.pos) + 1);
    const travel = this.pos - this.index;
    // The palette follows the scene past the middle of the page (lexicon #41), as under scroll.
    const eye = Math.round(this.pos);
    if (eye !== this.stage.eye) this.stage.showTheme(eye);
    for (let i = lo; i <= hi; i++) {
      const s = this.scenes[i]!;
      // Scene `stack` (plan v3 §9.3): once the page moves past a stacked scene it stays put
      // (`data-cv-stuck`, lexicon #18) and the next one slides over it; fully under it, it is
      // covered.
      const held = s.isStacked && this.pos > i;
      const offset = held ? 0 : (i - this.pos) * vh;
      s.style.translate = `0 ${offset}px`;
      s.toggleAttribute('data-cv-stuck', held && this.pos < i + 1);
      this.cover(s, held && this.pos >= i + 1);
      this.coverLook(s, held ? Math.min(1, this.pos - i) : 0);
      const t = this.times[i] ?? 0;
      // `track="x"`: the row moves on scene time, as the finger and then the clock advance it.
      if (s.isTrack) s.writeTrack(t);
      // The current scene departs with the page; exits run on the travel, in transition time.
      const departure =
        i === this.index && travel !== 0 ? Math.min(1, Math.abs(travel)) * this.transition : 0;
      const side: Side = travel >= 0 ? 1 : -1;
      if (t > 0) this.departed.delete(i);
      for (const a of s.ordered) {
        this.writeAnimate(a, t, offset, departure, side);
        if (isDeck(a)) a.writeTime(t);
        if (a.timed) {
          if (a.subscribed) a.sendFrame(this.frameFor(a, i, t, travel));
          else a.showPhase(this.phaseFor(a, i, t, travel));
        }
        if (a.loopItems.length && (!a.clocked || a.timed)) {
          if (
            !s.covered &&
            (!a.clocked || (a.timed && a.clockComplete)) &&
            (!a.solved || t >= a.solved.end)
          )
            a.startLoops(this.stage.clock);
          else a.stopLoops();
        }
      }
    }
  }

  /** Covered (`stack`): not painted, no loops (1.x `covered`). */
  private cover(s: CvScene, on: boolean): void {
    if (s.covered === on) return;
    s.covered = on;
    s.toggleAttribute('data-cv-covered', on);
    s.style.visibility = on ? 'hidden' : '';
    if (on) for (const a of s.ordered) a.stopLoops();
  }

  /** `covered` looks follow the next scene's travel over this one (scroll: its entry). */
  private coverLook(s: CvScene, p: number): void {
    if (!s.cover || p === s.coverProgress) return;
    s.coverProgress = p;
    writeCover(s, s.veil!, s.cover, p);
  }

  /** What drives element time right now (1.x timeline frame sources). */
  private source(): TimelineSource {
    if (this.tickSource) return this.tickSource;
    if (this.press?.owning) return 'gesture';
    if (this.lane) return this.lane.kind === 'goto' ? 'programmatic' : 'continuation';
    return this.heads.some(Boolean) ? 'continuation' : 'idle';
  }

  /** The element's timeline frame in scene i (el.timeline, <cv-video>). */
  private frameFor(a: CvAnimate, i: number, t: number, travel: number): TimelineFrame {
    const source = this.source();
    const phase = this.phaseFor(a, i, t, travel);
    if (phase === 'exiting') {
      // Departure on the page travel; leaving backwards is negative (1.x).
      const progress = Math.min(1, Math.abs(travel));
      return { progress, signedProgress: Math.sign(travel) * progress, phase, source };
    }
    if (phase === 'exited') {
      return { progress: 1, signedProgress: this.departed.get(i)!, phase, source };
    }
    const w = a.solved;
    const p = w ? progressIn(t, w.start, w.end) : t > 0 ? 1 : 0;
    return { progress: p, signedProgress: p, phase, source };
  }

  /** The phase alone (data-cv-phase), without building a frame: runs per frame for every element. */
  private phaseFor(a: CvAnimate, i: number, t: number, travel: number): TimelinePhase {
    if (i === this.index && travel !== 0) return 'exiting';
    if (t === 0 && this.departed.has(i)) return 'exited';
    const w = a.solved;
    const p = w ? progressIn(t, w.start, w.end) : t > 0 ? 1 : 0;
    if (p >= 1) return 'entered';
    // Incoming during a page travel, or the current scene before its time starts.
    return p > 0 || i === this.index || Math.abs(this.pos - i) < 1 ? 'entering' : 'idle';
  }

  /** el.timeline read: frames are sent only to subscribed elements. */
  frameOf(a: CvAnimate): TimelineFrame | null {
    const i = a.scene ? this.scenes.indexOf(a.scene) : -1;
    if (i < 0 || this.destroyed || !a.timed) return null;
    return this.frameFor(a, i, this.times[i] ?? 0, this.pos - this.index);
  }

  private writeAnimate(
    a: CvAnimate,
    t: number,
    offset: number,
    departure: number,
    side: Side
  ): void {
    const base = a.solved;
    const exitDuration = base?.exitDuration ?? 0;
    for (const layer of a.layers) {
      if (layer.source === 'clock') continue;
      if (isSignal(layer.source)) {
        writeSignal(layer, this.signals);
        continue;
      }
      if (layer.source === 'page') {
        // The stage's continuous scene position (plan v3 §3.5).
        const last = this.scenes.length - 1;
        writeLayer(layer, last > 0 ? Math.min(1, Math.max(0, this.pos / last)) : 0, 0);
        continue;
      }
      if (layer.source === 'view') {
        // Passage through the viewport: the scroll formula with the paging offset in place of the
        // scroll offset (plan v3 §9.3, F7); a departing scene carries on along the same line.
        const g = layer.subject === 'scene' ? undefined : this.local.get(a.viewSubject(layer));
        const top = offset + (g?.top ?? 0);
        writeLayer(layer, viewProgress(top, g?.height ?? this.vh, this.vh, layer.range), 0);
        continue;
      }
      const w = layer.window;
      if (!w || !base) continue;
      let p = progressIn(t, w.start, w.end);
      let px = 0;
      if (departure > 0 && exitDuration > 0) {
        if (side === 1) {
          // Forward: exits play on the departure, each layer in its slice of the exit window.
          px = layer.exitEffects.length
            ? progressIn(departure, w.exitStart - base.exitStart, w.exitEnd - base.exitStart)
            : 0;
        } else {
          // Backward: elements that declare an exit reverse their entrance instead (1.x).
          p *= 1 - Math.min(1, departure / exitDuration);
        }
      }
      writeLayer(layer, p, px);
    }
  }
}

const isDeck = (a: CvAnimate): a is CvStack => a.localName === 'cv-stack';
