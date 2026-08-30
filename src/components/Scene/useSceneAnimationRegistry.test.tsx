import { act, renderHook } from '@testing-library/react';
import { useSceneAnimationRegistry, type AfterOutcome } from './useSceneAnimationRegistry';

function lastOutcome(outcomes: AfterOutcome[]): AfterOutcome | undefined {
  return outcomes[outcomes.length - 1];
}

function collectOutcomes(): {
  outcomes: AfterOutcome[];
  listener: (outcome: AfterOutcome) => void;
} {
  const outcomes: AfterOutcome[] = [];
  return {
    outcomes,
    listener: (outcome) => outcomes.push(outcome),
  };
}

describe('useSceneAnimationRegistry waitFor leases', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('fails open after a missing visibility dependency is stable', () => {
    const reportError = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0, reportError })
    );
    const observed = collectOutcomes();

    let follower: ReturnType<typeof result.current.registerAnimate>;
    act(() => {
      follower = result.current.registerAnimate('follower', {
        delay: 20,
        duration: 80,
        after: 'missing',
        lane: 'visibility',
      });
      follower.observeAfter(observed.listener);
    });

    expect(observed.outcomes[observed.outcomes.length - 1]).toMatchObject({
      kind: 'pending',
      leaderId: 'missing',
    });

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(observed.outcomes[observed.outcomes.length - 1]).toEqual({
      kind: 'invalid',
      leaderId: 'missing',
      reason: 'missing',
    });
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_ANIMATION' })
    );
  });

  it('returns the stable invalid result to an observer attached after validation', () => {
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0 })
    );
    const outcomes = collectOutcomes();
    let follower!: ReturnType<typeof result.current.registerAnimate>;

    act(() => {
      follower = result.current.registerAnimate('late-observer', {
        delay: 0,
        duration: 100,
        after: 'missing',
        lane: 'visibility',
      });
      jest.runOnlyPendingTimers();
    });

    act(() => {
      follower.observeAfter(outcomes.listener);
    });

    expect(lastOutcome(outcomes.outcomes)).toEqual({
      kind: 'invalid',
      leaderId: 'missing',
      reason: 'missing',
    });
  });

  it('keeps missing dependencies pending while a preparation generation is active', () => {
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0 })
    );
    const outcomes = collectOutcomes();
    let preparation!: ReturnType<typeof result.current.beginPreparation>;
    let follower!: ReturnType<typeof result.current.registerAnimate>;

    act(() => {
      jest.runOnlyPendingTimers();
      preparation = result.current.beginPreparation();
      follower = result.current.registerAnimate('preparing-follower', {
        delay: 0,
        duration: 100,
        after: 'preparing-leader',
        lane: 'visibility',
      });
      jest.runOnlyPendingTimers();
      follower.observeAfter(outcomes.listener);
    });

    expect(lastOutcome(outcomes.outcomes)).toEqual({
      kind: 'pending',
      leaderId: 'preparing-leader',
    });

    act(() => {
      preparation.complete();
    });

    expect(lastOutcome(outcomes.outcomes)).toEqual({
      kind: 'invalid',
      leaderId: 'preparing-leader',
      reason: 'missing',
    });
  });

  it('turns a visibility dependency cycle into finite invalid outcomes', () => {
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0 })
    );
    const aOutcomes = collectOutcomes();
    const bOutcomes = collectOutcomes();

    act(() => {
      const a = result.current.registerAnimate('a', {
        delay: 0,
        duration: 100,
        after: 'b',
        lane: 'visibility',
      });
      const b = result.current.registerAnimate('b', {
        delay: 0,
        duration: 100,
        after: 'a',
        lane: 'visibility',
      });
      a.observeAfter(aOutcomes.listener);
      b.observeAfter(bOutcomes.listener);
      jest.runOnlyPendingTimers();
    });

    expect(lastOutcome(aOutcomes.outcomes)).toMatchObject({ kind: 'invalid', reason: 'cycle' });
    expect(lastOutcome(bOutcomes.outcomes)).toMatchObject({ kind: 'invalid', reason: 'cycle' });
  });

  it('fails open a three-node cycle and still releases an outside follower', () => {
    const reportError = jest.fn();
    const onStableSnapshot = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({
        sceneIndex: 0,
        baseDuration: 0,
        reportError,
        onStableSnapshot,
      })
    );
    const aOutcomes = collectOutcomes();
    const bOutcomes = collectOutcomes();
    const cOutcomes = collectOutcomes();
    const downstreamOutcomes = collectOutcomes();
    let a!: ReturnType<typeof result.current.registerAnimate>;

    act(() => {
      a = result.current.registerAnimate('a', {
        delay: 1,
        duration: 10,
        after: 'b',
        lane: 'visibility',
      });
      const b = result.current.registerAnimate('b', {
        delay: 2,
        duration: 20,
        after: 'c',
        lane: 'visibility',
      });
      const c = result.current.registerAnimate('c', {
        delay: 3,
        duration: 30,
        after: 'a',
        lane: 'visibility',
      });
      const downstream = result.current.registerAnimate('downstream', {
        delay: 4,
        duration: 40,
        after: 'a',
        lane: 'visibility',
      });
      a.observeAfter(aOutcomes.listener);
      b.observeAfter(bOutcomes.listener);
      c.observeAfter(cOutcomes.listener);
      downstream.observeAfter(downstreamOutcomes.listener);
      jest.runOnlyPendingTimers();
    });

    expect(lastOutcome(aOutcomes.outcomes)).toMatchObject({ kind: 'invalid', reason: 'cycle' });
    expect(lastOutcome(bOutcomes.outcomes)).toMatchObject({ kind: 'invalid', reason: 'cycle' });
    expect(lastOutcome(cOutcomes.outcomes)).toMatchObject({ kind: 'invalid', reason: 'cycle' });
    expect(lastOutcome(downstreamOutcomes.outcomes)).toMatchObject({
      kind: 'pending',
      leaderId: 'a',
    });

    const snapshot = onStableSnapshot.mock.calls[onStableSnapshot.mock.calls.length - 1]?.[0];
    expect([...snapshot.calculatedDelays]).toEqual([
      ['a', 1],
      ['c', 3],
      ['b', 2],
      ['downstream', 15],
    ]);
    expect(snapshot.timelineDuration).toBe(55);
    expect(snapshot.issues).toEqual([
      { type: 'circular-dependency', animateId: 'a', cycle: ['a', 'b', 'c', 'a'] },
    ]);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith({
      code: 'CIRCULAR_DEPENDENCY',
      message: 'Animate after chain contains a cycle in Scene 0: a -> b -> c -> a.',
      context: { sceneIndex: 0 },
    });

    act(() => {
      a.publishEnterCompleted();
    });

    expect(lastOutcome(downstreamOutcomes.outcomes)).toMatchObject({
      kind: 'satisfied',
      source: 'completed',
      leaderId: 'a',
      generation: a.generation,
    });
  });

  it('fails open an incompatible edge in a mixed-driver cycle without blocking the valid edge', () => {
    const reportError = jest.fn();
    const onStableSnapshot = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({
        sceneIndex: 0,
        baseDuration: 0,
        reportError,
        onStableSnapshot,
      })
    );
    const scrollOutcomes = collectOutcomes();
    const visibilityOutcomes = collectOutcomes();
    let scrollLeader!: ReturnType<typeof result.current.registerAnimate>;

    act(() => {
      scrollLeader = result.current.registerAnimate('scroll-a', {
        delay: 5,
        duration: 100,
        after: 'visibility-b',
        lane: 'scroll',
      });
      const visibilityFollower = result.current.registerAnimate('visibility-b', {
        delay: 7,
        duration: 50,
        after: 'scroll-a',
        lane: 'visibility',
      });
      scrollLeader.observeAfter(scrollOutcomes.listener);
      visibilityFollower.observeAfter(visibilityOutcomes.listener);
      jest.runOnlyPendingTimers();
    });

    expect(lastOutcome(scrollOutcomes.outcomes)).toEqual({
      kind: 'invalid',
      leaderId: 'visibility-b',
      reason: 'incompatible-lane',
    });
    expect(lastOutcome(visibilityOutcomes.outcomes)).toMatchObject({
      kind: 'pending',
      leaderId: 'scroll-a',
    });

    const snapshot = onStableSnapshot.mock.calls[onStableSnapshot.mock.calls.length - 1]?.[0];
    expect([...snapshot.calculatedDelays]).toEqual([
      ['scroll-a', 5],
      ['visibility-b', 7],
    ]);
    expect(snapshot.timelineDuration).toBe(105);
    expect(snapshot.issues).toEqual([
      {
        type: 'incompatible-lane',
        animateId: 'scroll-a',
        after: 'visibility-b',
        followerLane: 'scroll',
        leaderLane: 'visibility',
      },
    ]);
    expect(reportError).toHaveBeenCalledTimes(1);

    act(() => {
      scrollLeader.publishEnterCompleted();
    });

    expect(lastOutcome(visibilityOutcomes.outcomes)).toMatchObject({
      kind: 'satisfied',
      source: 'completed',
      leaderId: 'scroll-a',
      generation: scrollLeader.generation,
    });
  });

  it('scopes completion to the current registration generation', () => {
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0 })
    );
    const firstFollowerOutcomes = collectOutcomes();
    const secondFollowerOutcomes = collectOutcomes();

    let firstLeader!: ReturnType<typeof result.current.registerAnimate>;
    act(() => {
      firstLeader = result.current.registerAnimate('leader', {
        delay: 0,
        duration: 100,
        lane: 'visibility',
      });
      const follower = result.current.registerAnimate('follower-1', {
        delay: 0,
        duration: 100,
        after: 'leader',
        lane: 'visibility',
      });
      follower.observeAfter(firstFollowerOutcomes.listener);
      firstLeader.publishEnterCompleted();
    });

    expect(lastOutcome(firstFollowerOutcomes.outcomes)).toMatchObject({
      kind: 'satisfied',
      source: 'completed',
      generation: firstLeader.generation,
    });

    let secondLeader!: ReturnType<typeof result.current.registerAnimate>;
    act(() => {
      firstLeader.dispose();
      secondLeader = result.current.registerAnimate('leader', {
        delay: 0,
        duration: 100,
        lane: 'visibility',
      });
      const follower = result.current.registerAnimate('follower-2', {
        delay: 0,
        duration: 100,
        after: 'leader',
        lane: 'visibility',
      });
      follower.observeAfter(secondFollowerOutcomes.listener);
    });

    expect(secondLeader.generation).toBeGreaterThan(firstLeader.generation);
    expect(lastOutcome(secondFollowerOutcomes.outcomes)).toMatchObject({
      kind: 'pending',
      generation: secondLeader.generation,
    });
  });

  it('keeps the newer duplicate owner registered when the older owner disposes', () => {
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0 })
    );
    const outcomes = collectOutcomes();

    let older!: ReturnType<typeof result.current.registerAnimate>;
    let newer!: ReturnType<typeof result.current.registerAnimate>;
    act(() => {
      older = result.current.registerAnimate('leader', {
        delay: 0,
        duration: 100,
        lane: 'visibility',
      });
      newer = result.current.registerAnimate('leader', {
        delay: 0,
        duration: 100,
        lane: 'visibility',
      });
      const follower = result.current.registerAnimate('follower', {
        delay: 0,
        duration: 100,
        after: 'leader',
        lane: 'visibility',
      });
      follower.observeAfter(outcomes.listener);
      older.dispose();
      jest.runOnlyPendingTimers();
      newer.publishEnterCompleted();
    });

    expect(lastOutcome(outcomes.outcomes)).toMatchObject({
      kind: 'satisfied',
      source: 'completed',
      generation: newer.generation,
    });
  });

  it('releases a pending follower when its leader is stably unregistered', () => {
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0 })
    );
    const outcomes = collectOutcomes();

    act(() => {
      const leader = result.current.registerAnimate('leader', {
        delay: 0,
        duration: 100,
        lane: 'visibility',
      });
      const follower = result.current.registerAnimate('follower', {
        delay: 0,
        duration: 100,
        after: 'leader',
        lane: 'visibility',
      });
      follower.observeAfter(outcomes.listener);
      leader.dispose();
      jest.runOnlyPendingTimers();
    });

    expect(lastOutcome(outcomes.outcomes)).toEqual({
      kind: 'invalid',
      leaderId: 'leader',
      reason: 'leader-unregistered',
    });
  });

  it('rejects a scroll-zone follower that depends on a visibility leader', () => {
    const reportError = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0, reportError })
    );
    const outcomes = collectOutcomes();

    act(() => {
      result.current.registerAnimate('leader', {
        delay: 0,
        duration: 100,
        lane: 'visibility',
      });
      const follower = result.current.registerAnimate('follower', {
        delay: 0,
        duration: 100,
        after: 'leader',
        lane: 'scroll',
      });
      follower.observeAfter(outcomes.listener);
      jest.runOnlyPendingTimers();
    });

    expect(lastOutcome(outcomes.outcomes)).toEqual({
      kind: 'invalid',
      leaderId: 'leader',
      reason: 'incompatible-lane',
    });
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_ANIMATION',
        message: expect.stringContaining('incompatible'),
      })
    );
  });

  it('keeps a visibility follower pending until its scroll-zone leader completes', () => {
    const reportError = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0, reportError })
    );
    const outcomes = collectOutcomes();
    let leader: ReturnType<typeof result.current.registerAnimate>;

    act(() => {
      leader = result.current.registerAnimate('leader', {
        delay: 0,
        duration: 100,
        lane: 'scroll',
      });
      const follower = result.current.registerAnimate('follower', {
        delay: 25,
        duration: 50,
        after: 'leader',
        lane: 'visibility',
      });
      follower.observeAfter(outcomes.listener);
      jest.runOnlyPendingTimers();
    });

    expect(lastOutcome(outcomes.outcomes)).toMatchObject({
      kind: 'pending',
      leaderId: 'leader',
    });
    expect(reportError).not.toHaveBeenCalled();

    act(() => {
      leader.publishEnterCompleted();
    });

    expect(lastOutcome(outcomes.outcomes)).toMatchObject({
      kind: 'satisfied',
      source: 'completed',
      leaderId: 'leader',
    });
  });

  it('publishes a stable zero-duration snapshot for an empty drag registry', () => {
    const onStableSnapshot = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({
        sceneIndex: 0,
        baseDuration: 0,
        onStableSnapshot,
      })
    );

    expect(result.current.isStable).toBe(false);
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(result.current.isStable).toBe(true);
    expect(onStableSnapshot).toHaveBeenCalledTimes(1);
    expect(onStableSnapshot.mock.calls[0][0]).toMatchObject({ timelineDuration: 0 });
    expect(onStableSnapshot.mock.calls[0][0].registrations.size).toBe(0);
    expect(onStableSnapshot.mock.calls[0][1]).toBe(1);
  });

  it('waits for preparation before publishing variants and a higher revision', () => {
    const onStableSnapshot = jest.fn();
    const enterVariant = {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({
        sceneIndex: 2,
        baseDuration: 0,
        onStableSnapshot,
      })
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(onStableSnapshot).toHaveBeenCalledTimes(1);

    let preparation!: ReturnType<typeof result.current.beginPreparation>;
    act(() => {
      preparation = result.current.beginPreparation();
      const registration = result.current.registerAnimate('hero', {
        delay: 25,
        duration: 175,
        lane: 'drag',
      });
      registration.setEnterVariant?.(enterVariant);
      jest.runOnlyPendingTimers();
    });

    expect(result.current.isStable).toBe(false);
    expect(onStableSnapshot).toHaveBeenCalledTimes(1);

    act(() => {
      preparation.complete();
      preparation.complete();
    });

    // The last preparation lease publishes synchronously. A pointer event in the
    // next browser task must see the prepared snapshot without waiting for the
    // registry's zero-delay validation timer.
    expect(result.current.isStable).toBe(true);
    expect(onStableSnapshot).toHaveBeenCalledTimes(2);
    const [snapshot, revision, enterVariantsByAnimateId] = onStableSnapshot.mock.calls[1];
    expect(revision).toBe(2);
    expect(snapshot.timelineDuration).toBe(200);
    expect(snapshot.calculatedDelays.get('hero')).toBe(25);
    expect(enterVariantsByAnimateId.get('hero')).toBe(enterVariant);
  });

  it('cancels a superseded preparation without synchronously publishing a transient snapshot', () => {
    const onStableSnapshot = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({
        sceneIndex: 0,
        baseDuration: 0,
        onStableSnapshot,
      })
    );

    let probe!: ReturnType<typeof result.current.beginPreparation>;
    let current!: ReturnType<typeof result.current.beginPreparation>;
    act(() => {
      probe = result.current.beginPreparation();
      probe.cancel();
      current = result.current.beginPreparation();
      jest.runOnlyPendingTimers();
    });

    // StrictMode cleanup of the probe generation must not publish the empty
    // registry while the replacement generation is still preparing.
    expect(onStableSnapshot).not.toHaveBeenCalled();
    expect(result.current.isStable).toBe(false);

    act(() => {
      const registration = result.current.registerAnimate('hero', {
        delay: 20,
        duration: 180,
        lane: 'drag',
      });
      registration.setEnterVariant?.({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });
      current.complete();
    });

    expect(onStableSnapshot).toHaveBeenCalledTimes(1);
    expect(onStableSnapshot.mock.calls[0][0].timelineDuration).toBe(200);
    expect(onStableSnapshot.mock.calls[0][0].registrations.has('hero')).toBe(true);
  });

  it('reconciles asynchronously when the last preparation is cancelled without a replacement', () => {
    const onStableSnapshot = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({
        sceneIndex: 0,
        baseDuration: 0,
        onStableSnapshot,
      })
    );

    // Consume the hook's mount-time validation first. The cancellation below must
    // schedule its OWN reconciliation rather than accidentally riding this timer.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(result.current.isStable).toBe(true);
    expect(onStableSnapshot).toHaveBeenCalledTimes(1);
    onStableSnapshot.mockClear();

    let preparation!: ReturnType<typeof result.current.beginPreparation>;
    act(() => {
      preparation = result.current.beginPreparation();
      preparation.cancel();
    });

    // Cancellation must not synchronously publish the transient empty registry.
    expect(result.current.isStable).toBe(false);
    expect(onStableSnapshot).not.toHaveBeenCalled();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    // With no replacement generation, deferred reconciliation is the only path
    // that releases the Scene from its unstable preparation state. The immutable
    // registry content is unchanged, so recovery must not manufacture a revision.
    expect(result.current.isStable).toBe(true);
    expect(onStableSnapshot).not.toHaveBeenCalled();
  });

  it('does not publish a new revision when stable registry content is unchanged', () => {
    const onStableSnapshot = jest.fn();
    const enterVariant = {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({
        sceneIndex: 3,
        baseDuration: 0,
        onStableSnapshot,
      })
    );

    let registration!: ReturnType<typeof result.current.registerAnimate>;
    act(() => {
      registration = result.current.registerAnimate('stable', {
        delay: 10,
        duration: 90,
        lane: 'drag',
      });
      registration.setEnterVariant?.(enterVariant);
      jest.runOnlyPendingTimers();
    });

    expect(onStableSnapshot).toHaveBeenCalledTimes(1);
    expect(onStableSnapshot.mock.calls[0][1]).toBe(1);

    act(() => {
      // Re-validating without a registry or variant change marks the registry
      // stable again but must not create a duplicate prepared revision.
      registration.setEnterVariant?.(enterVariant);
      jest.runOnlyPendingTimers();
    });

    expect(result.current.isStable).toBe(true);
    expect(onStableSnapshot).toHaveBeenCalledTimes(1);
  });

  it('declares a visibility driver for diagnostics without entering T_self', () => {
    const reportError = jest.fn();
    const onStableSnapshot = jest.fn();
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({
        sceneIndex: 1,
        baseDuration: 0,
        reportError,
        onStableSnapshot,
      })
    );
    const outcomes = collectOutcomes();

    act(() => {
      result.current.declareAnimateLane('arrival-leader', 'visibility');
      const follower = result.current.registerAnimate('drag-follower', {
        delay: 25,
        duration: 100,
        after: 'arrival-leader',
        lane: 'drag',
      });
      follower.observeAfter(outcomes.listener);
      jest.runOnlyPendingTimers();
    });

    expect(lastOutcome(outcomes.outcomes)).toEqual({
      kind: 'invalid',
      leaderId: 'arrival-leader',
      reason: 'incompatible-lane',
    });
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_ANIMATION',
        message: expect.stringContaining('incompatible'),
      })
    );
    const latestSnapshot = onStableSnapshot.mock.calls[onStableSnapshot.mock.calls.length - 1]?.[0];
    expect(latestSnapshot.timelineDuration).toBe(125);
    expect(latestSnapshot.registrations.has('arrival-leader')).toBe(false);
    expect(latestSnapshot.calculatedDelays.has('arrival-leader')).toBe(false);
  });

  it('removes an owner-safe driver declaration without disturbing a newer owner', () => {
    const { result } = renderHook(() =>
      useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 0 })
    );
    const outcomes = collectOutcomes();

    act(() => {
      const older = result.current.declareAnimateLane('leader', 'visibility');
      result.current.declareAnimateLane('leader', 'visibility');
      older.dispose();
      const follower = result.current.registerAnimate('follower', {
        delay: 0,
        duration: 100,
        after: 'leader',
        lane: 'drag',
      });
      follower.observeAfter(outcomes.listener);
      jest.runOnlyPendingTimers();
    });

    expect(lastOutcome(outcomes.outcomes)).toEqual({
      kind: 'invalid',
      leaderId: 'leader',
      reason: 'incompatible-lane',
    });
  });
});
