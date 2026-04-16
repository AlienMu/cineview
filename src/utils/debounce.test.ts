import { debounce, debounceCancelable } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should debounce function calls', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call function with correct arguments', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2');

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should reset timer on subsequent calls', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    jest.advanceTimersByTime(50);

    debouncedFn();
    jest.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple debounced functions independently', () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    const debouncedFn1 = debounce(fn1, 100);
    const debouncedFn2 = debounce(fn2, 200);

    debouncedFn1();
    debouncedFn2();

    jest.advanceTimersByTime(100);

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('should handle zero delay', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 0);

    debouncedFn();

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(0);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should preserve function return type', () => {
    const fn = jest.fn(() => 'result');
    const debouncedFn = debounce(fn, 100);

    // 返回类型应该是 void（因为是异步的）
    const result = debouncedFn();
    expect(result).toBeUndefined();
  });
});

describe('debounceCancelable', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return debounced function and cancel function', () => {
    const fn = jest.fn();
    const { debounced, cancel } = debounceCancelable(fn, 100);

    expect(typeof debounced).toBe('function');
    expect(typeof cancel).toBe('function');
  });

  it('should debounce function calls', () => {
    const fn = jest.fn();
    const { debounced } = debounceCancelable(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending function call', () => {
    const fn = jest.fn();
    const { debounced, cancel } = debounceCancelable(fn, 100);

    debounced();

    jest.advanceTimersByTime(50);

    cancel();

    jest.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should allow multiple cancellations', () => {
    const fn = jest.fn();
    const { debounced, cancel } = debounceCancelable(fn, 100);

    debounced();
    cancel();
    cancel();
    cancel();

    jest.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should handle cancel when no pending call exists', () => {
    const fn = jest.fn();
    const { cancel } = debounceCancelable(fn, 100);

    expect(() => cancel()).not.toThrow();
  });

  it('should allow new calls after cancellation', () => {
    const fn = jest.fn();
    const { debounced, cancel } = debounceCancelable(fn, 100);

    debounced();
    cancel();

    debounced();

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call function with correct arguments', () => {
    const fn = jest.fn();
    const { debounced } = debounceCancelable(fn, 100);

    debounced('arg1', 'arg2');

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should reset timer on subsequent calls', () => {
    const fn = jest.fn();
    const { debounced } = debounceCancelable(fn, 100);

    debounced();
    jest.advanceTimersByTime(50);

    debounced();
    jest.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
