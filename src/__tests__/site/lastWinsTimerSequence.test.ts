import { act } from '@testing-library/react';
import {
  createLastWinsTimerSequence,
  type TimerScheduler,
} from '../../../site/src/components/lastWinsTimerSequence';

describe('Scene5 last-wins exit timer sequence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('invalidates unfinished A and B after finished reopens the layer', () => {
    const events: string[] = [];
    // Deliberately leave cancelled callbacks queued: generation checks must
    // protect the state even if a host cannot physically cancel a queued task.
    const scheduler: TimerScheduler = {
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: () => undefined,
    };
    const sequence = createLastWinsTimerSequence(scheduler);

    sequence.start(
      [{ delay: 0, run: () => events.push('A-opacity') }],
      () => events.push('A-complete'),
      1050
    );
    act(() => jest.advanceTimersByTime(500));

    sequence.start(
      [{ delay: 100, run: () => events.push('B-opacity') }],
      () => events.push('B-complete'),
      1050
    );
    act(() => jest.advanceTimersByTime(100));
    expect(events).toEqual(['A-opacity', 'B-opacity']);

    events.push('finished');
    sequence.cancel();
    act(() => jest.advanceTimersByTime(2000));

    expect(events).toEqual(['A-opacity', 'B-opacity', 'finished']);
  });

  it('lets the newest unfinished sequence complete when it is not cancelled', () => {
    const completed: string[] = [];
    const sequence = createLastWinsTimerSequence({
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (id) => window.clearTimeout(id),
    });

    sequence.start([], () => completed.push('A'), 1050);
    act(() => jest.advanceTimersByTime(500));
    sequence.start([], () => completed.push('B'), 1050);
    act(() => jest.advanceTimersByTime(1049));
    expect(completed).toEqual([]);
    act(() => jest.advanceTimersByTime(1));
    expect(completed).toEqual(['B']);
  });

  it('invalidates queued freeze collapse and unmount callbacks after re-entry', () => {
    const events: string[] = [];
    const sequence = createLastWinsTimerSequence({
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      // Simulate a host where a callback already queued cannot be removed.
      clearTimeout: () => undefined,
    });

    sequence.start(
      [{ delay: 700, run: () => events.push('freeze-collapse-A') }],
      () => events.push('freeze-unmount-A'),
      1400
    );
    act(() => jest.advanceTimersByTime(300));
    sequence.cancel();
    events.push('re-enter');
    sequence.start(
      [{ delay: 700, run: () => events.push('freeze-collapse-B') }],
      () => events.push('freeze-unmount-B'),
      1400
    );

    act(() => jest.advanceTimersByTime(2000));
    expect(events).toEqual(['re-enter', 'freeze-collapse-B', 'freeze-unmount-B']);
  });
});
