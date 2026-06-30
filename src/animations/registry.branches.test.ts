import { buildAnimationRegistrySnapshot } from './registry';

describe('animation registry branch coverage', () => {
  it('deduplicates identical issues from repeated duplicate ids', () => {
    // duplicateIds yields the same id twice -> pushIssueOnce is called twice
    // with an identical issue key. The second call hits the early `return`
    // dedup guard (line 50), so only one issue is recorded.
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 200,
      registrations: new Map([['hero', { delay: 0, duration: 100 }]]),
      duplicateIds: ['hero', 'hero'],
    });

    expect(snapshot.issues).toEqual([{ type: 'duplicate-id', animateId: 'hero' }]);
  });

  it('caches a resolved delay so a re-requested dependency reuses the cache', () => {
    // Two animations both waitFor the same 'base'. When the second dependant is
    // resolved, 'base' is already cached, exercising the cache short-circuit
    // (lines 70-73) rather than recomputing.
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 0,
      registrations: new Map([
        ['base', { delay: 10, duration: 100 }],
        ['a', { delay: 5, duration: 50, waitFor: 'base' }],
        ['b', { delay: 7, duration: 50, waitFor: 'base' }],
      ]),
    });

    expect(snapshot.calculatedDelays.get('base')).toBe(10);
    // a: 5 + (base delay 10 + base duration 100) = 115
    expect(snapshot.calculatedDelays.get('a')).toBe(115);
    // b: 7 + (base delay 10 + base duration 100) = 117
    expect(snapshot.calculatedDelays.get('b')).toBe(117);
    expect(snapshot.issues).toEqual([]);
  });

  it('uses baseDuration when it exceeds every calculated end time', () => {
    // timelineDuration starts at Math.max(baseDuration, 0); here baseDuration
    // dominates so the per-registration Math.max keeps the base value.
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 9000,
      registrations: new Map([['solo', { delay: 0, duration: 100 }]]),
    });

    expect(snapshot.timelineDuration).toBe(9000);
  });

  it('clamps a negative baseDuration to zero', () => {
    // Math.max(baseDuration, 0) -> 0 branch when baseDuration is negative.
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: -500,
      registrations: new Map([['solo', { delay: 0, duration: 100 }]]),
    });

    // timeline is driven purely by the registration end time (0 + 100).
    expect(snapshot.timelineDuration).toBe(100);
  });
});
