export interface TimerScheduler {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
}

export interface LastWinsTimerSequence {
  start(
    tasks: readonly { delay: number; run: () => void }[],
    onComplete: () => void,
    completeDelay: number
  ): void;
  cancel(): void;
}

/**
 * Owns one finite timer sequence. Starting or cancelling a sequence invalidates
 * every older callback, including callbacks already queued by the browser.
 */
export function createLastWinsTimerSequence(scheduler: TimerScheduler): LastWinsTimerSequence {
  let generation = 0;
  let timerIds: number[] = [];

  const cancel = (): void => {
    generation += 1;
    for (const id of timerIds) scheduler.clearTimeout(id);
    timerIds = [];
  };

  const start = (
    tasks: readonly { delay: number; run: () => void }[],
    onComplete: () => void,
    completeDelay: number
  ): void => {
    cancel();
    const activeGeneration = generation;
    const schedule = (callback: () => void, delay: number): void => {
      const id = scheduler.setTimeout(
        () => {
          if (activeGeneration !== generation) return;
          callback();
        },
        Math.max(delay, 0)
      );
      timerIds.push(id);
    };

    for (const task of tasks) schedule(task.run, task.delay);
    schedule(() => {
      timerIds = [];
      onComplete();
    }, completeDelay);
  };

  return { start, cancel };
}
