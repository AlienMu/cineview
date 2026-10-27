import assert from 'node:assert/strict';
import test from 'node:test';
import { imageCopyRegistration } from './runtime-fixes.mjs';

const rect = (y, width = 358) => ({ x: 461, y, width, height: 140 });

test('image registration keeps a strict margin and rejects actual offsets', () => {
  assert.equal(imageCopyRegistration(rect(100), rect(100), rect(100)).consistent, true);
  assert.equal(imageCopyRegistration(rect(100), rect(100.08), rect(100)).consistent, false);
  assert.equal(imageCopyRegistration(rect(100), rect(100.16), rect(100.08)).consistent, false);
  assert.equal(imageCopyRegistration(rect(100), rect(100, 358.08), rect(100)).consistent, false);
  assert.equal(imageCopyRegistration(rect(0), rect(0.05), rect(0)).consistent, false);
  assert.equal(imageCopyRegistration(rect(100), rect(100, 0), rect(100)).consistent, false);
  assert.equal(imageCopyRegistration(rect(NaN), rect(100), rect(100)).consistent, false);
});

test('recorded moving reads use the source interval without widening the margin', () => {
  const before = rect(-599.5062255859375);
  const after = rect(-599.5862426757812);
  const forward = imageCopyRegistration(before, after, after);
  assert.equal(forward.direct, 0.08001708984375);
  assert.equal(forward.outside, 0);
  assert.equal(forward.consistent, true);
  assert.equal(imageCopyRegistration(after, before, before).consistent, true);
});
