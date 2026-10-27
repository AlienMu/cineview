import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { INIT } from './harness.mjs';

test('measurement phases do not retain old cadence callbacks or fabricate unsupported APIs', () => {
  let next = 0,
    now = 0;
  const queue = new Map();
  class Observer {
    static supportedEntryTypes = [];
    observe() {}
  }
  const context = {
    PerformanceObserver: Observer,
    performance: { now: () => now },
    requestAnimationFrame: (callback) => {
      queue.set(++next, callback);
      return next;
    },
    cancelAnimationFrame: (id) => queue.delete(id),
  };
  context.window = context;
  vm.runInNewContext(`(${INIT.toString()})()`, context);
  for (let round = 0; round < 20; round++) {
    context.startMeasure();
    assert.equal(queue.size, 1);
    for (let frame = 0; frame < 4; frame++) {
      const batch = [...queue.values()];
      queue.clear();
      now += 16;
      batch.forEach((callback) => callback(now));
      assert.equal(queue.size, 1);
    }
    const m = context.stopMeasure();
    assert.equal(queue.size, 0);
    assert.equal(m.frames, 3);
    assert.equal(m.hz, 62.5);
    assert.equal(m.supported.loaf, false);
    assert.equal(m.supported.longtask, false);
    assert.equal(m.raw.rafGaps.length, 3);
  }
});
