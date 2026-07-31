export interface ScrollExternalStore<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  setSnapshot: (next: T) => void;
}

export interface KeyedScrollExternalStore<T, K extends PropertyKey, V> {
  getSnapshot: () => T;
  setSnapshot: (next: T) => void;
  getKeySnapshot: (key: K) => V | undefined;
  subscribeKey: (key: K, listener: () => void) => () => void;
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

export function createKeyedScrollExternalStore<T, K extends PropertyKey, V>(
  initialSnapshot: T,
  selectValue: (snapshot: T, key: K) => V | undefined
): KeyedScrollExternalStore<T, K, V> {
  let snapshot = initialSnapshot;
  const keyedListeners = new Map<K, Set<() => void>>();

  return {
    getSnapshot: (): T => snapshot,
    getKeySnapshot: (key: K): V | undefined => selectValue(snapshot, key),
    subscribeKey: (key: K, listener: () => void): (() => void) => {
      const keyListeners = keyedListeners.get(key) ?? new Set<() => void>();
      keyListeners.add(listener);
      keyedListeners.set(key, keyListeners);
      return () => {
        keyListeners.delete(listener);
        if (keyListeners.size === 0) {
          keyedListeners.delete(key);
        }
      };
    },
    setSnapshot: (next: T): void => {
      if (Object.is(snapshot, next)) {
        return;
      }

      const previous = snapshot;
      snapshot = next;

      keyedListeners.forEach((keyListeners, key) => {
        if (!Object.is(selectValue(previous, key), selectValue(next, key))) {
          keyListeners.forEach((listener) => listener());
        }
      });
    },
  };
}
