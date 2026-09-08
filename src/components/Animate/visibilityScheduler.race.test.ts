import { scheduleVisibilityRecheck } from './visibilityScheduler';

describe('scheduleVisibilityRecheck race condition', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('lets an earlier callback cancel another job already selected for the same frame', () => {
    jest.useFakeTimers();
    const second = jest.fn();
    let cancelSecond: () => void = () => undefined;
    scheduleVisibilityRecheck(window, () => cancelSecond());
    cancelSecond = scheduleVisibilityRecheck(window, second);

    jest.advanceTimersByTime(16);

    expect(second).not.toHaveBeenCalled();
  });

  it('keeps a replacement job when the previous job is cancelled during the frame', () => {
    jest.useFakeTimers();
    const second = jest.fn();
    let cancelSecond: () => void = () => undefined;
    scheduleVisibilityRecheck(window, () => {
      cancelSecond();
      scheduleVisibilityRecheck(window, second);
      cancelSecond();
    });
    cancelSecond = scheduleVisibilityRecheck(window, second);

    jest.advanceTimersByTime(16);
    expect(second).not.toHaveBeenCalled();
    jest.advanceTimersByTime(16);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('coalesces duplicate wakeups without leaving a second frame pending', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    scheduleVisibilityRecheck(window, callback);
    scheduleVisibilityRecheck(window, callback);

    jest.advanceTimersByTime(32);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not fire callback after unsubscribe even when frame is already scheduled', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    const unsubscribe = scheduleVisibilityRecheck(window, callback);

    // Frame is now scheduled but not yet fired
    expect(callback).not.toHaveBeenCalled();

    // Unsubscribe before the frame fires
    unsubscribe();

    // Advance time to let the frame fire
    jest.advanceTimersByTime(16);

    // Callback should NOT fire because we unsubscribed
    expect(callback).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('does not fire first callback when second callback is added after unsubscribe', () => {
    jest.useFakeTimers();
    const first = jest.fn();
    const second = jest.fn();

    const unsubscribeFirst = scheduleVisibilityRecheck(window, first);
    // Frame is scheduled with first callback in the captured array

    unsubscribeFirst();
    // First is removed from callbacks Set and added to cancelled set

    scheduleVisibilityRecheck(window, second);
    // Second is added, but frame is already scheduled

    jest.advanceTimersByTime(16);
    // Frame fires with both callbacks in the captured array

    expect(first).not.toHaveBeenCalled(); // cancelled
    expect(second).toHaveBeenCalledTimes(1); // not cancelled

    jest.useRealTimers();
  });

  it('cancels all pending callbacks when all subscribers unsubscribe before frame fires', () => {
    jest.useFakeTimers();
    const first = jest.fn();
    const second = jest.fn();

    const unsubscribeFirst = scheduleVisibilityRecheck(window, first);
    const unsubscribeSecond = scheduleVisibilityRecheck(window, second);

    unsubscribeFirst();
    unsubscribeSecond();

    jest.advanceTimersByTime(16);

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
