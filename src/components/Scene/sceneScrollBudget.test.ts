import {
  resolveSceneScrollAnimationBudgets,
  type SceneScrollAnimationRegistration,
} from './sceneScrollBudget';

describe('resolveSceneScrollAnimationBudgets', () => {
  it('returns an empty sequence when no animations are registered', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.totalDurationMs).toBe(0);
    expect(resolved.totalBudgetPx).toBe(0);
    expect(resolved.budgets).toEqual({});
  });

  it('maps scroll-driven Scene.scroll duration into native center-lock scroll metrics at 1px per 1ms', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('intro', {
      animateId: 'intro',
      delay: 100,
      enterDuration: 300,
      exitDuration: 0,
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolveSceneScrollAnimationBudgets).toHaveLength(1);
    expect(resolved.totalDurationMs).toBe(400);
    expect(resolved.totalBudgetPx).toBe(400);
    expect(resolved.budgets.intro.startPx).toBe(100);
    expect(resolved.budgets.intro.enterEndPx).toBe(400);
  });

  it('resolves authored phase boundaries against the full takeover budget', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('intro', {
      animateId: 'intro',
      delay: 0,
      enterDuration: 1000,
      exitDuration: 500,
      phase: { start: 0, end: 0.2 },
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.intro.phaseStartPx).toBe(0);
    expect(resolved.budgets.intro.phaseEndPx).toBe(300);
    expect(resolved.budgets.intro.enterEndPx).toBe(1000);
    expect(resolved.budgets.intro.exitEndPx).toBe(1500);
  });

  it('keeps phased short-title exits reserved at the end of a longer takeover budget', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('title', {
      animateId: 'title',
      delay: 0,
      enterDuration: 240,
      exitDuration: 160,
      phase: { start: 0, end: 0.22 },
    });
    registrations.set('media', {
      animateId: 'media',
      delay: 0,
      enterDuration: 900,
      exitDuration: 320,
      phase: { start: 0.12, end: 0.76 },
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.title.phaseEndPx).toBe(268.4);
    expect(resolved.budgets.title.exitStartPx).toBe(1060);
    expect(resolved.budgets.title.exitEndPx).toBe(1220);
  });

  it('starts after the predecessor entrance and delay, without waiting for its exit', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('intro', {
      animateId: 'intro',
      delay: 100,
      enterDuration: 300,
      exitDuration: 200,
    });
    registrations.set('details', {
      animateId: 'details',
      delay: 50,
      enterDuration: 200,
      exitDuration: 0,
      after: 'intro',
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.totalDurationMs).toBe(650);
    expect(resolved.budgets.intro.startMs).toBe(100);
    expect(resolved.budgets.intro.exitEndMs).toBe(600);
    expect(resolved.budgets.details.startMs).toBe(450);
    expect(resolved.budgets.details.totalEndMs).toBe(650);
  });

  it.each([
    { phase: { start: 1 }, exitDuration: 0, total: 100 },
    { phase: { start: 0, end: 1 }, exitDuration: 100, total: 200 },
  ])(
    'ignores a phase that leaves no reachable entrance or exit: %j',
    ({ phase, exitDuration, total }) => {
      const resolved = resolveSceneScrollAnimationBudgets(
        new Map([
          ['leaf', { animateId: 'leaf', delay: 0, enterDuration: 100, exitDuration, phase }],
        ])
      );

      expect(resolved.invalidPhaseIds).toEqual(['leaf']);
      expect(resolved.totalBudgetPx).toBe(total);
      expect(resolved.budgets.leaf.phaseEndPx).toBe(100);
      expect(resolved.budgets.leaf.exitEndPx).toBe(exitDuration ? total : null);
    }
  );

  it('reserves a reachable minimum entrance interval for a near-end leaf phase', () => {
    const resolved = resolveSceneScrollAnimationBudgets(
      new Map([
        [
          'leaf',
          {
            animateId: 'leaf',
            delay: 0,
            enterDuration: 10,
            exitDuration: 0,
            phase: { start: 0.99 },
          },
        ],
      ])
    );

    expect(resolved.invalidPhaseIds).toBeUndefined();
    expect(resolved.totalBudgetPx).toBeCloseTo(100);
    expect(resolved.budgets.leaf.phaseStartPx).toBeCloseTo(99);
    expect(resolved.budgets.leaf.phaseEndPx).toBeCloseTo(100);
  });

  it('allows a leaf entrance to finish at the zone end when it has no exit', () => {
    const resolved = resolveSceneScrollAnimationBudgets(
      new Map([
        [
          'leaf',
          { animateId: 'leaf', delay: 0, enterDuration: 100, exitDuration: 0, phase: { end: 1 } },
        ],
      ])
    );

    expect(resolved.invalidPhaseIds).toBeUndefined();
    expect(resolved.totalBudgetPx).toBe(100);
    expect(resolved.budgets.leaf.phaseEndPx).toBe(100);
  });

  it('fails open dependency cycles without adding cyclic predecessor time', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('a', {
      animateId: 'a',
      delay: 1,
      enterDuration: 10,
      exitDuration: 0,
      after: 'b',
    });
    registrations.set('b', {
      animateId: 'b',
      delay: 2,
      enterDuration: 20,
      exitDuration: 0,
      after: 'a',
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.a.startMs).toBe(1);
    expect(resolved.budgets.a.totalEndMs).toBe(11);
    expect(resolved.budgets.b.startMs).toBe(2);
    expect(resolved.budgets.b.totalEndMs).toBe(22);
    expect(resolved.totalDurationMs).toBe(22);
    expect(resolved.totalBudgetPx).toBe(22);
  });

  it('keeps every member of a three-node cycle on its own finite timing', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>([
      [
        'a',
        {
          animateId: 'a',
          delay: 1,
          enterDuration: 10,
          exitDuration: 1,
          after: 'b',
        },
      ],
      [
        'b',
        {
          animateId: 'b',
          delay: 2,
          enterDuration: 20,
          exitDuration: 2,
          after: 'c',
        },
      ],
      [
        'c',
        {
          animateId: 'c',
          delay: 3,
          enterDuration: 30,
          exitDuration: 3,
          after: 'a',
        },
      ],
    ]);

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.budgets.a).toMatchObject({ startMs: 1, totalEndMs: 12 });
    expect(resolved.budgets.b).toMatchObject({ startMs: 2, totalEndMs: 24 });
    expect(resolved.budgets.c).toMatchObject({ startMs: 3, totalEndMs: 36 });
    expect(resolved.totalDurationMs).toBe(36);
    expect(resolved.totalBudgetPx).toBe(36);
    expect(
      Object.values(resolved.budgets).every((budget) => Number.isFinite(budget.totalEndMs))
    ).toBe(true);
  });

  // T1.8 dual-clock fix (task-flow 2026-08-23-scene-scroll-budget-dual-clock):
  // a phase-authored leader must hold its after followers until its PHASE
  // window closes, not until its nominal ms end. Pre-fix, the follower below
  // started at 600px while the leader's window ended at 2160px.
  it('holds after followers until the phase-authored leader window closes', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('title', {
      animateId: 'title',
      delay: 0,
      enterDuration: 600,
      exitDuration: 0,
      phase: { start: 0.05, end: 0.3 },
    });
    registrations.set('subline', {
      animateId: 'subline',
      delay: 0,
      enterDuration: 600,
      exitDuration: 0,
      after: 'title',
    });
    registrations.set('video', {
      animateId: 'video',
      delay: 0,
      enterDuration: 6000,
      exitDuration: 0,
      after: 'subline',
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    // Core invariant: no follower starts before its leader's effective end.
    // Fractional budgets use floating-point arithmetic.
    expect(resolved.budgets.subline.enterStartPx).toBeCloseTo(resolved.budgets.title.totalEndPx, 6);
    expect(resolved.budgets.video.enterStartPx).toBeGreaterThanOrEqual(
      resolved.budgets.subline.totalEndPx
    );

    // Fixed point: T = 0.3·T + 600 + 6000 → T = 6600 / 0.7.
    expect(resolved.totalBudgetPx).toBeCloseTo(6600 / 0.7, 3);
    expect(resolved.budgets.title.totalEndPx).toBeCloseTo(0.3 * (6600 / 0.7), 3);
    expect(resolved.budgets.subline.enterStartPx).toBeCloseTo(0.3 * (6600 / 0.7), 3);
    expect(resolved.budgets.subline.enterEndPx).toBeCloseTo(0.3 * (6600 / 0.7) + 600, 3);
    expect(resolved.budgets.video.enterStartPx).toBeCloseTo(0.3 * (6600 / 0.7) + 600, 3);
    expect(resolved.budgets.video.enterEndPx).toBeCloseTo(6600 / 0.7, 3);
  });

  it('preserves authored phase timing without dependencies', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('intro', {
      animateId: 'intro',
      delay: 100,
      enterDuration: 300,
      exitDuration: 0,
      phase: { start: 0.1, end: 0.4 },
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.totalDurationMs).toBe(400);
    expect(resolved.totalBudgetPx).toBe(400);
    expect(resolved.budgets.intro.phaseStartPx).toBe(40);
    expect(resolved.budgets.intro.phaseEndPx).toBe(160);
    expect(resolved.budgets.intro.totalEndPx).toBe(160);
  });

  it('anchors phase+exit leaders at their enter-window close, keeping the zone bounded', () => {
    // Review PROBE1 regression guard (task-flow 2026-08-23-scene-scroll-budget-
    // dual-clock): anchoring the chain at a zone-end-pinned exit diverges
    // linearly (zone ballooned ~600,000px). The anchor is the enter-window
    // close — documented after semantics — and the composition stays bounded.
    // Fixed point by hand: T = max(nominal leader total 1000, 0.3·T + 600)
    // → T = 1000; follower [300, 900]; leader phase window [50, 300];
    // leader exit pinned [max(300, 1000 − 400), 1000] = [600, 1000].
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('leader', {
      animateId: 'leader',
      delay: 0,
      enterDuration: 600,
      exitDuration: 400,
      phase: { start: 0.05, end: 0.3 },
    });
    registrations.set('follower', {
      animateId: 'follower',
      delay: 0,
      enterDuration: 600,
      exitDuration: 0,
      after: 'leader',
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.totalBudgetPx).toBe(1000);
    expect(resolved.budgets.leader.phaseStartPx).toBe(50);
    expect(resolved.budgets.leader.phaseEndPx).toBe(300);
    expect(resolved.budgets.leader.exitStartPx).toBe(600);
    expect(resolved.budgets.leader.exitEndPx).toBe(1000);
    expect(resolved.budgets.follower.enterStartPx).toBe(300);
    expect(resolved.budgets.follower.enterEndPx).toBe(900);
  });

  it('rejects an unbounded phase and preserves reachable after timing', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('leader', {
      animateId: 'leader',
      delay: 0,
      enterDuration: 500,
      exitDuration: 0,
      phase: { start: 0, end: 1 },
    });
    registrations.set('follower', {
      animateId: 'follower',
      delay: 0,
      enterDuration: 200,
      exitDuration: 0,
      after: 'leader',
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.invalidPhaseIds).toEqual(['leader']);
    expect(resolved.totalBudgetPx).toBe(700);
    expect(resolved.budgets.leader.phaseEndPx).toBe(500);
    expect(resolved.budgets.follower.enterStartPx).toBe(500);
    expect(resolved.budgets.follower.enterEndPx).toBe(700);
  });

  it('keeps a phased follower behind its predecessor even when its authored start is earlier', () => {
    const resolved = resolveSceneScrollAnimationBudgets(
      new Map([
        ['leader', { animateId: 'leader', delay: 0, enterDuration: 300, exitDuration: 200 }],
        [
          'follower',
          {
            animateId: 'follower',
            delay: 20,
            enterDuration: 200,
            exitDuration: 0,
            after: 'leader',
            phase: { start: 0, end: 0.9 },
          },
        ],
      ])
    );
    expect(resolved.budgets.follower.phaseStartPx).toBe(320);
    expect(resolved.budgets.follower.phaseEndPx).toBeCloseTo(468);
    expect(resolved.totalBudgetPx).toBe(520);
  });

  it('solves finite near-one phase timing without truncating a long dependency calculation', () => {
    const resolved = resolveSceneScrollAnimationBudgets(
      new Map([
        [
          'leader',
          {
            animateId: 'leader',
            delay: 0,
            enterDuration: 500,
            exitDuration: 0,
            phase: { start: 0, end: 0.99999 },
          },
        ],
        [
          'follower',
          { animateId: 'follower', delay: 0, enterDuration: 200, exitDuration: 0, after: 'leader' },
        ],
      ])
    );
    expect(resolved.invalidPhaseIds).toBeUndefined();
    expect(resolved.totalBudgetPx).toBeCloseTo(200 / (1 - 0.99999), 5);
    expect(resolved.budgets.follower.enterStartPx).toBeCloseTo(
      resolved.budgets.leader.phaseEndPx!,
      5
    );
    expect(resolved.budgets.follower.enterEndPx).toBeCloseTo(resolved.totalBudgetPx, 5);
  });
});
