import { throttle } from './throttle';

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should throttle function calls', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should call function immediately on first call', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call function with correct arguments', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn('arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should respect delay between calls', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(50);
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle multiple throttled functions independently', () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    const throttledFn1 = throttle(fn1, 100);
    const throttledFn2 = throttle(fn2, 200);

    throttledFn1();
    throttledFn2();

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);

    throttledFn1();
    throttledFn2();

    expect(fn1).toHaveBeenCalledTimes(2);
    expect(fn2).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);

    expect(fn2).toHaveBeenCalledTimes(2);
  });

  it('should handle zero delay', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 0);

    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(0);
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should schedule trailing call when called during throttle period', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(50);
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should update trailing call arguments', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn('first');
    expect(fn).toHaveBeenCalledWith('first');

    jest.advanceTimersByTime(50);
    throttledFn('second');
    throttledFn('third');

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('should handle rapid successive calls', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);

    for (let i = 0; i < 10; i++) {
      throttledFn();
    }

    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should preserve function return type', () => {
    const fn = jest.fn(() => 'result');
    const throttledFn = throttle(fn, 100);

    // 返回类型应该是 void（因为是异步的）
    const result = throttledFn();
    expect(result).toBeUndefined();
  });
});
