/**
 * Clock animations of one stage: entrances played on time and loops. Each is a fresh WAAPI
 * animation (transform and opacity run on the compositor). The stage pauses and resumes all of
 * them together: `stage.pause()`, the `paused` attribute and <cv-pause> (WCAG 2.2.2).
 */
export class Clock {
  private animations = new Set<Animation>();
  private stopped = false;

  get paused(): boolean {
    return this.stopped;
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
    this.stopped = true;
    for (const a of this.animations) if (a.playState === 'running') a.pause();
  }

  play(): void {
    this.stopped = false;
    for (const a of this.animations) if (a.playState === 'paused') a.play();
  }
}
