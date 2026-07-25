import { subscribeVisibilityMeasurement } from './visibilityScheduler';

describe('visibilityScheduler', () => {
  it('shares one measurement frame for an element root and cleans up its listeners', () => {
    jest.useFakeTimers();
    const root = document.createElement('div');
    const rectSpy = jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      top: 12,
    } as DOMRect);
    const first = jest.fn();
    const second = jest.fn();

    const unsubscribeFirst = subscribeVisibilityMeasurement(root, first);
    const unsubscribeSecond = subscribeVisibilityMeasurement(root, second);
    root.dispatchEvent(new Event('scroll'));

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    jest.advanceTimersByTime(16);
    expect(rectSpy).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith({ top: 12, height: window.innerHeight || 1 });
    expect(second).toHaveBeenCalledWith({ top: 12, height: window.innerHeight || 1 });

    first.mockClear();
    second.mockClear();
    unsubscribeFirst();
    unsubscribeSecond();
    root.dispatchEvent(new Event('scroll'));
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    rectSpy.mockRestore();
    jest.useRealTimers();
  });

  it('falls back to timeout scheduling when animation frames are unavailable', () => {
    jest.useFakeTimers();
    const originalRequest = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: undefined,
    });

    const root = document.createElement('div');
    const subscriber = jest.fn();
    const unsubscribe = subscribeVisibilityMeasurement(root, subscriber);
    jest.advanceTimersByTime(16);

    expect(subscriber).toHaveBeenCalledTimes(1);
    unsubscribe();

    const pendingRoot = document.createElement('div');
    const pendingUnsubscribe = subscribeVisibilityMeasurement(pendingRoot, jest.fn());
    pendingUnsubscribe();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: originalRequest,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: originalCancel,
    });
    jest.useRealTimers();
  });
});
