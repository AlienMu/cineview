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

  it('reuses the visited cache for a diamond dependency (A→C, B→C, top→A/B)', () => {
    // Diamond: both 'a' and 'b' waitFor 'c'; 'top' waitFor both 'a' and 'b' is
    // not expressible (single waitFor), so model the diamond as the registry
    // forEach resolving 'a' first (which resolves+caches 'c'), then 'b' — whose
    // waitFor 'c' is already fully resolved AND marked visited. Requesting it
    // again hits the `visited.has(animateId)` branch (line 88) returning the
    // cached delay rather than re-walking the chain.
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 0,
      registrations: new Map([
        ['c', { delay: 10, duration: 100 }],
        ['a', { delay: 5, duration: 50, waitFor: 'c' }],
        ['b', { delay: 7, duration: 50, waitFor: 'c' }],
      ]),
    });

    // c resolved once (delay 10). a = 5 + (10 + 100) = 115. b = 7 + (10 + 100) = 117.
    // The second dependant reaching 'c' finds it already cached/visited.
    expect(snapshot.calculatedDelays.get('c')).toBe(10);
    expect(snapshot.calculatedDelays.get('a')).toBe(115);
    expect(snapshot.calculatedDelays.get('b')).toBe(117);
    expect(snapshot.issues).toEqual([]);
  });

  it('records a missing-dependency issue when waitFor targets an unregistered id', () => {
    // 'a' waitFor 'ghost' which is not registered -> the `!waitForInfo` branch
    // (line 97) fires, recording a missing-dependency issue; 'a' keeps its own
    // delay (5) with no chain contribution.
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 0,
      registrations: new Map([['a', { delay: 5, duration: 50, waitFor: 'ghost' }]]),
    });

    expect(snapshot.calculatedDelays.get('a')).toBe(5);
    expect(snapshot.issues).toEqual([
      { type: 'missing-dependency', animateId: 'a', waitFor: 'ghost' },
    ]);
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

  it('reports a circular waitFor chain and remains finite', () => {
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 0,
      registrations: new Map([
        ['a', { delay: 1, duration: 10, waitFor: 'b' }],
        ['b', { delay: 2, duration: 20, waitFor: 'a' }],
      ]),
    });

    expect(snapshot.issues).toEqual([
      { type: 'circular-dependency', animateId: 'a', cycle: ['a', 'b', 'a'] },
    ]);
    expect(snapshot.calculatedDelays.get('a')).toBe(34);
    expect(snapshot.calculatedDelays.get('b')).toBe(13);
  });
});
