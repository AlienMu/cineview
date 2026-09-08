import { useSyncExternalStore } from 'react';
import type { CineViewRef, PerformanceMetrics } from '../types';

/** Public CineView ref methods consumed by development tools. */
export type PerformanceSource = Pick<CineViewRef, 'getPerformanceMetrics'>;

export interface PerfStats {
  current: PerformanceMetrics;
  history: readonly PerformanceMetrics[];
}

const POLL_INTERVAL_MS = 500;
const HISTORY_SIZE = 60;

type Listener = () => void;

interface SnapshotStore {
  getSnapshot: () => PerfStats | null;
  subscribe: (listener: Listener) => () => void;
}

const stores = new WeakMap<PerformanceSource['getPerformanceMetrics'], SnapshotStore>();

function createStore(source: PerformanceSource): SnapshotStore {
  let snapshot: PerfStats | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<Listener>();

  const poll = (): void => {
    const current = source.getPerformanceMetrics();
    const previous = snapshot?.history ?? [];
    snapshot = {
      current,
      history: [...previous.slice(-(HISTORY_SIZE - 1)), current],
    };
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        // A ref getter shares the existing runtime sampler; only the display is polled here.
        poll();
        timer = setInterval(poll, POLL_INTERVAL_MS);
      }

      return (): void => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
}

function getStore(source: PerformanceSource): SnapshotStore {
  const existing = stores.get(source.getPerformanceMetrics);
  if (existing) return existing;

  const created = createStore(source);
  stores.set(source.getPerformanceMetrics, created);
  return created;
}

const emptySnapshot = (): null => null;
const subscribeToNothing = (): (() => void) => () => undefined;

/** Subscribe to shared, 500ms snapshots from a CineView ref with `monitor` enabled. */
export function usePerfMonitor(
  source: PerformanceSource | null | undefined,
  enabled = true
): PerfStats | null {
  const store = source && enabled ? getStore(source) : null;

  return useSyncExternalStore(
    store?.subscribe ?? subscribeToNothing,
    store?.getSnapshot ?? emptySnapshot,
    emptySnapshot
  );
}
