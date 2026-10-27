import assert from 'node:assert/strict';
import test from 'node:test';
import { loopPerformanceCases } from './runtime-performance.mjs';

test('loop performance covers both declaration orders in every accepted context', () => {
  const cases = loopPerformanceCases();
  const contexts = ['drag', 'zone-auto', 'zone-fallback', 'enter-auto', 'enter-fallback'];
  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map((c) => c.id)).size, 20);
  for (const [family, declarations] of [
    ['loop-periods', ['sway, spin', 'spin, sway']],
    [
      'loop-owners',
      [
        'hue(90deg), wipe(left), hue(180deg), wipe(right)',
        'wipe(right), hue(180deg), wipe(left), hue(90deg)',
      ],
    ],
  ])
    for (const [index, declaration] of declarations.entries()) {
      const selected = cases.filter((c) => c.id.startsWith(`${family}/${index + 1}/`));
      assert.deepEqual(
        selected.map((c) => c.context),
        contexts
      );
      assert.ok(selected.every((c) => c.loop === declaration));
    }
  const periods = cases.filter((c) => c.profileId === 'AUTH-LOOP-OWN-PERIODS');
  assert.equal(periods.length, 10);
  assert.ok(periods.every((c) => c.loopDuration === null && c.activeMs > 8000));
  const owners = cases.filter((c) => c.profileId === 'AUTH-LAST-OWNER-CLIP-VAR');
  assert.equal(owners.length, 10);
  assert.ok(owners.every((c) => c.loopDuration === 1000 && c.activeMs > 1000 && c.consumeHue));
});
