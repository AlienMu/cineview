import { VideoDriver, type VideoOptions } from './driver';
import type { TimelineFrame } from './ownership';
import * as cache from './cache';
import { CvVideo, parseRange } from '../elements/video';

jest.mock('./cache', () => ({
  acquireVideoObjectUrl: jest.fn(),
  releaseVideoObjectUrl: jest.fn(),
  isMediaPreloaded: jest.fn(),
  preloadMedia: jest.fn(),
  subscribeToPreloadedMedia: jest.fn(),
}));

const options: VideoOptions = {
  src: '/clip.webm',
  preload: false,
  poster: null,
  playbackRate: 1,
  label: null,
  range: undefined,
};
const frame = (
  progress: number,
  phase: TimelineFrame['phase'] = progress < 1 ? 'entering' : 'entered'
): TimelineFrame => ({
  progress,
  signedProgress: progress,
  phase,
  source: 'clock',
});
const metadata = (video: HTMLVideoElement) => {
  Object.defineProperty(video, 'duration', { configurable: true, value: 10 });
  Object.defineProperty(video, 'readyState', { configurable: true, value: 2 });
  video.dispatchEvent(new Event('loadstart'));
  video.dispatchEvent(new Event('loadedmetadata'));
};
const drivers: VideoDriver[] = [];
const make = (changes: Partial<VideoOptions> = {}) => {
  const host = document.createElement('div');
  const driver = new VideoDriver(host);
  drivers.push(driver);
  driver.place(host.attachShadow({ mode: 'open' }));
  driver.configure({ ...options, ...changes });
  return { host, driver, video: driver.video! };
};

beforeAll(() => customElements.define('cv-video', CvVideo));

beforeEach(() => {
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  jest.mocked(cache.acquireVideoObjectUrl).mockReturnValue(undefined);
  jest.mocked(cache.subscribeToPreloadedMedia).mockReturnValue(jest.fn());
});
afterEach(() => {
  document.body.replaceChildren();
  for (const driver of drivers.splice(0)) driver.destroy();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('seeks every clock frame, including after metadata arrives at a partial entrance', () => {
  const { driver, video } = make();
  driver.frame(frame(0.4));
  expect(video.currentTime).toBe(0);
  metadata(video);
  expect(video.currentTime).toBe(4);
  driver.frame(frame(0.6));
  expect(video.currentTime).toBe(6);
  driver.frame(frame(1));
  expect(video.currentTime).toBe(10);
  expect(video.play).not.toHaveBeenCalled();
});

it('hands a bounded clock range to native playback once and respects a user pause', async () => {
  const { driver, video } = make({ range: [0, 6] });
  metadata(video);
  driver.frame(frame(0.5));
  expect(video.currentTime).toBe(3);
  driver.frame(frame(1));
  await Promise.resolve();
  expect(video.play).toHaveBeenCalledTimes(1);
  video.currentTime = 7;
  video.dispatchEvent(new Event('pause'));
  driver.frame(frame(1));
  expect(video.currentTime).toBe(7);
  expect(video.play).toHaveBeenCalledTimes(1);
});

it('keeps a user-paused native position when a cached blob replaces the network node', () => {
  const { driver, video } = make();
  metadata(video);
  video.currentTime = 7;
  video.dispatchEvent(new Event('play'));
  video.dispatchEvent(new Event('pause'));
  jest.mocked(cache.acquireVideoObjectUrl).mockReturnValue('blob:clip');
  const notify = jest.mocked(cache.subscribeToPreloadedMedia).mock.calls[0]![0];
  notify(options.src);
  const replacement = driver.video!;
  expect(replacement).not.toBe(video);
  expect(replacement.src).toBe('blob:clip');
  metadata(replacement);
  driver.frame(frame(1));
  expect(replacement.currentTime).toBe(7);
  expect(replacement.play).not.toHaveBeenCalled();
});

it('ignores an old play promise and events after release, then seeds the warmed node', async () => {
  let resolvePlay!: () => void;
  jest.mocked(HTMLMediaElement.prototype.play).mockReturnValue(
    new Promise<void>((resolve) => {
      resolvePlay = resolve;
    })
  );
  const { host, driver, video } = make({ range: [0, 6] });
  const onPlay = jest.fn();
  host.addEventListener('play', onPlay);
  metadata(video);
  driver.frame(frame(1));
  driver.release();
  driver.warmUp();
  const replacement = driver.video!;
  resolvePlay();
  await Promise.resolve();
  video.dispatchEvent(new Event('play'));
  video.dispatchEvent(new Event('loadedmetadata'));
  expect(onPlay).not.toHaveBeenCalled();
  driver.frame(frame(0.25));
  metadata(replacement);
  expect(replacement.currentTime).toBe(1.5);
  const calls = jest.mocked(HTMLMediaElement.prototype.play).mock.contexts;
  expect(calls.filter((node) => node === video)).toHaveLength(1);
  expect(calls.filter((node) => node === replacement)).toHaveLength(0);
});

it('restores a cancelled departure on the same decoded node', () => {
  const { driver, video } = make();
  driver.sceneActive = () => true;
  metadata(video);
  driver.frame(frame(0.4));
  driver.frame(frame(0.2, 'exiting'));
  driver.frame({ ...frame(0.4), source: 'idle' });
  expect(driver.video).toBe(video);
  expect(video.currentTime).toBe(4);
});

it('removes old listeners and releases cache leases on source changes and destroy', () => {
  jest.mocked(cache.acquireVideoObjectUrl).mockReturnValue('blob:clip');
  const { host, driver, video } = make();
  const onPlay = jest.fn();
  host.addEventListener('play', onPlay);
  driver.configure({ ...options, src: '/next.webm' });
  const replacement = driver.video!;
  metadata(video);
  video.dispatchEvent(new Event('play'));
  expect(onPlay).not.toHaveBeenCalled();
  expect(cache.releaseVideoObjectUrl).toHaveBeenCalledWith('/clip.webm');
  driver.destroy();
  metadata(replacement);
  replacement.dispatchEvent(new Event('play'));
  expect(driver.video).toBeNull();
  expect(onPlay).not.toHaveBeenCalled();
  expect(cache.releaseVideoObjectUrl).toHaveBeenLastCalledWith('/next.webm');
});

describe('cv-video with its real driver', () => {
  function element() {
    const host = document.createElement('cv-video') as CvVideo;
    host.setAttribute('src', '/clip.webm');
    host.setAttribute('preload', 'none');
    document.body.append(host);
    return host;
  }

  it('connects once, follows public timeline frames across layer rebuilds and unsubscribes on removal', () => {
    const host = element(),
      video = host.video!;
    metadata(video);
    host.sendFrame({ ...frame(0.3), source: 'scroll' });
    expect(video.currentTime).toBe(3);
    host.setAttribute('fx', 'fade');
    host.build(host.plan({ timeSource: 'scene', reducedMotion: false }, jest.fn()));
    expect(host.video).toBe(video);
    expect(host.shadowRoot!.querySelector('slot')!.parentElement!.contains(video)).toBe(true);
    host.sendFrame({ ...frame(0.6), source: 'scroll' });
    expect(video.currentTime).toBe(6);
    host.remove();
    expect(host.video).toBeNull();
    expect(host.subscribed).toBe(false);
    host.sendFrame(frame(0.9));
    expect(video.currentTime).toBe(6);
    document.body.append(host);
    expect(host.video).not.toBe(video);
    expect(host.subscribed).toBe(true);
  });

  it('updates media attributes and reports invalid ranges while retaining a usable element', () => {
    const host = element();
    const video = host.video!;
    host.setAttribute('poster', 'poster.png');
    host.setAttribute('aria-label', 'Preview');
    host.setAttribute('playback-rate', '2');
    expect(video.poster).toContain('poster.png');
    expect(video.playbackRate).toBe(2);
    expect(video.getAttribute('aria-label')).toBe('Preview');
    host.removeAttribute('poster');
    host.removeAttribute('aria-label');
    host.setAttribute('playback-rate', '-1');
    expect(video.hasAttribute('poster')).toBe(false);
    expect(video.hasAttribute('aria-label')).toBe(false);
    expect(video.playbackRate).toBe(1);
    metadata(video);
    host.sendFrame({ ...frame(0.5), source: 'scroll' });
    host.setAttribute('range', '2 6');
    expect(video.currentTime).toBe(4);
    host.setAttribute('range', 'nonsense');
    const report = jest.fn();
    host.build(host.plan({ timeSource: 'scene', reducedMotion: false }, report));
    expect(report).toHaveBeenCalledWith(expect.stringContaining('range="nonsense"'));
    host.setAttribute('src', '/next.webm');
    expect(host.video).not.toBe(video);
  });

  it('releases scrubbed video outside the activation window, rejects unsupported sources and restores on rebuild', () => {
    const host = element();
    const first = host.video!;
    host.activated(false);
    expect(host.video).toBe(first);
    metadata(first);
    host.sendFrame({ ...frame(0.3), source: 'scroll' });
    host.activated(false);
    expect(host.video!.getAttribute('src')).toBeNull();
    host.activated(true);
    expect(host.video!.src).toContain('/clip.webm');
    host.rejectSource();
    expect(host.video!.getAttribute('src')).toBeNull();
    host.build(host.plan({ timeSource: 'scene', reducedMotion: false }, jest.fn()));
    expect(host.video!.src).toContain('/clip.webm');
  });

  it('reports media failures on the owning stage and never forwards events from a replaced node', () => {
    const host = element(),
      failed = host.video!,
      report = jest.fn();
    host.scene = { stage: { report } } as unknown as import('../elements/scene').CvScene;
    Object.defineProperty(failed, 'error', { value: { code: 4 } });
    const error = jest.fn();
    host.addEventListener('error', error);
    failed.dispatchEvent(new Event('error'));
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining('/clip.webm'),
      host,
      'asset-failed'
    );
    expect(error).toHaveBeenCalledTimes(1);
    host.setAttribute('src', '/next.webm');
    failed.dispatchEvent(new Event('error'));
    expect(error).toHaveBeenCalledTimes(1);
    // This test injects only the reporting port; no scene registration was performed.
    host.scene = null;
  });

  it.each([
    ['6,0', [6, 0]],
    ['2 8', [2, 8]],
    [null, undefined],
    ['-1 2', undefined],
    ['1 2 3', undefined],
  ])('reads range %s', (value, expected) => {
    expect(parseRange(value as string | null)).toEqual(expected);
  });
});

it.each([true, false])(
  'restores a playing native tail after a blob swap only in an active scene (active %s)',
  async (active) => {
    const { host, driver, video } = make({ range: [0, 6] });
    driver.sceneActive = () => active;
    metadata(video);
    Object.defineProperty(video, 'paused', { configurable: true, value: false });
    video.currentTime = 7;
    video.dispatchEvent(new Event('play'));
    jest.mocked(cache.acquireVideoObjectUrl).mockReturnValue('blob:ready');
    jest.mocked(cache.subscribeToPreloadedMedia).mock.calls[0]![0](options.src);
    const replacement = driver.video!;
    metadata(replacement);
    await Promise.resolve();
    expect(replacement.currentTime).toBe(7);
    expect(
      jest
        .mocked(HTMLMediaElement.prototype.play)
        .mock.contexts.filter((node) => node === replacement)
    ).toHaveLength(active ? 1 : 0);
    const played = jest.fn();
    host.addEventListener('play', played);
    if (active) replacement.dispatchEvent(new Event('play'));
    expect(played).toHaveBeenCalledTimes(active ? 1 : 0);
  }
);

it.each(['reject', 'throw'])(
  'settles a failed native tail play without retrying on duplicate clock frames: %s',
  async (failure) => {
    const play = jest.mocked(HTMLMediaElement.prototype.play);
    if (failure === 'reject') play.mockRejectedValue(new Error('blocked'));
    else
      play.mockImplementation(() => {
        throw new Error('blocked');
      });
    const { driver, video } = make({ range: [0, 6] });
    metadata(video);
    driver.frame(frame(1));
    await Promise.resolve();
    driver.frame(frame(1));
    expect(play).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(6);
    driver.frame(frame(0.25));
    // A clock does not reverse/retry a rejected native handoff; a new activation may try again.
    expect(video.currentTime).toBe(6);
    expect(play).toHaveBeenCalledTimes(1);
    driver.release();
    driver.warmUp();
    driver.frame(frame(0.25));
    metadata(driver.video!);
    expect(driver.video!.currentTime).toBe(1.5);
  }
);
