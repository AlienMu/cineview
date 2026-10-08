/**
 * Clock animations of one stage: entrances played on time and loops. Each is a fresh WAAPI
 * animation (transform and opacity run on the compositor). The stage pauses and resumes all of
 * them together: `stage.pause()`, the `paused` attribute and <cv-pause> (WCAG 2.2.2).
 */
export class Clock {
  private animations = new Set<Animation>();
  private stopped = false;
  private pausedSince = 0;
  private pausedTotal = 0;

  get paused(): boolean {
    return this.stopped;
  }

  /** Clock time at a performance.now() instant: real time less the time spent paused (ms). */
  now(at = performance.now()): number {
    return at - this.pausedTotal - (this.stopped ? Math.max(0, at - this.pausedSince) : 0);
  }

  /** Track an animation; it starts paused if the stage is paused. */
  add(animation: Animation): Animation {
    this.animations.add(animation);
    if (this.stopped) animation.pause();
    const forget = (): void => {
      this.animations.delete(animation);
    };
    animation.finished.then(forget, forget);
    return animation;
  }

  pause(): void {
    if (!this.stopped) this.pausedSince = performance.now();
    this.stopped = true;
    for (const a of this.animations) if (a.playState === 'running') a.pause();
  }

  play(): void {
    if (this.stopped) this.pausedTotal += performance.now() - this.pausedSince;
    this.stopped = false;
    for (const a of this.animations) if (a.playState === 'paused') a.play();
  }
}
