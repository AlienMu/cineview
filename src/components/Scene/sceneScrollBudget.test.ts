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

  it('resolves delay and waitFor chains into one shared timeline', () => {
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
      waitFor: 'intro',
    });

    const resolved = resolveSceneScrollAnimationBudgets(registrations);

    expect(resolved.totalDurationMs).toBe(850);
    expect(resolved.budgets.intro.startMs).toBe(100);
    expect(resolved.budgets.intro.exitEndMs).toBe(600);
    expect(resolved.budgets.details.startMs).toBe(650);
    expect(resolved.budgets.details.totalEndMs).toBe(850);
  });

  it('fails open dependency cycles without adding cyclic predecessor time', () => {
    const registrations = new Map<string, SceneScrollAnimationRegistration>();
    registrations.set('a', {
      animateId: 'a',
      delay: 1,
      enterDuration: 10,
      exitDuration: 0,
      waitFor: 'b',
    });
    registrations.set('b', {
      animateId: 'b',
      delay: 2,
      enterDuration: 20,
      exitDuration: 0,
      waitFor: 'a',
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
          waitFor: 'b',
        },
      ],
      [
        'b',
        {
          animateId: 'b',
          delay: 2,
          enterDuration: 20,
          exitDuration: 2,
          waitFor: 'c',
        },
      ],
      [
        'c',
        {
          animateId: 'c',
          delay: 3,
          enterDuration: 30,
          exitDuration: 3,
          waitFor: 'a',
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
});
