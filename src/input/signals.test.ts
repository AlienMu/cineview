import { DEAD_ZONE, FULL_SPEED, Signals, TOP } from './signals';

/** Move at `v` px/ms for `ms`, one sample and step per 16 ms frame. */
function move(
  s: Signals,
  from: number,
  v: number,
  ms: number,
  t0: number
): { y: number; t: number } {
  let y = from;
  let t = t0;
  for (let k = 0; k < ms / 16; k++) {
    t += 16;
    y += v * 16;
    s.sample(y, t);
    s.step(t);
  }
  return { y, t };
}

/** Frames without readings until the signals rest; returns how long that took. */
function settle(s: Signals, t0: number): number {
  let t = t0;
  while (!s.resting && t - t0 < 5000) {
    t += 16;
    s.step(t);
  }
  return t - t0;
}

describe('Signals', () => {
  test('velocity follows a steady movement and is signed', () => {
    const s = new Signals();
    s.sample(500, 0);
    move(s, 500, 1.5, 600, 0);
    expect(s.velocity).toBeCloseTo(1.5, 2);
    expect(s.speed).toBeCloseTo(1.5 / FULL_SPEED, 2);
    const back = new Signals();
    back.sample(3000, 0);
    move(back, 3000, -6, 600, 0);
    expect(back.speed).toBe(-1);
  });

  test('speed rises faster than it falls; after the reader stops the signals rest', () => {
    const s = new Signals();
    s.sample(500, 0);
    const { t } = move(s, 500, 2, 80, 0);
    // Rising: most of the way within 80 ms.
    expect(s.velocity).toBeGreaterThan(1.2);
    const after = new Signals();
    after.sample(500, 0);
    const end = move(after, 500, 2, 600, 0);
    let u = end.t;
    for (let k = 0; k < 5; k++) after.step((u += 16));
    // Falling: still most of the speed 80 ms after the last reading (60 ms of it hold).
    expect(after.velocity).toBeGreaterThan(1.5);
    const took = settle(s, t);
    expect(s.velocity).toBe(0);
    expect(s.resting).toBe(true);
    expect(took).toBeGreaterThan(1000);
    expect(took).toBeLessThan(3000);
  });

  test('a jump is not movement', () => {
    const s = new Signals();
    s.sample(0, 0);
    s.step(0);
    s.sample(5000, 16);
    s.step(16);
    expect(s.velocity).toBe(0);
  });

  test('heading: dead zone, and near the start the reader heads back', () => {
    const s = new Signals();
    expect(s.sample(100, 0)).toBe(false);
    expect(s.sample(100 + DEAD_ZONE - 1, 16)).toBe(false);
    expect(s.heading).toBe(0);
    expect(s.sample(100 + DEAD_ZONE + 1, 32)).toBe(true);
    expect(s.heading).toBe(1);
    // Small moves are ignored and do not move the reference point.
    s.sample(200, 48);
    expect(s.sample(200 - DEAD_ZONE + 2, 64)).toBe(false);
    expect(s.sample(200 - DEAD_ZONE - 1, 80)).toBe(true);
    expect(s.heading).toBe(-1);
    expect(s.sample(200 + 10, 96)).toBe(true);
    expect(s.heading).toBe(1);
    // Moving forward within TOP of the start still counts as heading back (lexicon #20).
    const top = new Signals();
    top.sample(0, 0);
    expect(top.sample(TOP - 10, 16)).toBe(true);
    expect(top.heading).toBe(-1);
    expect(top.sample(TOP + 10, 32)).toBe(true);
    expect(top.heading).toBe(1);
  });

  test('direction progress turns over in a fixed time and rests at its goal', () => {
    const s = new Signals();
    s.sample(100, 0);
    s.step(0);
    expect(s.turn).toBe(0);
    s.sample(150, 16);
    s.step(16);
    expect(s.heading).toBe(1);
    expect(s.turn).toBeGreaterThan(0);
    expect(s.turn).toBeLessThan(1);
    settle(s, 16);
    expect(s.turn).toBe(1);
    s.sample(100, 4000);
    s.step(4000);
    expect(s.heading).toBe(-1);
    settle(s, 4000);
    expect(s.turn).toBe(0);
    expect(s.resting).toBe(true);
  });
});
