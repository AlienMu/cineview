/**
 * <cv-video>: a video that follows its element's timeline (plan v3 §3.1, §9.1), with all of the
 * 1.x media semantics (media/driver.ts, media/ownership.ts). It is a <cv-animate>: `fx`, timing,
 * `after`, exits and sources work as on any element; without `fx` it is a neutral entrance whose
 * progress scrubs the video.
 *
 *   <cv-video src="hero.mp4" range="0 3.2" poster="hero.jpg"></cv-video>
 *
 * - `src`; `range="from to"` in seconds (reverse ranges allowed): the part of the file the
 *   timeline scrubs; when it ends before the file does, the rest plays natively at the end.
 * - `preload` (default on; `preload="none"` turns it off): fetch the whole file into the shared
 *   blob cache, so every frame is seekable.
 * - `poster`, `playback-rate`, `aria-label`. Style the node with `cv-video::part(video)`.
 * - `play`, `pause`, `ended` and `error` are re-dispatched on the element, only for the current
 *   node; a load failure is also a `cv-error` (`asset-failed`).
 */
import { IDLE_FRAME, VideoDriver } from '../media/driver';
import type { TimelineFrame } from '../media/ownership';
import type { Report } from '../core/errors';
import { CvAnimate, type AnimatePlan, type ClockEvent, type PlanContext } from './animate';

const VIDEO_ATTRIBUTES = ['src', 'range', 'preload', 'poster', 'playback-rate', 'aria-label'];

/** `range="0 3.2"`: seconds; anything else is no range. */
export function parseRange(text: string | null): readonly [number, number] | undefined {
  if (text === null) return undefined;
  const parts = text
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 2 || !parts.every((n) => Number.isFinite(n) && n >= 0)) return undefined;
  return [parts[0]!, parts[1]!];
}

export class CvVideo extends CvAnimate {
  static override readonly observedAttributes = [
    ...CvAnimate.observedAttributes,
    ...VIDEO_ATTRIBUTES,
  ];

  private driver: VideoDriver | null = null;
  private clockRun: { kind: 'enter' | 'exit'; start: number; duration: number } | null = null;
  private raf = 0;
  /** Clock time spent paused during the current run (the stage's pause applies here too). */
  private pausedAt: number | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.driver) {
      this.driver = new VideoDriver(this);
      this.driver.sceneActive = (): boolean | undefined => this.dragActive;
      this.driver.failed = (url): void =>
        this.scene?.stage?.report(`<cv-video> failed to load ${url}`, this, 'asset-failed');
      this.frameSink = (frame): void => this.driver?.frame(frame);
      this.clockSink = (event): void => this.onClock(event);
    }
    this.place();
    this.configure();
  }

  override attributeChangedCallback(
    name: string,
    before: string | null,
    after: string | null
  ): void {
    if (VIDEO_ATTRIBUTES.includes(name)) {
      if (before !== after) this.configure();
      return;
    }
    super.attributeChangedCallback(name, before, after);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf);
    this.driver?.destroy();
    this.driver = null;
    this.frameSink = null;
    this.clockSink = null;
  }

  override plan(context: PlanContext, report: Report): AnimatePlan {
    const range = this.getAttribute('range');
    if (range !== null && !parseRange(range)) {
      report(`range="${range}": expected two times in seconds, such as range="0 3.2"`);
    }
    return super.plan(context, report);
  }

  /** The node lives in the innermost layer, next to the slot; rebuilt layers get it back. */
  override build(plan: AnimatePlan): void {
    super.build(plan);
    this.place();
  }

  /** Scene left the activation window: drop decoded frames once it has been scrubbed. */
  override activated(on: boolean): void {
    if (on) this.driver?.warmUp();
    else if (this.driver?.scrubbed) this.driver.release();
  }

  /** The current node (null before connection). */
  get video(): HTMLVideoElement | null {
    return this.driver?.video ?? null;
  }

  private place(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const slot = root.querySelector('slot');
    this.driver?.place(slot?.parentNode ?? root);
  }

  private configure(): void {
    const rate = Number(this.getAttribute('playback-rate') ?? 1);
    const preload = this.getAttribute('preload');
    this.driver?.configure({
      src: this.getAttribute('src') ?? '',
      preload: preload !== 'none' && preload !== 'false',
      poster: this.getAttribute('poster'),
      playbackRate: Number.isFinite(rate) && rate > 0 ? rate : 1,
      label: this.getAttribute('aria-label'),
      range: parseRange(this.getAttribute('range')),
    });
  }

  // ---- entrances played on the clock (enter / eye sources): frames from the clock -------------

  private onClock(event: ClockEvent): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.pausedAt = null;
    switch (event.type) {
      case 'reset':
        this.clockRun = null;
        this.send(IDLE_FRAME);
        return;
      case 'reveal':
        this.clockRun = null;
        this.send({ progress: 1, signedProgress: 1, phase: 'entered', source: 'visibility' });
        return;
      default:
        this.clockRun = { kind: event.type, start: event.start, duration: event.duration };
    }
    this.tick();
  }

  private tick = (): void => {
    this.raf = 0;
    const run = this.clockRun;
    if (!run) return;
    const now = performance.now();
    const paused = this.scene?.stage?.clock.paused ?? false;
    if (paused) {
      this.pausedAt ??= now;
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    if (this.pausedAt !== null) {
      run.start += now - this.pausedAt;
      this.pausedAt = null;
    }
    const p = run.duration > 0 ? Math.min(1, Math.max(0, (now - run.start) / run.duration)) : 1;
    if (now < run.start) {
      // Waiting for its delay: hold the starting frame.
      if (run.kind === 'enter')
        this.send({ ...IDLE_FRAME, phase: 'entering', source: 'visibility' });
    } else if (run.kind === 'enter') {
      this.send({
        progress: p,
        signedProgress: p,
        phase: p >= 1 ? 'entered' : 'entering',
        source: 'visibility',
      });
    } else {
      this.send({
        progress: p,
        signedProgress: p,
        phase: p >= 1 ? 'exited' : 'exiting',
        source: 'visibility',
      });
    }
    if (p < 1 || now < run.start) this.raf = requestAnimationFrame(this.tick);
    else this.clockRun = null;
  };

  private send(frame: TimelineFrame): void {
    this.driver?.frame(frame);
  }
}
