import { Clock } from './clock';

describe('stage clock direct outputs', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('shares tick times, holds while paused, resumes without paused elapsed time and disposes', () => {
    const clock = new Clock(),
      a = jest.fn(),
      b = jest.fn();
    const stopA = clock.subscribe(a),
      stopB = clock.subscribe(b);
    jest.advanceTimersByTime(64);
    expect(a.mock.calls).toEqual(b.mock.calls);
    const last = a.mock.calls.at(-1)![0];
    const count = a.mock.calls.length;
    clock.pause();
    jest.advanceTimersByTime(1000);
    expect(a).toHaveBeenCalledTimes(count);
    expect(clock.now()).toBe(last);
    clock.play();
    jest.advanceTimersByTime(32);
    expect(clock.now() - last).toBe(32);
    expect(a.mock.calls.at(-1)![0] - last).toBeGreaterThanOrEqual(16);
    expect(a.mock.calls.at(-1)![0] - last).toBeLessThanOrEqual(32);
    stopA();
    stopB();
    const final = a.mock.calls.length;
    jest.advanceTimersByTime(100);
    expect(a).toHaveBeenCalledTimes(final);
  });
});

it('uses the browser animation timeline for pause accounting instead of wall-time subframes', () => {
  const original = Object.getOwnPropertyDescriptor(document, 'timeline');
  const timeline = { currentTime: 100 };
  Object.defineProperty(document, 'timeline', { configurable: true, value: timeline });
  try {
    const clock = new Clock();
    expect(clock.now()).toBe(100);
    timeline.currentTime = 150;
    clock.pause();
    timeline.currentTime = 400;
    expect(clock.now()).toBe(150);
    clock.play();
    timeline.currentTime = 450;
    expect(clock.now()).toBe(200);
  } finally {
    if (original) Object.defineProperty(document, 'timeline', original);
    else Reflect.deleteProperty(document, 'timeline');
  }
});
