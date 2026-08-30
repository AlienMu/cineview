import { DragPreparedSceneStore, type PreparedSceneSnapshot } from './dragPreparedState';
import {
  buildAnimationRegistrySnapshot,
  freezeAnimationRegistrySnapshot,
} from '../../animations/registry';
import type { ParsedAnimationVariant } from '../../types';

function createPrepared(
  sceneIndex: number,
  instanceId: symbol,
  revision: number,
  duration: number,
  scale = 10
): PreparedSceneSnapshot {
  const enterVariant: ParsedAnimationVariant = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
  const registrySnapshot = freezeAnimationRegistrySnapshot(
    buildAnimationRegistrySnapshot({
      baseDuration: 0,
      registrations: new Map([
        [
          'hero',
          {
            delay: 0,
            duration,
            lane: 'drag',
          },
        ],
      ]),
    })
  );

  return {
    sceneIndex,
    instanceId,
    revision,
    enabled: true,
    mapping: Object.freeze({ unit: 'time' as const, scale }),
    registrySnapshot,
    enterVariantsByAnimateId: new Map([['hero', enterVariant]]),
  };
}

describe('DragPreparedSceneStore', () => {
  it('ignores a stale invalidation after a newer instance is published', () => {
    const store = new DragPreparedSceneStore();
    const oldInstance = Symbol('old');
    const newInstance = Symbol('new');

    store.publishPrepared(createPrepared(1, oldInstance, 1, 400));
    store.publishPrepared(createPrepared(1, newInstance, 1, 800));
    store.invalidatePrepared({ sceneIndex: 1, instanceId: oldInstance, revision: 1 });

    expect(store.getPrepared(1)?.instanceId).toBe(newInstance);
    expect(store.getPrepared(1)?.registrySnapshot.timelineDuration).toBe(800);
  });

  it('keeps a transaction on its captured revision while prepared data advances', () => {
    const store = new DragPreparedSceneStore();
    const instanceId = Symbol('scene');
    const first = createPrepared(2, instanceId, 1, 600);
    const next = createPrepared(2, instanceId, 2, 1200);

    store.publishPrepared(first);
    const driving = store.beginTransaction(2, 'driving', 0.25)!;
    store.publishPrepared(next);
    const settling = store.beginTransaction(2, 'settling', 0.5)!;

    expect(settling.transactionId).toBe(driving.transactionId);
    expect(settling.targetRevision).toBe(1);
    expect(settling.registrySnapshot).toBe(driving.registrySnapshot);
    expect(settling.registrySnapshot.timelineDuration).toBe(600);
    expect(settling.releaseSeed.elapsedMs).toBe(500);

    store.releaseTransaction(settling.transactionId);
    const later = store.beginTransaction(2, 'driving', 0.25)!;
    expect(later.transactionId).not.toBe(driving.transactionId);
    expect(later.targetRevision).toBe(2);
    expect(later.registrySnapshot.timelineDuration).toBe(1200);
  });

  it('reuses one transaction id for a re-grab of the same prepared target', () => {
    const store = new DragPreparedSceneStore();
    const prepared = createPrepared(1, Symbol('scene'), 3, 2000, 5);
    store.publishPrepared(prepared);

    const first = store.beginTransaction(1, 'driving', 0.2)!;
    const regrab = store.beginTransaction(1, 'driving', 0.4)!;

    expect(regrab.transactionId).toBe(first.transactionId);
    expect(regrab.targetRevision).toBe(3);
    expect(regrab.releaseSeed.elapsedMs).toBe(200);
  });

  it('requires the current transaction identity to release the target slot', () => {
    const store = new DragPreparedSceneStore();
    const first = createPrepared(1, Symbol('first'), 1, 500);
    const replacement = createPrepared(1, Symbol('replacement'), 1, 700);

    store.publishPrepared(first);
    const oldTransaction = store.beginTransaction(1, 'driving', 0.1)!;
    store.releaseTransaction(oldTransaction.transactionId);
    store.publishPrepared(replacement);
    const current = store.beginTransaction(1, 'driving', 0.1)!;

    store.releaseTransaction(oldTransaction.transactionId);
    expect(store.getTransaction(current.transactionId)).toBe(current);
  });
});
