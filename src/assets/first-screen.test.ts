import { FirstScreenGate, type FirstScreenHost } from './first-screen';
import { preloadMedia } from '../media/cache';

jest.mock('../media/cache', () => ({
  ...jest.requireActual('../media/cache'),
  preloadMedia: jest.fn(),
}));
const deferred = () => {
  let resolve!: () => void, reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
function screen(html = '', preload: string | null = '') {
  const stage = document.createElement('div') as unknown as FirstScreenHost;
  stage.report = jest.fn();
  const scene = document.createElement('section');
  scene.innerHTML = html;
  if (preload !== null) scene.setAttribute('preload', preload);
  stage.append(scene);
  return { stage, scene };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(preloadMedia).mockResolvedValue();
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it.each([null, ''])('opens immediately without pending assets (preload %s)', (preload) => {
  const { stage, scene } = screen('', preload);
  const gate = new FirstScreenGate(stage, scene, 1000),
    released = jest.fn();
  gate.whenReleased(released);
  expect(gate.held).toBe(false);
  expect(released).toHaveBeenCalledTimes(1);
  gate.dispose();
});

it('waits for each image decode, reports progress and releases exactly once', async () => {
  const { stage, scene } = screen('<img loading="lazy" src="a.png"><img src="b.png">');
  const a = deferred(),
    b = deferred();
  const images = [...scene.querySelectorAll('img')];
  images[0]!.loading = 'lazy';
  images[0]!.decode = () => a.promise;
  images[1]!.decode = () => b.promise;
  const progress: unknown[] = [];
  stage.addEventListener('cv-progress', (e) => progress.push((e as CustomEvent).detail));
  const gate = new FirstScreenGate(stage, scene, 1000),
    released = jest.fn();
  gate.whenReleased(released);
  expect(images[0]!.loading).toBe('eager');
  a.resolve();
  await flush();
  expect(gate.held).toBe(true);
  expect(progress).toEqual([{ kind: 'load', loaded: 1, total: 2, progress: 0.5 }]);
  b.resolve();
  await flush();
  expect(gate.held).toBe(false);
  expect(released).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000);
  expect(progress).toHaveLength(2);
  expect(stage.report).not.toHaveBeenCalled();
  gate.dispose();
});

it.each([false, true])(
  'settles a decode rejection, reporting only a broken image (loaded %s)',
  async (loaded) => {
    const { stage, scene } = screen('<img src="a.svg">');
    const img = scene.querySelector('img')!;
    img.decode = () => Promise.reject(new Error('decode'));
    Object.defineProperty(img, 'complete', { value: loaded });
    Object.defineProperty(img, 'naturalWidth', { value: loaded ? 100 : 0 });
    const gate = new FirstScreenGate(stage, scene, 1000);
    await flush();
    expect(gate.held).toBe(false);
    expect(stage.report).toHaveBeenCalledTimes(loaded ? 0 : 1);
    if (!loaded)
      expect(stage.report).toHaveBeenCalledWith(
        expect.stringContaining('a.svg'),
        img,
        'asset-failed'
      );
    gate.dispose();
  }
);

it.each([false, true])(
  'times out, and cancellation keeps waiting for the asset (cancel %s)',
  async (cancel) => {
    const { stage, scene } = screen('<img>'),
      pending = deferred();
    scene.querySelector('img')!.decode = () => pending.promise;
    const timeout = jest.fn((e: Event) => {
      if (cancel) e.preventDefault();
    });
    stage.addEventListener('cv-timeout', timeout);
    const gate = new FirstScreenGate(stage, scene, 100),
      released = jest.fn();
    gate.whenReleased(released);
    jest.advanceTimersByTime(100);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect((timeout.mock.calls[0]![0] as CustomEvent).detail).toEqual({ loaded: 0, total: 1 });
    expect(gate.held).toBe(cancel);
    expect(released).toHaveBeenCalledTimes(cancel ? 0 : 1);
    pending.resolve();
    await flush();
    expect(gate.held).toBe(false);
    expect(released).toHaveBeenCalledTimes(1);
    gate.dispose();
  }
);

it('preemption abandons the entrance callback and its timeout', async () => {
  const { stage, scene } = screen('<img>'),
    pending = deferred();
  scene.querySelector('img')!.decode = () => pending.promise;
  const timeout = jest.fn();
  stage.addEventListener('cv-timeout', timeout);
  const gate = new FirstScreenGate(stage, scene, 100),
    released = jest.fn();
  gate.whenReleased(released);
  gate.preempt();
  pending.resolve();
  await flush();
  jest.advanceTimersByTime(100);
  expect(gate.held).toBe(false);
  expect(released).not.toHaveBeenCalled();
  expect(timeout).not.toHaveBeenCalled();
  gate.dispose();
});

it.each(['loadeddata', 'error'])(
  'settles an ordinary video on %s and removes both event listeners',
  async (event) => {
    const { stage, scene } = screen('<video preload="none" src="clip.webm"></video>');
    const video = scene.querySelector('video')!;
    const remove = jest.spyOn(video, 'removeEventListener');
    const gate = new FirstScreenGate(stage, scene, 1000);
    expect(video.preload).toBe('auto');
    expect(video.load).toHaveBeenCalledTimes(1);
    video.dispatchEvent(new Event(event));
    await flush();
    expect(gate.held).toBe(false);
    expect(remove.mock.calls.map(([name]) => name)).toEqual(['loadeddata', 'error']);
    expect(stage.report).toHaveBeenCalledTimes(event === 'error' ? 1 : 0);
    gate.dispose();
  }
);

it('accepts already decoded video without reloading it', async () => {
  const { stage, scene } = screen('<video></video>');
  Object.defineProperty(scene.querySelector('video')!, 'readyState', { value: 2 });
  const gate = new FirstScreenGate(stage, scene, 1000);
  await flush();
  expect(gate.held).toBe(false);
  expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
  gate.dispose();
});

it('deduplicates scrub video URLs and settles failed cache requests alongside extra images', async () => {
  const { stage, scene } = screen(
    '<cv-video src="clip.webm"></cv-video><cv-video src="clip.webm"></cv-video>',
    'clip.webm extra.mp4 cover.jpg'
  );
  jest.mocked(preloadMedia).mockRejectedValue(new Error('network'));
  const gate = new FirstScreenGate(stage, scene, 1000);
  await flush();
  expect(jest.mocked(preloadMedia).mock.calls).toEqual([
    ['clip.webm', 'video'],
    ['extra.mp4', 'video'],
  ]);
  expect(stage.report).toHaveBeenCalledTimes(2);
  expect(gate.held).toBe(false);
  gate.dispose();
});

it.each(['image', 'cache', 'video'])('ignores late %s failure after dispose', async (kind) => {
  const { stage, scene } = screen(
    kind === 'video' ? '<video></video>' : '<img>',
    kind === 'cache' ? 'clip.webm' : ''
  );
  const pending = deferred();
  scene.querySelector('img')?.setAttribute('src', 'late.png');
  if (kind === 'image') scene.querySelector('img')!.decode = () => pending.promise;
  if (kind === 'cache') jest.mocked(preloadMedia).mockReturnValue(pending.promise);
  const progress = jest.fn(),
    timeout = jest.fn(),
    released = jest.fn();
  stage.addEventListener('cv-progress', progress);
  stage.addEventListener('cv-timeout', timeout);
  const gate = new FirstScreenGate(stage, scene, 100);
  gate.whenReleased(released);
  gate.dispose();
  if (kind === 'video') scene.querySelector('video')!.dispatchEvent(new Event('error'));
  else pending.reject(new Error('late'));
  await flush();
  jest.advanceTimersByTime(1000);
  expect(stage.report).not.toHaveBeenCalled();
  expect(progress).not.toHaveBeenCalled();
  expect(timeout).not.toHaveBeenCalled();
  expect(released).not.toHaveBeenCalled();
});

it('removes pending video listeners immediately on dispose and keeps reconnections independent', async () => {
  const { stage, scene } = screen('<video preload="none"></video>');
  const video = scene.querySelector('video')!;
  const add = jest.spyOn(video, 'addEventListener');
  const remove = jest.spyOn(video, 'removeEventListener');
  const released = jest.fn();
  for (let visit = 0; visit < 3; visit++) {
    const gate = new FirstScreenGate(stage, scene, 1000);
    gate.whenReleased(released);
    const pending = add.mock.calls.filter(([type]) => type === 'loadeddata' || type === 'error');
    expect(pending).toHaveLength(2);
    // Cleanup must happen while the request is still pending, before any media event.
    gate.dispose();
    for (const [type, listener] of pending) expect(remove).toHaveBeenCalledWith(type, listener);
    add.mockClear();
    remove.mockClear();
  }
  video.dispatchEvent(new Event('loadeddata'));
  await flush();
  expect(released).not.toHaveBeenCalled();
  expect(stage.report).not.toHaveBeenCalled();
  const next = new FirstScreenGate(stage, scene, 1000);
  next.whenReleased(released);
  video.dispatchEvent(new Event('loadeddata'));
  await flush();
  expect(released).toHaveBeenCalledTimes(1);
  next.dispose();
});
