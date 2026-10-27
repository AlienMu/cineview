import assert from 'node:assert/strict';
import test from 'node:test';
import {
  capabilities,
  classify,
  contexts,
  enumerateCoverage,
  getCapability,
  summarizeCoverage,
} from './combinations.mjs';

test('all single, pair and triple sets receive a pre-run status in every selected context', () => {
  const coverage = enumerateCoverage();
  const summary = summarizeCoverage(coverage);
  assert.deepEqual(summary.byOrder, { 1: 41, 2: 820, 3: 10660 });
  assert.equal(new Set(coverage.configs.map((c) => c.id)).size, 57605);
  assert.equal(coverage.configs.length, coverage.concepts.length * contexts.length);
  assert.ok(
    coverage.configs.every(
      (c) => c.reason && ['runnable', 'unsupported', 'not-applicable'].includes(c.status)
    )
  );
  assert.equal(capabilities.length, new Set(capabilities.map((c) => c.id)).size);
});

test('an unsupported Stage capability is retained rather than erased from the denominator', () => {
  assert.equal(classify([4, 12, 21], contexts[0]).status, 'unsupported');
  assert.equal(classify([4, 12], contexts[0]).status, 'runnable');
  assert.equal(classify([3, 12], contexts[3]).status, 'not-applicable');
  assert.equal(classify([3, 12], contexts[1]).status, 'runnable');
});

test('page work and drag adaptations are not relabeled as built-in original behavior', () => {
  assert.equal(getCapability(31).owner, 'page');
  assert.equal(getCapability(12).owner, 'framework');
  assert.equal(classify([3, 10], contexts[0]).adaptation, true);
  assert.equal(classify([4, 12], contexts[0]).adaptation, false);
  assert.throws(() => enumerateCoverage({ contextIds: ['safari'] }), /Unknown context/);
  assert.throws(() => classify([4, 4], contexts[0]), /distinct/);
  assert.throws(() => getCapability(42), /Unknown reference/);
});
