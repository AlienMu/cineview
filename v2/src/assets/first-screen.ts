/**
 * The first-screen gate (plan v3 §10; 1.x useFirstSceneEnter). Once per stage, the scene the page
 * opens on may hold its entrance until its assets are ready:
 *
 * - `<cv-scene preload>` waits for the images and videos inside it; `preload="a.jpg b.mp4"` adds
 *   URLs. An image is ready when decoded; a scrub video (<cv-video>, or a listed video URL) when
 *   the whole file is in the blob cache, so every frame can be sought (1.x priorityComplete); a
 *   plain <video> when its first frame is loaded. A failed asset counts as settled and is
 *   reported as `cv-error`.
 * - The wait is capped by the stage's `first-scene-timeout` (default 3000 ms). On timeout the stage
 *   dispatches a cancelable `cv-timeout` with `{ loaded, total }`; unless it is cancelled the
 *   entrance plays. Cancelled, the entrance waits for the assets (consumer-driven recovery).
 * - A scene without `preload` is not held.
 *
 * The input asks `held` before playing the first screen and registers `whenReleased` otherwise.
 */
import { inferMediaKind, preloadMedia } from '../media/cache';

export interface FirstScreenHost extends HTMLElement {
  report(message: string, element?: Element): void;
}

export class FirstScreenGate {
  held = false;
  private listeners: Array<() => void> = [];
  private timer = 0;
  private loaded = 0;
  private total = 0;
  private disposed = false;

  constructor(
    private stage: FirstScreenHost,
    scene: Element | null,
    timeoutMs: number
  ) {
    if (!scene?.hasAttribute('preload')) return;
    const waits = this.collect(scene);
    this.total = waits.length;
    if (!waits.length) return;
    this.held = true;
    for (const w of waits) {
      void w.then(() => {
        this.loaded++;
        if (this.loaded === this.total) this.release();
      });
    }
    this.timer = window.setTimeout(() => this.timeout(), Math.max(0, timeoutMs));
  }

  /** Run `fn` when the gate opens (at once if it is open). */
  whenReleased(fn: () => void): void {
    if (!this.held) fn();
    else this.listeners.push(fn);
  }

  /** A gesture took over the first screen (drag): stop holding without playing. */
  preempt(): void {
    clearTimeout(this.timer);
    this.held = false;
    this.listeners = [];
  }

  dispose(): void {
    this.disposed = true;
    this.preempt();
  }

  private release(): void {
    if (!this.held || this.disposed) return;
    clearTimeout(this.timer);
    this.held = false;
    const listeners = this.listeners;
    this.listeners = [];
    for (const fn of listeners) fn();
  }

  private timeout(): void {
    if (!this.held || this.disposed) return;
    const event = new CustomEvent('cv-timeout', {
      bubbles: true,
      cancelable: true,
      detail: { loaded: this.loaded, total: this.total },
    });
    if (this.stage.dispatchEvent(event)) this.release();
  }

  /** One promise per asset; each resolves when the asset settles (ready or failed). */
  private collect(scene: Element): Array<Promise<void>> {
    const waits: Array<Promise<void>> = [];
    for (const img of scene.querySelectorAll('img')) waits.push(this.image(img));
    for (const video of scene.querySelectorAll('video')) waits.push(this.video(video));
    const scrub = [...scene.querySelectorAll('cv-video')]
      .map((v) => v.getAttribute('src'))
      .filter((src): src is string => !!src);
    const urls = (scene.getAttribute('preload') ?? '').split(/[\s,]+/).filter(Boolean);
    for (const url of new Set([...scrub, ...urls.filter((u) => inferMediaKind(u))])) {
      waits.push(
        preloadMedia(url, 'video').catch(() =>
          this.stage.report(`preload: video failed to load: ${url}`)
        )
      );
    }
    for (const url of urls) {
      if (inferMediaKind(url)) continue;
      const img = new Image();
      img.src = url;
      waits.push(this.image(img));
    }
    return waits;
  }

  private image(img: HTMLImageElement): Promise<void> {
    // Lazy images on the first screen would never load while held: load them now.
    if (img.loading === 'lazy') img.loading = 'eager';
    return img.decode().then(
      () => undefined,
      () => {
        // decode() also rejects for images that loaded but cannot be decoded off-thread (SVG).
        if (img.complete && img.naturalWidth > 0) return;
        this.stage.report(`preload: image failed to load: ${img.currentSrc || img.src}`, img);
      }
    );
  }

  private video(video: HTMLVideoElement): Promise<void> {
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve) => {
      const done = (failed: boolean): void => {
        video.removeEventListener('loadeddata', ok);
        video.removeEventListener('error', fail);
        if (failed)
          this.stage.report(
            `preload: video failed to load: ${video.currentSrc || video.src}`,
            video
          );
        resolve();
      };
      const ok = (): void => done(false);
      const fail = (): void => done(true);
      video.addEventListener('loadeddata', ok);
      video.addEventListener('error', fail);
      if (video.preload === 'none') video.preload = 'auto';
      if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
    });
  }
}
