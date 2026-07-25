export interface ScrollExternalStore<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  setSnapshot: (next: T) => void;
}

export function createScrollExternalStore<T>(initialSnapshot: T): ScrollExternalStore<T> {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: (): T => snapshot,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setSnapshot: (next: T): void => {
      if (Object.is(snapshot, next)) {
        return;
      }

      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
}
