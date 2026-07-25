import { createScrollExternalStore } from './scrollExternalStore';

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
});
