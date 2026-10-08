/**
 * Drag input: one-viewport scenes paged by pointer, keyboard or goTo().
 *
 * Two tracks, as in 1.x: page position (`pos`, continuous scene index) and
 * each scene's element time. Input submits intent; the frame loop is the only
 * writer. Everything is direct style writes (plan v3 §6: drag has no native
 * scroll timeline, and seek-then-resume is avoided).
 */
import { progressIn, writeLayer } from './layers';
import type { CvAnimate, CvScene, CvStage, DragEngine } from './elements';

const INTERACTIVE =
  'a,button,input,textarea,select,option,summary,[contenteditable=""],[contenteditable="true"],[data-cv-ignore-drag],[data-cineview-ignore-drag]';
const VELOCITY_WINDOW_MS = 100;

interface Sample {
  t: number;
  y: number;
}

type Mode = 'idle' | 'dragging' | 'settling';

export function createDragEngine(stage: CvStage): DragEngine {
  return new Drag(stage);
}

class Drag implements DragEngine {
  private scenes: CvScene[];
  private vh = window.innerHeight;
  private index = 0;
  /** Displayed page position (continuous index). */
  private pos = 0;
  /** Displayed element time per scene (ms). */
  private times: number[];
  private mode: Mode = 'idle';
  private startY = 0;
  private startPos = 0;
  private startTimes: number[] = [];
  private samples: Sample[] = [];
  private pointerId: number | null = null;
  // Settle animation (page) and per-scene playheads (element time).
  private settle: { from: number; to: number; t0: number; duration: number } | null = null;
  private playheads: Array<{ from: number; to: number; t0: number } | null>;
  private raf = 0;
  private transition: number;
  private unitMsPerPercent: number;
  private suppressClick = false;
  private inWindow: boolean[] = [];
  /** Element geometry relative to its scene, measured in refresh() (per-element view progress, plan v3 F7). */
  private local = new Map<CvAnimate, { top: number; height: number }>();

  constructor(private stage: CvStage) {
    this.scenes = stage.ordered;
    this.times = this.scenes.map(() => 0);
    this.playheads = this.scenes.map(() => null);
    this.transition = Number(stage.getAttribute('transition-duration') ?? 600) || 600;
    const unit = stage.getAttribute('unit');
    const scale = Number(stage.getAttribute('scale') ?? 1) || 1;
    // Default 1.x mapping: 1% of the viewport = 10 ms. `unit="percent"` maps 100% to the scene total.
    this.unitMsPerPercent = unit === 'percent' ? Number.NaN : 10 * scale;

    Object.assign(stage.style, {
      position: 'fixed',
      inset: '0',
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
    });
    stage.setAttribute('role', 'region');
    if (!stage.hasAttribute('aria-roledescription'))
      stage.setAttribute('aria-roledescription', 'carousel');
    stage.tabIndex = 0;
    for (const s of this.scenes) {
      Object.assign(s.style, {
        position: 'absolute',
        inset: '0',
        height: '100%',
        willChange: 'translate',
      });
    }
    stage.addEventListener('pointerdown', this.onDown);
    stage.addEventListener('click', this.onClick, true);
    stage.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize, { passive: true });
    this.refresh();
    // First scene: entrance plays on the clock from 0, like 1.x first-scene enter.
    this.play(0, 0, this.total(0));
    this.loop();
  }

  currentIndex(): number {
    return this.index;
  }

  refresh(): void {
    this.vh = window.innerHeight;
    this.local.clear();
    for (const s of this.scenes) {
      const base = s.getBoundingClientRect().top;
      for (const a of s.ordered) {
        if (a.layers.some((l) => l.source === 'view' && l.subject === 'self')) {
          const r = a.getBoundingClientRect();
          this.local.set(a, { top: r.top - base, height: r.height });
        }
      }
    }
    this.applyWindow();
    this.write();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.stage.removeEventListener('pointerdown', this.onDown);
    this.stage.removeEventListener('click', this.onClick, true);
    this.stage.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  goTo(target: number): void {
    target = Math.max(0, Math.min(this.scenes.length - 1, target));
    if (target === this.index && this.mode === 'idle') return;
    this.commit(target, this.pos);
  }

  // ---- input ---------------------------------------------------------------

  private onResize = (): void => this.refresh();

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.pointerId !== null) return;
    if ((e.target as Element).closest?.(INTERACTIVE)) return;
    // Re-grab during settle: take over from the displayed frame, never flush (1.x rule).
    this.settle = null;
    this.playheads = this.playheads.map(() => null);
    this.mode = 'dragging';
    this.pointerId = e.pointerId;
    this.startY = e.clientY;
    this.startPos = this.pos;
    this.startTimes = this.times.slice();
    this.samples = [{ t: e.timeStamp, y: e.clientY }];
    this.suppressClick = false;
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    this.stage.dispatchEvent(
      new CustomEvent('cv-dragstart', { bubbles: true, detail: { index: this.index } })
    );
    this.loop();
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const dy = e.clientY - this.startY;
    if (Math.abs(dy) > 6) this.suppressClick = true;
    let pos = this.startPos - dy / this.vh;
    // Boundary rejection with resistance at the ends.
    const max = this.scenes.length - 1;
    if (pos < 0) pos = -this.resist(-pos);
    if (pos > max) pos = max + this.resist(pos - max);
    this.pos = pos;
    this.samples.push({ t: e.timeStamp, y: e.clientY });
    const cutoff = e.timeStamp - VELOCITY_WINDOW_MS * 2;
    while (this.samples.length > 2 && this.samples[0]!.t < cutoff) this.samples.shift();
    this.scrubTimes();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.pointerId = null;
    const velocity = this.releaseVelocity(e.timeStamp); // px/s, positive = finger down
    const travel = (this.pos - this.index) * this.vh; // positive = toward next
    const fast = Math.abs(velocity) >= 1000;
    const need = fast ? 0.15 : 0.3;
    let target = this.index;
    if (Math.abs(travel) > need * this.vh) target = this.index + Math.sign(travel);
    target = Math.max(0, Math.min(this.scenes.length - 1, target));
    if (target !== this.index) {
      this.stage.dispatchEvent(
        new CustomEvent('cv-dragend', { bubbles: true, detail: { from: this.index, to: target } })
      );
      this.commit(target, this.pos);
    } else {
      this.stage.dispatchEvent(
        new CustomEvent('cv-dragcancel', { bubbles: true, detail: { index: this.index } })
      );
      this.cancel();
    }
  };

  private onClick = (e: Event): void => {
    if (this.suppressClick) {
      e.stopPropagation();
      e.preventDefault();
      this.suppressClick = false;
    }
  };

  private onKey = (e: KeyboardEvent): void => {
    if ((e.target as Element).closest?.('input,textarea,select,[contenteditable]')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
      e.preventDefault();
      this.goTo(this.index + 1);
    } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      this.goTo(this.index - 1);
    }
  };

  private resist(over: number): number {
    return over * 0.25;
  }

  /** Velocity from samples inside the last 100 ms; older samples mean a held finger (1.x rule). */
  private releaseVelocity(now: number): number {
    const recent = this.samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
    if (recent.length < 2) return 0;
    const a = recent[0]!;
    const b = recent[recent.length - 1]!;
    const dt = b.t - a.t;
    return dt > 0 ? ((b.y - a.y) / dt) * 1000 : 0;
  }

  // ---- time tracks ---------------------------------------------------------

  private total(i: number): number {
    return this.scenes[i]?.solution.total ?? 0;
  }

  private msForTravel(i: number, fraction: number): number {
    const total = this.total(i);
    if (Number.isNaN(this.unitMsPerPercent)) return total * fraction;
    return Math.min(total, fraction * 100 * this.unitMsPerPercent);
  }

  /** While dragging, scene times follow the finger (scrub). */
  private scrubTimes(): void {
    const forward = this.pos - this.index; // >0 moving to next
    const next = this.index + 1;
    const prev = this.index - 1;
    for (let i = 0; i < this.scenes.length; i++) this.times[i] = this.startTimes[i] ?? 0;
    if (forward > 0 && next < this.scenes.length) {
      this.times[next] = Math.max(this.startTimes[next] ?? 0, this.msForTravel(next, forward));
      // Departing forward: run its exit section with the page.
      const cur = this.scenes[this.index]!;
      const exitSpan = cur.solution.total - cur.solution.entranceEnd;
      if (exitSpan > 0)
        this.times[this.index] = cur.solution.entranceEnd + exitSpan * Math.min(1, forward);
    } else if (forward < 0 && prev >= 0) {
      // Going back: the current scene's entrance reverses with the finger.
      const cur = this.index;
      const start = this.startTimes[cur] ?? this.total(cur);
      this.times[cur] = Math.max(0, start - this.msForTravel(cur, -forward));
    }
  }

  private play(i: number, from: number, to: number): void {
    this.playheads[i] = { from, to, t0: performance.now() };
  }

  private commit(target: number, fromPos: number): void {
    const leaving = this.index;
    this.mode = 'settling';
    this.settle = { from: fromPos, to: target, t0: performance.now(), duration: this.transition };
    // Arriving scene continues from the displayed frame to its end at real time.
    this.play(target, this.times[target] ?? 0, this.total(target));
    if (target > leaving) {
      const s = this.scenes[leaving]!;
      if (s.solution.total > s.solution.entranceEnd)
        this.play(leaving, this.times[leaving] ?? 0, s.solution.total);
    } else {
      this.play(leaving, this.times[leaving] ?? 0, 0);
    }
    if (target !== leaving) {
      this.scenes[leaving]!.dispatchEvent(new CustomEvent('cv-leave', { bubbles: true }));
      this.index = target;
      this.applyWindow();
      this.scenes[target]!.dispatchEvent(new CustomEvent('cv-enter', { bubbles: true }));
    }
    this.loop();
  }

  private cancel(): void {
    this.mode = 'settling';
    this.settle = {
      from: this.pos,
      to: this.index,
      t0: performance.now(),
      duration: this.transition,
    };
    for (let i = 0; i < this.scenes.length; i++) {
      if ((this.times[i] ?? 0) !== (this.startTimes[i] ?? 0))
        this.play(i, this.times[i] ?? 0, this.startTimes[i] ?? 0);
    }
    this.loop();
  }

  // ---- frame loop: the only writer -------------------------------------------

  private loop = (): void => {
    if (this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  };

  private tick = (now: number): void => {
    this.raf = 0;
    let busy = this.mode === 'dragging';
    if (this.settle) {
      const s = this.settle;
      const k = Math.min(1, (now - s.t0) / s.duration);
      const e = 1 - Math.pow(1 - k, 3);
      this.pos = s.from + (s.to - s.from) * e;
      if (k >= 1) {
        this.settle = null;
        this.pos = s.to;
      } else busy = true;
    }
    for (let i = 0; i < this.playheads.length; i++) {
      const p = this.playheads[i];
      if (!p) continue;
      const dir = Math.sign(p.to - p.from);
      const t = p.from + dir * (now - p.t0);
      if ((dir >= 0 && t >= p.to) || (dir < 0 && t <= p.to)) {
        this.times[i] = p.to;
        this.playheads[i] = null;
      } else {
        this.times[i] = t;
        busy = true;
      }
    }
    if (!busy && this.mode === 'settling') this.mode = 'idle';
    this.write();
    if (busy) this.loop();
  };

  /** Scenes outside current ±1 are inert and skipped for painting (plan v3 §7, drag input). */
  private applyWindow(): void {
    this.scenes.forEach((s, i) => {
      const inWindow = Math.abs(i - this.index) <= 1;
      const active = i === this.index;
      s.toggleAttribute('inert', !active);
      if (active) s.removeAttribute('aria-hidden');
      else s.setAttribute('aria-hidden', 'true');
      s.style.contentVisibility = inWindow ? 'visible' : 'hidden';
      s.toggleAttribute('data-cv-active', active);
      if (this.inWindow[i] !== inWindow) {
        this.inWindow[i] = inWindow;
        s.dispatchEvent(
          new CustomEvent(inWindow ? 'cv-activate' : 'cv-deactivate', { bubbles: true })
        );
      }
    });
  }

  private write(): void {
    const vh = this.vh;
    const lo = Math.floor(this.pos) - 1;
    const hi = Math.ceil(this.pos) + 1;
    for (let i = Math.max(0, lo); i <= Math.min(this.scenes.length - 1, hi); i++) {
      const s = this.scenes[i]!;
      const offset = (i - this.pos) * vh;
      s.style.translate = `0 ${offset}px`;
      const t = this.times[i] ?? 0;
      // Scene passage through the viewport, same formula as scroll "cover" (plan v3 §9.3).
      const sceneView = (vh - offset) / (2 * vh);
      for (const a of s.ordered) this.writeAnimate(a, t, sceneView, offset);
    }
  }

  private writeAnimate(a: CvAnimate, t: number, sceneView: number, offset: number): void {
    const w = a.solved;
    for (const layer of a.layers) {
      if (layer.source === 'view') {
        let v = sceneView;
        if (layer.subject === 'self') {
          const g = this.local.get(a);
          if (g) v = (this.vh - (offset + g.top)) / (this.vh + g.height);
        }
        writeLayer(layer, Math.min(Math.max(v, 0), 1), -1);
      } else if (w) {
        writeLayer(
          layer,
          progressIn(t, w.start, w.end),
          layer.exitEffects.length ? progressIn(t, w.exitStart, w.exitEnd) : -1
        );
      }
    }
  }
}
