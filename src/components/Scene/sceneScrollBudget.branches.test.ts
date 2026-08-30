import {
  areResolvedSceneScrollSequencesEqual,
  resolveSceneScrollAnimationBudgets,
  type SceneScrollAnimationRegistration,
} from './sceneScrollBudget';

function makeRegistrations(
  entries: SceneScrollAnimationRegistration[]
): Map<string, SceneScrollAnimationRegistration> {
  const map = new Map<string, SceneScrollAnimationRegistration>();
  entries.forEach((entry) => map.set(entry.animateId, entry));
  return map;
}

describe('resolveSceneScrollAnimationBudgets — uncovered timing branches', () => {
  it('resolves a waitFor that points at a missing registration as a zero-length predecessor', () => {
    // 'a' waits for an id that was never registered. resolveTiming follows the
    // waitFor edge, finds no registration, and caches an empty (all-zero) timing
    // for the ghost id, so the predecessor end is 0 and 'a' starts at its own delay.
    const registrations = makeRegistrations([
      {
        animateId: 'a',
        delay: 0,
        enterDuration: 200,
        exitDuration: 0,
        after: 'ghost',
      },
    ]);

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    // 'a' is unaffected by the missing predecessor (predecessorEnd === 0).
    expect(resolved.budgets.a.startMs).toBe(0);
    expect(resolved.budgets.a.enterEndMs).toBe(200);
    expect(resolved.budgets.a.totalEndMs).toBe(200);

    // The ghost predecessor is cached as an all-zero, no-exit timing.
    expect(resolved.budgets.ghost).toBeDefined();
    expect(resolved.budgets.ghost.startMs).toBe(0);
    expect(resolved.budgets.ghost.enterEndMs).toBe(0);
    expect(resolved.budgets.ghost.totalEndMs).toBe(0);
    expect(resolved.budgets.ghost.hasExit).toBe(false);

    expect(resolved.totalDurationMs).toBe(200);
    expect(resolved.totalBudgetPx).toBe(200);
  });

  it('fails open every edge in a circular waitFor chain', () => {
    // 'a' waitFor 'b', 'b' waitFor 'a'. Both dependency edges are invalid, so
    // each animation keeps only its own delay and duration.
    const registrations = makeRegistrations([
      { animateId: 'a', delay: 10, enterDuration: 200, exitDuration: 0, after: 'b' },
      { animateId: 'b', delay: 20, enterDuration: 300, exitDuration: 0, after: 'a' },
    ]);

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.b.startMs).toBe(20);
    expect(resolved.budgets.b.totalEndMs).toBe(320);
    expect(resolved.budgets.a.startMs).toBe(10);
    expect(resolved.budgets.a.totalEndMs).toBe(210);
    expect(resolved.totalDurationMs).toBe(320);
  });

  it('keeps an outside follower downstream of a three-node cycle free of cyclic timing', () => {
    const registrations = makeRegistrations([
      {
        animateId: 'downstream',
        delay: 7,
        enterDuration: 50,
        exitDuration: 0,
        after: 'a',
      },
      { animateId: 'a', delay: 10, enterDuration: 20, exitDuration: 5, after: 'b' },
      { animateId: 'b', delay: 20, enterDuration: 30, exitDuration: 5, after: 'c' },
      { animateId: 'c', delay: 30, enterDuration: 40, exitDuration: 5, after: 'a' },
    ]);

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.a).toMatchObject({ startMs: 10, totalEndMs: 35 });
    expect(resolved.budgets.b).toMatchObject({ startMs: 20, totalEndMs: 55 });
    expect(resolved.budgets.c).toMatchObject({ startMs: 30, totalEndMs: 75 });
    expect(resolved.budgets.downstream).toMatchObject({ startMs: 42, totalEndMs: 92 });
    expect(resolved.totalDurationMs).toBe(92);
    expect(resolved.totalBudgetPx).toBe(92);
    expect(
      Object.values(resolved.budgets).every((budget) => Number.isFinite(budget.totalEndMs))
    ).toBe(true);
  });

  it('clamps a negative enterDuration up to the minimum 1ms enter window', () => {
    // exercises Math.max(clampToNonNegative(enterDuration), 1) when the clamp floors to 0
    const registrations = makeRegistrations([
      { animateId: 'tiny', delay: 0, enterDuration: -50, exitDuration: 0 },
    ]);

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.tiny.enterEndMs).toBe(1);
    expect(resolved.totalDurationMs).toBe(1);
  });

  it('treats a non-finite delay/duration as zero via clampToNonNegative', () => {
    // clampToNonNegative returns 0 for any non-finite value (Number.isFinite === false
    // branch). NaN delay and NaN exitDuration both collapse to 0; the enter window
    // still floors at 1ms via Math.max(..., 1).
    const registrations = makeRegistrations([
      {
        animateId: 'nan',
        delay: Number.NaN,
        enterDuration: Number.NaN,
        exitDuration: Number.NaN,
      },
    ]);

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.nan.startMs).toBe(0);
    expect(resolved.budgets.nan.enterEndMs).toBe(1);
    // exitDuration NaN -> clamped 0 -> hasExit false -> no exit metrics.
    expect(resolved.budgets.nan.hasExit).toBe(false);
    expect(resolved.budgets.nan.exitEndMs).toBeNull();
    expect(resolved.totalDurationMs).toBe(1);
  });

  it('collapses an authored-phase no-exit animation total to its phase end', () => {
    // hasAuthoredPhase && !hasExit branch: totalEndPx is overwritten with phaseEndPx.
    // single anim enterDuration 1000, no exit -> totalBudgetPx 1000; phase end 0.2
    // resolves against the full budget -> phaseEndPx = 1000 * 0.2 = 200, and the
    // no-exit branch then sets totalEndPx = phaseEndPx = 200.
    const registrations = makeRegistrations([
      {
        animateId: 'phased',
        delay: 0,
        enterDuration: 1000,
        exitDuration: 0,
        phase: { start: 0, end: 0.2 },
      },
    ]);

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.phased.hasExit).toBe(false);
    expect(resolved.budgets.phased.phaseStartPx).toBe(0);
    expect(resolved.budgets.phased.phaseEndPx).toBe(200);
    expect(resolved.budgets.phased.totalEndPx).toBe(200);
    // enter metrics are untouched by the phase collapse.
    expect(resolved.budgets.phased.enterEndPx).toBe(1000);
  });
});

describe('areResolvedSceneScrollSequencesEqual', () => {
  it('returns true for two independently resolved identical sequences', () => {
    const left = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'x', delay: 0, enterDuration: 400, exitDuration: 0 }])
    );
    const right = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'x', delay: 0, enterDuration: 400, exitDuration: 0 }])
    );

    expect(areResolvedSceneScrollSequencesEqual(left, right)).toBe(true);
  });

  it('returns false when the total duration differs', () => {
    const left = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'x', delay: 0, enterDuration: 200, exitDuration: 0 }])
    );
    const right = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'x', delay: 0, enterDuration: 400, exitDuration: 0 }])
    );

    expect(areResolvedSceneScrollSequencesEqual(left, right)).toBe(false);
  });

  it('returns false when per-budget fields differ despite equal totals', () => {
    // Both totals are 400px, same single key 'x', but the delay shifts startMs/enterStart.
    const left = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'x', delay: 0, enterDuration: 400, exitDuration: 0 }])
    );
    const right = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'x', delay: 100, enterDuration: 300, exitDuration: 0 }])
    );

    expect(left.totalDurationMs).toBe(right.totalDurationMs);
    expect(left.totalBudgetPx).toBe(right.totalBudgetPx);
    expect(left.budgets.x.startMs).not.toBe(right.budgets.x.startMs);
    expect(areResolvedSceneScrollSequencesEqual(left, right)).toBe(false);
  });

  it('returns false when the budget key counts differ', () => {
    const left = resolveSceneScrollAnimationBudgets(
      makeRegistrations([
        { animateId: 'x', delay: 0, enterDuration: 400, exitDuration: 0 },
        { animateId: 'y', delay: 0, enterDuration: 200, exitDuration: 0 },
      ])
    );
    const right = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'x', delay: 0, enterDuration: 400, exitDuration: 0 }])
    );

    expect(left.totalDurationMs).toBe(right.totalDurationMs);
    expect(Object.keys(left.budgets).length).not.toBe(Object.keys(right.budgets).length);
    expect(areResolvedSceneScrollSequencesEqual(left, right)).toBe(false);
  });

  it('returns false when key sets differ but counts and totals match', () => {
    // Same key count (1) and identical totals, but the right side has no budget
    // for the left side's key, so the per-key lookup yields undefined.
    const left = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'x', delay: 0, enterDuration: 400, exitDuration: 0 }])
    );
    const right = resolveSceneScrollAnimationBudgets(
      makeRegistrations([{ animateId: 'y', delay: 0, enterDuration: 400, exitDuration: 0 }])
    );

    expect(left.totalDurationMs).toBe(right.totalDurationMs);
    expect(Object.keys(left.budgets).length).toBe(Object.keys(right.budgets).length);
    expect(areResolvedSceneScrollSequencesEqual(left, right)).toBe(false);
  });
});
