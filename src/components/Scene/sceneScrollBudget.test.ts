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
});
