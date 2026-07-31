export interface VisibilityRootMeasurement {
  top: number;
  height: number;
}

type VisibilitySubscriber = (measurement: VisibilityRootMeasurement) => void;
type VisibilityRoot = Window | HTMLElement;

interface VisibilityScheduleEntry {
  subscribers: Set<VisibilitySubscriber>;
  frame: number | null;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  schedule: () => void;
  cleanup: () => void;
}

const entries = new WeakMap<VisibilityRoot, VisibilityScheduleEntry>();

interface VisibilityRecheckEntry {
  callbacks: Set<() => void>;
  frame: number | null;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
}

const recheckEntries = new WeakMap<Window, VisibilityRecheckEntry>();

function isWindowRoot(root: VisibilityRoot): root is Window {
  return (
    (typeof window !== 'undefined' && root === window) ||
    (typeof Window !== 'undefined' && root instanceof Window)
  );
}

function getEntry(root: VisibilityRoot): VisibilityScheduleEntry {
  const existing = entries.get(root);
  if (existing) {
    return existing;
  }

  const windowRoot = isWindowRoot(root);
  const ownerWindow = windowRoot ? root : (root.ownerDocument?.defaultView ?? window);
  const requestFrame =
    ownerWindow.requestAnimationFrame?.bind(ownerWindow) ??
    ((callback: FrameRequestCallback): number =>
      ownerWindow.setTimeout(() => callback(Date.now()), 16));
  const cancelFrame =
    ownerWindow.cancelAnimationFrame?.bind(ownerWindow) ??
    ((handle: number): void => ownerWindow.clearTimeout(handle));
  const subscribers = new Set<VisibilitySubscriber>();
  const entry: VisibilityScheduleEntry = {
    subscribers,
    frame: null,
    requestFrame,
    cancelFrame,
    schedule: (): void => {
      if (entry.frame !== null) {
        return;
      }

      entry.frame = entry.requestFrame(() => {
        entry.frame = null;
        const measurement = windowRoot
          ? { top: 0, height: root.innerHeight || 1 }
          : {
              top: root.getBoundingClientRect().top,
              height: root.clientHeight || ownerWindow.innerHeight || 1,
            };
        [...entry.subscribers].forEach((subscriber) => subscriber(measurement));
      });
    },
    cleanup: (): void => {
      root.removeEventListener('scroll', entry.schedule);
      if (!windowRoot) {
        ownerWindow.removeEventListener('resize', entry.schedule);
      }
      if (entry.frame !== null) {
        entry.cancelFrame(entry.frame);
        entry.frame = null;
      }
    },
  };

  root.addEventListener('scroll', entry.schedule, { passive: true });
  if (!windowRoot) {
    ownerWindow.addEventListener('resize', entry.schedule, { passive: true });
  }
  entries.set(root, entry);
  return entry;
}

export function subscribeVisibilityMeasurement(
  root: VisibilityRoot,
  subscriber: VisibilitySubscriber
): () => void {
  const entry = getEntry(root);
  entry.subscribers.add(subscriber);
  entry.schedule();

  return (): void => {
    entry.subscribers.delete(subscriber);
    if (entry.subscribers.size === 0) {
      entry.cleanup();
      entries.delete(root);
    }
  };
}

/** Queue one targeted visibility re-measurement on the next frame. Dependency
 * completion and delay timers use this instead of launching a tween from a stale
 * gate snapshot. Multiple wakeups for the same callback coalesce into one frame. */
export function scheduleVisibilityRecheck(ownerWindow: Window, callback: () => void): () => void {
  let entry = recheckEntries.get(ownerWindow);
  if (!entry) {
    const requestFrame =
      ownerWindow.requestAnimationFrame?.bind(ownerWindow) ??
      ((next: FrameRequestCallback): number => ownerWindow.setTimeout(() => next(Date.now()), 16));
    const cancelFrame =
      ownerWindow.cancelAnimationFrame?.bind(ownerWindow) ??
      ((handle: number): void => ownerWindow.clearTimeout(handle));
    entry = { callbacks: new Set(), frame: null, requestFrame, cancelFrame };
    recheckEntries.set(ownerWindow, entry);
  }

  const currentEntry = entry;
  currentEntry.callbacks.add(callback);
  if (currentEntry.frame === null) {
    currentEntry.frame = currentEntry.requestFrame(() => {
      currentEntry.frame = null;
      const callbacks = [...currentEntry.callbacks];
      currentEntry.callbacks.clear();
      callbacks.forEach((scheduled) => scheduled());
      if (currentEntry.callbacks.size === 0 && currentEntry.frame === null) {
        recheckEntries.delete(ownerWindow);
      }
    });
  }

  return (): void => {
    currentEntry.callbacks.delete(callback);
    if (currentEntry.callbacks.size === 0 && currentEntry.frame !== null) {
      currentEntry.cancelFrame(currentEntry.frame);
      currentEntry.frame = null;
      recheckEntries.delete(ownerWindow);
    }
  };
}
