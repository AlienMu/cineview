import { createKeyedScrollExternalStore, createScrollExternalStore } from './scrollExternalStore';

describe('createScrollExternalStore', () => {
  it('publishes changed snapshots and removes listeners', () => {
    const store = createScrollExternalStore(0);
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    store.setSnapshot(1);
    expect(store.getSnapshot()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setSnapshot(2);
    expect(store.getSnapshot()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify when the snapshot identity is unchanged', () => {
    const snapshot = { value: 1 };
    const store = createScrollExternalStore(snapshot);
    const listener = jest.fn();
    store.subscribe(listener);

    store.setSnapshot(snapshot);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies only listeners for keys whose snapshot identity changed', () => {
    const zoneA = { progress: 0 };
    const zoneB = { progress: 0 };
    const store = createKeyedScrollExternalStore(
      { zones: { a: zoneA, b: zoneB } },
      (snapshot, key: 'a' | 'b') => snapshot.zones[key]
    );
    const zoneAListener = jest.fn();
    const zoneBListener = jest.fn();
    store.subscribeKey('a', zoneAListener);
    store.subscribeKey('b', zoneBListener);

    const nextZoneA = { progress: 10 };
    store.setSnapshot({ zones: { a: nextZoneA, b: zoneB } });

    expect(store.getKeySnapshot('a')).toBe(nextZoneA);
    expect(store.getKeySnapshot('b')).toBe(zoneB);
    expect(zoneAListener).toHaveBeenCalledTimes(1);
    expect(zoneBListener).not.toHaveBeenCalled();
  });

  it('removes keyed listeners when their subscription is disposed', () => {
    const zoneA = { progress: 0 };
    const store = createKeyedScrollExternalStore(
      { zones: { a: zoneA } },
      (snapshot, key: 'a') => snapshot.zones[key]
    );
    const listener = jest.fn();
    const unsubscribe = store.subscribeKey('a', listener);

    unsubscribe();
    store.setSnapshot({ zones: { a: { progress: 1 } } });

    expect(listener).not.toHaveBeenCalled();
  });

  it('compares only subscribed keys without enumerating every zone on publish', () => {
    const createZones = (progress: number, onEnumerate: () => void) =>
      new Proxy(
        Object.fromEntries(
          Array.from({ length: 1000 }, (_, index) => [
            `zone-${index}`,
            { progress: index === 0 ? progress : 0 },
          ])
        ) as Record<string, { progress: number }>,
        {
          ownKeys(target) {
            onEnumerate();
            return Reflect.ownKeys(target);
          },
        }
      );

    let enumerationCount = 0;
    const previousZones = createZones(0, () => {
      enumerationCount += 1;
    });
    const store = createKeyedScrollExternalStore(
      { zones: previousZones },
      (snapshot, key: string) => snapshot.zones[key]
    );
    const listener = jest.fn();
    store.subscribeKey('zone-0', listener);

    const nextZones = createZones(1, () => {
      enumerationCount += 1;
    });
    store.setSnapshot({ zones: nextZones });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(enumerationCount).toBe(0);
  });
});
