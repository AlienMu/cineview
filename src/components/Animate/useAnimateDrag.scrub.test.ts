/**
 * Single shared timeline — enter local progress (restored 2026-06-30).
 *
 * Pure-function red proof for `resolveEnterLocalProgress`. The self-review log
 * (2026-06-25, 2026-06-29 ×2) warns that integration renders give false-green
 * here: the framer-motion `animate` mock jumps synchronously to target and a
 * single eval per scroll hides the very behaviour under test. So the contract
 * is asserted at the pure-function layer, where every input is explicit.
 *
 * THE MODEL (the user's final decision after the waitFor-scrub detours):
 *   - ONE shared element-track clock `m` (elapsed ms). EVERY element reads the
 *     SAME `m` and gates on its OWN calculatedDelay / enterDuration:
 *         localProgress = clamp((m - calculatedDelay) / enterDuration, 0, 1)
 *   - waitFor / delay sequencing is correct for free: calculatedDelay folds in
 *     the waitFor target's full delay+duration at registration, so a chain member
 *     B gates at A's completion — "A plays out, THEN B starts" holds at EVERY
 *     `m`, drag or settle, with no runtime waitFor logic.
 *   - SHORT elements settle EARLY (a 200ms element reaches 1 while the shared
 *     clock is only part-way to T_self). This is ACCEPTED: the trade is correct
 *     waitFor serialisation. The "feel" is tuned by decoupling drag SPEED from
 *     the clock via dragTimeScale (useElementTrack maps drag % to an absolute ms
 *     rate, tested separately), NOT by changing this read formula.
 *
 * Confirm RED by reverting the formula (e.g. divide by a scene-wide duration, or
 * drop the delay gate) before trusting these.
 */

import { resolveEnterLocalProgress } from './useAnimateDrag';

describe('resolveEnterLocalProgress — single shared timeline', () => {
  describe('every element reads the same clock and gates on its own delay', () => {
    it('a no-delay element is linear in the shared elapsed', () => {
      // (m - 0) / 600
      expect(resolveEnterLocalProgress(0, 0, 600)).toBe(0);
      expect(resolveEnterLocalProgress(300, 0, 600)).toBeCloseTo(0.5);
      expect(resolveEnterLocalProgress(600, 0, 600)).toBeCloseTo(1);
    });
    it('a delayed element stays 0 until the shared clock passes its delay', () => {
      // delay 500, dur 600.
      expect(resolveEnterLocalProgress(400, 500, 600)).toBe(0); // before delay
      expect(resolveEnterLocalProgress(500, 500, 600)).toBe(0); // at delay
      expect(resolveEnterLocalProgress(800, 500, 600)).toBeCloseTo(0.5); // (800-500)/600
      expect(resolveEnterLocalProgress(1100, 500, 600)).toBeCloseTo(1);
    });
  });

  describe('short elements settle EARLY on the shared clock (accepted trade)', () => {
    it('a 200ms element reaches 1 while a 2000ms sibling is only at 0.1', () => {
      // Both read the SAME shared clock m = 200ms.
      const short = resolveEnterLocalProgress(200, 0, 200);
      const long = resolveEnterLocalProgress(200, 0, 2000);
      expect(short).toBeCloseTo(1); // short already done
      expect(long).toBeCloseTo(0.1); // long barely started
    });
  });

  describe('waitFor serialises via calculatedDelay at EVERY clock value', () => {
    // media: no waitFor, dur 900. copy: waitFor media -> calcDelay 900, dur 600.
    // (registry folds media's full 0+900 into copy's calcDelay.)
    it('copy is 0 while media is still running (m < 900), at every sampled m', () => {
      for (const m of [0, 200, 450, 700, 899]) {
        const media = resolveEnterLocalProgress(m, 0, 900);
        const copy = resolveEnterLocalProgress(m, 900, 600);
        expect(copy).toBe(0);
        expect(media).toBeLessThan(1); // media still running
      }
    });
    it('copy opens exactly when media completes (m = 900)', () => {
      expect(resolveEnterLocalProgress(900, 0, 900)).toBeCloseTo(1); // media done
      expect(resolveEnterLocalProgress(900, 900, 600)).toBe(0); // copy at its gate
      expect(resolveEnterLocalProgress(1200, 900, 600)).toBeCloseTo(0.5); // copy mid
    });
    it('B never animates while A is still running (∀ sampled m)', () => {
      for (const m of [0, 300, 600, 899, 900, 1200, 1500]) {
        const media = resolveEnterLocalProgress(m, 0, 900);
        const copy = resolveEnterLocalProgress(m, 900, 600);
        if (copy > 0) {
          expect(media).toBeCloseTo(1);
        }
      }
    });
  });

  describe('boundary inputs', () => {
    it('zero-duration element gates as a binary step on its delay', () => {
      expect(resolveEnterLocalProgress(400, 500, 0)).toBe(0); // before delay
      expect(resolveEnterLocalProgress(500, 500, 0)).toBe(1); // at/after delay
      expect(resolveEnterLocalProgress(900, 500, 0)).toBe(1);
    });
    it('clamps to [0, 1] past the element window', () => {
      expect(resolveEnterLocalProgress(5000, 0, 600)).toBe(1);
      expect(resolveEnterLocalProgress(-100, 0, 600)).toBe(0);
    });
  });
});
