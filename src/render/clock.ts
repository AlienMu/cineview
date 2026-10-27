/**
 * Clock animations of one stage: entrances played on time and loops. Each is a fresh WAAPI
 * animation (transform and opacity run on the compositor). The stage pauses and resumes all of
 * them together: `stage.pause()`, the `paused` attribute and <cv-pause> (WCAG 2.2.2).
 */
const timelineNow = (): number => {
  const time = typeof document === 'undefined' ? null : document.timeline?.currentTime;
  return typeof time === 'number' ? time : performance.now();
};

export class Clock {
  private animations = new Set<Animation>();
  private stopped = false;
  private pausedSince = 0;
  private pausedTotal = 0;
  private ticks = new Set<(time: number) => void>();
  private raf = 0;

  /** Direct clock outputs share one stage callback and hold while the stage is paused. */
  subscribe(tick: (time: number) => void): () => void {
    this.ticks.add(tick);
    tick(this.now());
    this.queue();
    return () => {
      this.ticks.delete(tick);
      if (!this.ticks.size) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
    };
  }

  private queue(): void {
    if (!this.raf && !this.stopped && this.ticks.size) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (at: number): void => {
    this.raf = 0;
    if (this.stopped) return;
    const time = this.now(at);
    for (const tick of this.ticks) tick(time);
    this.queue();
  };

  get paused(): boolean {
    return this.stopped;
  }

  /** Clock time at a document-timeline instant: real time less the time spent paused (ms). */
  now(at = timelineNow()): number {
    return at - this.pausedTotal - (this.stopped ? Math.max(0, at - this.pausedSince) : 0);
  }

  /** Track an animation; it starts paused if the stage is paused. */
  add(animation: Animation): Animation {
    this.animations.add(animation);
    if (this.stopped) this.hold(animation);
    else this.resume(animation);
    const forget = (): void => {
      this.animations.delete(animation);
    };
    animation.finished.then(forget, forget);
    return animation;
  }

  private hold(animation: Animation): void {
    // WAAPI pause resolves on a later frame. Set hold time now so repeated pauses cannot advance it.
    const time = animation.currentTime ?? 0;
    animation.pause();
    animation.currentTime = time;
  }

  private resume(animation: Animation): void {
    const time = animation.currentTime ?? 0;
    animation.play();
    // Resolve pending playback on the same document time as Clock.now(), rather than a later RAF.
    if (typeof time === 'number' && animation.playbackRate)
      animation.startTime = timelineNow() - time / animation.playbackRate;
  }

  pause(): void {
    if (!this.stopped) this.pausedSince = timelineNow();
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const a of this.animations) if (a.playState === 'running') this.hold(a);
  }

  play(): void {
    if (this.stopped) this.pausedTotal += timelineNow() - this.pausedSince;
    this.stopped = false;
    for (const a of this.animations) if (a.playState === 'paused') this.resume(a);
    this.queue();
  }
}
