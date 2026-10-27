/**
 * Visibility gates for time effects played on a clock outside zones (`enter`, `eye`), with 1.x
 * semantics (site docs: visibility conditions; useAnimateScroll gate machine).
 *
 * Normal element (height <= vh - enter margin):
 *   enter: top >= 0 && bottom <= vh - enterMargin        (fully in view, clear of the bottom)
 *   exit:  top <= exitMargin || bottom >= vh - exitMargin (leaving through either edge)
 * Oversized element: enter when its top crosses the middle, exit when its bottom rises past 70%;
 * exit wins where both hold.
 * Eye (`on="eye"`): enter while the element straddles the eye line at 45% of the viewport.
 * Partial (`on="enter(partial)"`): enter while any part overlaps the viewport vertically, exit
 * once wholly out; margins do not apply.
 *
 * Where both gates hold the phase is kept (a hysteresis band, so small scrolls at an edge never
 * flip enter/exit). Only a declared exit exits; after an exit, entering again replays.
 */

export type GatePhase = 'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited';
export type GateAction = 'enter' | 'exit' | null;

export interface GateInput {
  /** Element rect relative to the viewport top. */
  top: number;
  bottom: number;
  vh: number;
  enterMargin: number;
  exitMargin: number;
  eye: boolean;
  /** `on="enter(partial)"`: enter while any part is in view, exit once wholly out (no margins). */
  partial?: boolean;
}

export interface Gates {
  enter: boolean;
  exit: boolean;
  /** Entirely above the viewport. */
  above: boolean;
  onScreen: boolean;
  oversized: boolean;
}

const EYE = 0.45;

export function gates(g: GateInput): Gates {
  const height = Math.max(g.bottom - g.top, 0);
  const above = g.bottom <= 0;
  const onScreen = g.bottom > 0 && g.top < g.vh;
  if (g.eye) {
    const line = g.vh * EYE;
    const at = g.top <= line && g.bottom >= line;
    return { enter: at, exit: !at, above, onScreen, oversized: false };
  }
  if (g.partial) {
    // A positive vertical overlap; touching an edge, or a zero height, is not in view.
    const inView = height > 0 && g.vh > 0 && g.bottom > 0 && g.top < g.vh;
    return { enter: inView, exit: !inView, above, onScreen, oversized: false };
  }
  const oversized = height > g.vh - g.enterMargin;
  if (oversized) {
    const exit = g.bottom <= g.vh * 0.7;
    return { enter: g.top <= g.vh / 2 && !exit, exit, above, onScreen, oversized };
  }
  return {
    enter: g.top >= 0 && g.bottom <= g.vh - g.enterMargin,
    exit: g.top <= g.exitMargin || g.bottom >= g.vh - g.exitMargin,
    above,
    onScreen,
    oversized,
  };
}

/** The transition to start from `phase`, or null to hold it. */
export function gateAction(
  phase: GatePhase,
  enter: boolean,
  exit: boolean,
  options: { hasExit: boolean; replay: boolean }
): GateAction {
  switch (phase) {
    case 'idle':
      return enter && !exit ? 'enter' : null;
    case 'entering':
    case 'entered':
      return exit && !enter && options.hasExit ? 'exit' : null;
    case 'exiting':
    case 'exited':
      return enter && !exit && options.replay ? 'enter' : null;
    default:
      return null;
  }
}
