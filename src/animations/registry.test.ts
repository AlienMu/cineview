import { buildAnimationRegistrySnapshot } from './registry';

describe('animation registry', () => {
  it('calculates chained waitFor delays and timeline duration', () => {
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 500,
      registrations: new Map([
        ['title', { delay: 100, duration: 200 }],
        ['copy', { delay: 50, duration: 300, waitFor: 'title' }],
        ['cta', { delay: 25, duration: 100, waitFor: 'copy' }],
      ]),
    });

    expect(snapshot.calculatedDelays.get('title')).toBe(100);
    expect(snapshot.calculatedDelays.get('copy')).toBe(350);
    expect(snapshot.calculatedDelays.get('cta')).toBe(675);
    expect(snapshot.timelineDuration).toBe(775);
    expect(snapshot.issues).toEqual([]);
  });

  it('reports missing waitFor dependencies without dropping the animation', () => {
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 500,
      registrations: new Map([['copy', { delay: 50, duration: 300, waitFor: 'title' }]]),
    });

    expect(snapshot.calculatedDelays.get('copy')).toBe(50);
    expect(snapshot.timelineDuration).toBe(500);
    expect(snapshot.issues).toEqual([
      { type: 'missing-dependency', animateId: 'copy', waitFor: 'title' },
    ]);
  });

  it('reports waitFor cycles and remains deterministic', () => {
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 200,
      registrations: new Map([
        ['a', { delay: 10, duration: 100, waitFor: 'b' }],
        ['b', { delay: 20, duration: 100, waitFor: 'a' }],
      ]),
    });

    expect(snapshot.calculatedDelays.get('a')).toBeGreaterThanOrEqual(10);
    expect(snapshot.calculatedDelays.get('b')).toBeGreaterThanOrEqual(20);
    expect(snapshot.issues).toContainEqual({
      type: 'circular-dependency',
      animateId: 'a',
      cycle: ['a', 'b', 'a'],
    });
  });

  it('reports duplicate ids supplied by the registration owner', () => {
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: 200,
      registrations: new Map([['hero', { delay: 0, duration: 100 }]]),
      duplicateIds: ['hero'],
    });

    expect(snapshot.issues).toEqual([{ type: 'duplicate-id', animateId: 'hero' }]);
  });
});
