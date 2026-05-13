import {
  resolveScrollZoneAnimationBudgets,
  type ScrollZoneAnimationRegistration,
} from './scrollZoneBudget';

describe('resolveScrollZoneAnimationBudgets', () => {
  it('allocates enter-only animation to the full local budget', () => {
    const registrations = new Map<string, ScrollZoneAnimationRegistration>();
    registrations.set('enter-only', {
      animateId: 'enter-only',
      delay: 0,
      enterDuration: 3000,
      exitDuration: 0,
    });

    const resolved = resolveScrollZoneAnimationBudgets(registrations, 'auto');
    const budget = resolved.budgets['enter-only'];

    expect(resolved.totalDurationMs).toBe(3000);
    expect(budget.enterStartMs).toBe(0);
    expect(budget.enterEndMs).toBe(3000);
    expect(budget.exitStartMs).toBeNull();
    expect(budget.totalEndMs).toBe(3000);
    expect(budget.enterEndPx).toBe(resolved.totalBudgetPx);
  });

  it('splits a long animation into enter and exit segments by duration', () => {
    const registrations = new Map<string, ScrollZoneAnimationRegistration>();
    registrations.set('long', {
      animateId: 'long',
      delay: 0,
      enterDuration: 3000,
      exitDuration: 3000,
    });

    const resolved = resolveScrollZoneAnimationBudgets(registrations, 1200);
    const budget = resolved.budgets.long;

    expect(budget.enterEndPx).toBeCloseTo(600, 4);
    expect(budget.exitStartPx).toBeCloseTo(600, 4);
    expect(budget.exitEndPx).toBeCloseTo(1200, 4);
  });

  it('extends total budget when delay and waitFor chain are present', () => {
    const registrations = new Map<string, ScrollZoneAnimationRegistration>();
    registrations.set('first', {
      animateId: 'first',
      delay: 0,
      enterDuration: 1000,
      exitDuration: 0,
    });
    registrations.set('second', {
      animateId: 'second',
      delay: 400,
      enterDuration: 1200,
      exitDuration: 800,
      waitFor: 'first',
    });

    const resolved = resolveScrollZoneAnimationBudgets(registrations, 'auto');
    const second = resolved.budgets.second;

    expect(resolved.totalDurationMs).toBe(3400);
    expect(second.startMs).toBe(1400);
    expect(second.enterEndMs).toBe(2600);
    expect(second.exitEndMs).toBe(3400);
  });
});
