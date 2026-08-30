import { resolveGatePhaseAction, resolveInfiniteActive } from './useAnimateScroll';

// Deterministic red-proof for the visibility-gate phase-transition mutex.
//
// The reverse-re-entry flash (issues 1/2/5) came from the enter and exit gates
// overlapping in relTop ∈ [0, exitMargin]: BOTH gates true at once. Without a
// mutex the machine resolved 'exited' → 'enter' (and 'entered' → 'exit') inside
// that band, and a same-batch re-evaluation flipped it straight back, snapping
// visualMotion to -epsilon and flashing a near-animate frame before replaying
// the enter from 0. The fix: when both gates are true, hold the current phase.
//
// These assertions pin the overlap-band decision directly. The pre-fix switch
// (enter on `enterGate` alone, exit on `exitGate` alone) returns a non-null
// action for every overlap row below, so reverting the mutex turns each of
// these red — the property the prior integration test failed to capture
// (the framer-motion mock jumped straight to the terminal frame, hiding the
// transient -epsilon snap entirely).

const opts = { hasExplicitExit: true, replay: true };

describe('resolveGatePhaseAction — overlap-band mutex', () => {
  describe('both gates true (relTop ∈ [0, exitMargin]) holds the current phase', () => {
    it('does not enter from exited when exit gate is also satisfied', () => {
      // Pre-fix: 'exited' fired enter on enterGate alone → 'enter'. This is the
      // exact reverse-re-entry frame that flashed.
      expect(resolveGatePhaseAction('exited', true, true, opts)).toBeNull();
    });

    it('does not enter from idle when exit gate is also satisfied', () => {
      expect(resolveGatePhaseAction('idle', true, true, opts)).toBeNull();
    });

    it('does not enter from exiting when exit gate is also satisfied', () => {
      expect(resolveGatePhaseAction('exiting', true, true, opts)).toBeNull();
    });

    it('does not exit from entered when enter gate is also satisfied', () => {
      // Pre-fix: 'entered' fired exit on exitGate alone → 'exit'. Forward entry
      // into the comfort band would immediately snap toward exit.
      expect(resolveGatePhaseAction('entered', true, true, opts)).toBeNull();
    });

    it('does not exit from entering when enter gate is also satisfied', () => {
      expect(resolveGatePhaseAction('entering', true, true, opts)).toBeNull();
    });
  });

  describe('strictly above the band (enter only) enters', () => {
    it('enters from idle', () => {
      expect(resolveGatePhaseAction('idle', true, false, opts)).toBe('enter');
    });

    it('replays enter from exited', () => {
      expect(resolveGatePhaseAction('exited', true, false, opts)).toBe('enter');
    });

    it('replays enter from exiting', () => {
      expect(resolveGatePhaseAction('exiting', true, false, opts)).toBe('enter');
    });
  });

  describe('strictly below the band (exit only) exits', () => {
    it('exits from entered', () => {
      expect(resolveGatePhaseAction('entered', false, true, opts)).toBe('exit');
    });

    it('exits from entering when an explicit exit exists', () => {
      expect(resolveGatePhaseAction('entering', false, true, opts)).toBe('exit');
    });
  });

  describe('replay / hasExplicitExit guards', () => {
    it('does not replay enter from exited when replay is false', () => {
      expect(
        resolveGatePhaseAction('exited', true, false, {
          hasExplicitExit: true,
          replay: false,
        })
      ).toBeNull();
    });

    it('does not exit from entering without an explicit exit', () => {
      expect(
        resolveGatePhaseAction('entering', false, true, {
          hasExplicitExit: false,
          replay: true,
        })
      ).toBeNull();
    });

    it('holds entered without an explicit exit (no exitAnimation => stay visible)', () => {
      // Option A: an element with no authored exitAnimation never exits. Once
      // entered it holds its frame forever, even when its top crosses the exit
      // gate. Pre-fix this returned 'exit', which ran the no-exit branch's
      // visualMotion.set(0) and snapped the element to hidden with no animation
      // (the "scroll up past top => instantly disappears" regression).
      expect(
        resolveGatePhaseAction('entered', false, true, {
          hasExplicitExit: false,
          replay: true,
        })
      ).toBeNull();
    });
  });

  describe('neither gate satisfied holds', () => {
    it('holds every phase when both gates are false', () => {
      const phases = ['idle', 'entering', 'entered', 'exiting', 'exited'] as const;
      for (const phase of phases) {
        expect(resolveGatePhaseAction(phase, false, false, opts)).toBeNull();
      }
    });
  });
});

// Deterministic red-proof for the off-screen infinite-animation pause.
//
// The exit gate only fires at the TOP (relTop <= exitMargin). An element that
// entered and then scrolled back DOWN past the viewport bottom (relTop >= vh)
// never exits — its phase stays 'entered'. The pre-fix runtime kept
// shouldRunInfinite tied to phase alone, so its loopAnimation (e.g. pulse)
// kept spinning off-screen forever. resolveInfiniteActive gates the loop on live
// viewport intersection: it must be false whenever the element is off-screen,
// in EITHER direction, regardless of phase.
describe('resolveInfiniteActive — off-screen pause', () => {
  it('runs only when entered AND on-screen', () => {
    expect(resolveInfiniteActive('entered', true)).toBe(true);
  });

  it('pauses an entered element once it leaves the viewport (the off-screen-bottom bug)', () => {
    // This is the exact regression: phase is still 'entered' (no exit fired
    // because the element left via the bottom, not the top), but it is no longer
    // on-screen. Pre-fix this stayed true and pulse kept running off-screen.
    expect(resolveInfiniteActive('entered', false)).toBe(false);
  });

  it('never runs in a non-entered phase even while on-screen', () => {
    const nonEntered = ['idle', 'entering', 'exiting', 'exited'] as const;
    for (const phase of nonEntered) {
      expect(resolveInfiniteActive(phase, true)).toBe(false);
    }
  });
});
