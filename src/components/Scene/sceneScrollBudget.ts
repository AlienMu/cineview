export interface SceneScrollAnimationRegistration {
  animateId: string;
  delay: number;
  enterDuration: number;
  exitDuration: number;
  after?: string;
  phase?: {
    start?: number;
    end?: number;
  };
}

export interface SceneScrollAnimationBudget {
  animateId: string;
  startMs: number;
  enterStartMs: number;
  enterEndMs: number;
  exitStartMs: number | null;
  exitEndMs: number | null;
  totalEndMs: number;
  startPx: number;
  enterStartPx: number;
  enterEndPx: number;
  exitStartPx: number | null;
  exitEndPx: number | null;
  totalEndPx: number;
  phaseStartPx?: number;
  phaseEndPx?: number;
  hasExit: boolean;
}

export interface ResolvedSceneScrollSequence {
  budgets: Record<string, SceneScrollAnimationBudget>;
  totalDurationMs: number;
  totalBudgetPx: number;
}

const SCROLL_PX_PER_MS = 1;
type SceneScrollAnimationTiming = Omit<
  SceneScrollAnimationBudget,
  | 'startPx'
  | 'enterStartPx'
  | 'enterEndPx'
  | 'exitStartPx'
  | 'exitEndPx'
  | 'totalEndPx'
  | 'phaseStartPx'
  | 'phaseEndPx'
>;

function clampToNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolvePhaseBoundaryPx(
  phase: number | undefined,
  fallbackPx: number,
  windowStartPx: number,
  windowEndPx: number
): number {
  if (phase === undefined) {
    return fallbackPx;
  }

  const clampedPhase = clamp(phase, 0, 1);
  return windowStartPx + (windowEndPx - windowStartPx) * clampedPhase;
}

function resolveTiming(
  animateId: string,
  registrations: Map<string, SceneScrollAnimationRegistration>,
  cache: Map<string, SceneScrollAnimationTiming>,
  chain: Set<string>,
  circularFollowers: Set<string>,
  phaseChainEndEstimates: Map<string, number>
): SceneScrollAnimationTiming {
  const cached = cache.get(animateId);
  if (cached) {
    return cached;
  }

  const registration = registrations.get(animateId);
  if (!registration) {
    const empty = {
      animateId,
      startMs: 0,
      enterStartMs: 0,
      enterEndMs: 0,
      exitStartMs: null,
      exitEndMs: null,
      totalEndMs: 0,
      hasExit: false,
    };
    cache.set(animateId, empty);
    return empty;
  }

  if (chain.has(animateId)) {
    const chainIds = [...chain];
    const cycleStart = chainIds.indexOf(animateId);
    chainIds.slice(cycleStart).forEach((cycleId) => circularFollowers.add(cycleId));
    const fallback = {
      animateId,
      startMs: clampToNonNegative(registration.delay),
      enterStartMs: clampToNonNegative(registration.delay),
      enterEndMs:
        clampToNonNegative(registration.delay) + clampToNonNegative(registration.enterDuration),
      exitStartMs: null,
      exitEndMs: null,
      totalEndMs:
        clampToNonNegative(registration.delay) + clampToNonNegative(registration.enterDuration),
      hasExit: false,
    };
    cache.set(animateId, fallback);
    return fallback;
  }

  chain.add(animateId);

  let predecessorEnd = 0;
  if (registration.after) {
    const predecessor = resolveTiming(
      registration.after,
      registrations,
      cache,
      chain,
      circularFollowers,
      phaseChainEndEstimates
    );
    if (!circularFollowers.has(animateId)) {
      // Chained followers wait for the leader's EFFECTIVE end. A phase-authored
      // leader finishes visually at its phase window end (a fraction of the zone
      // total), not at its nominal ms end — consuming the raw nominal end here
      // splits the ms/px clocks and starts the follower while the leader is
      // still mid-window (T1.8 acceptance trace; task-flow 2026-08-23-scene-
      // scroll-budget-dual-clock).
      predecessorEnd = phaseChainEndEstimates.get(registration.after) ?? predecessor.totalEndMs;
    }
  }
  const startMs = predecessorEnd + clampToNonNegative(registration.delay);
  const enterDuration = Math.max(clampToNonNegative(registration.enterDuration), 1);
  const exitDuration = clampToNonNegative(registration.exitDuration);
  const enterEndMs = startMs + enterDuration;
  const hasExit = exitDuration > 0;
  const exitStartMs = hasExit ? enterEndMs : null;
  const exitEndMs = hasExit ? enterEndMs + exitDuration : null;
  const totalEndMs = exitEndMs ?? enterEndMs;

  const resolved = {
    animateId,
    startMs,
    enterStartMs: startMs,
    enterEndMs,
    exitStartMs,
    exitEndMs,
    totalEndMs,
    hasExit,
  };

  cache.set(animateId, resolved);
  chain.delete(animateId);
  return resolved;
}

/**
 * Chain anchor for a phase-authored element, mirroring what the px assembly
 * computes as its enter-window close (`phaseEndPx`) — the documented after
 * semantics is "wait for the leader's ENTER completion". Authored exits are
 * deliberately NOT chain anchors: the assembly pins them to the zone end, and
 * waiting for "the last thing in the zone" has no fixed point (review PROBE1:
 * the zone ballooned ~600,000px under that anchor). A phase+exit leader's
 * followers therefore start at its enter-window close, overlapping its
 * zone-end exit — defined, bounded composition.
 *
 * Mirrors the assembly exactly (px ≡ ms numerically): the start floor
 * `phaseStartPx + 1` included.
 */
function resolvePhaseChainEndEstimateMs(
  registration: SceneScrollAnimationRegistration,
  resolved: SceneScrollAnimationTiming,
  totalDurationMs: number
): number {
  const estimateStartMs =
    registration.phase?.start !== undefined
      ? clamp(registration.phase.start, 0, 1) * totalDurationMs
      : resolved.startMs;
  const estimateEndMs =
    registration.phase?.end !== undefined
      ? clamp(registration.phase.end, 0, 1) * totalDurationMs
      : Math.max(resolved.enterEndMs, resolved.startMs + 1);
  return Math.max(estimateEndMs, estimateStartMs + 1);
}

export function resolveSceneScrollAnimationBudgets(
  registrations: Map<string, SceneScrollAnimationRegistration>
): ResolvedSceneScrollSequence {
  const cache = new Map<string, SceneScrollAnimationTiming>();
  const circularFollowers = new Set<string>();
  const phaseChainEndEstimates = new Map<string, number>();

  const hasPhaseAuthored = [...registrations.values()].some(
    (registration) =>
      registration.phase?.start !== undefined || registration.phase?.end !== undefined
  );

  const resolveAll = (): void => {
    registrations.forEach((_, animateId) => {
      resolveTiming(
        animateId,
        registrations,
        cache,
        new Set<string>(),
        circularFollowers,
        phaseChainEndEstimates
      );
    });
  };

  if (hasPhaseAuthored) {
    // Phase windows reference the zone total; chained followers reference phase
    // ends; chain extents feed the zone total — a fixed-point system. With
    // phase.end < 1 the update is a contraction (T = f·T + rest, f < 1) and
    // converges geometrically; the generous cap only bounds degenerate
    // phase.end → 1 chains, where followers pile past the zone end (defined,
    // never-entering state) instead of looping forever. For f = 0.999 the
    // residual after the cap is f^100000 ≈ e^-100 — far below any visible px;
    // the cap only bites for pathological near-1 fractions, where recompute
    // cost is mount-time (registration changes), never per frame.
    const maxIterations = 100000;
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      cache.clear();
      circularFollowers.clear();
      resolveAll();

      let totalMs = 0;
      cache.forEach((resolvedBudget) => {
        totalMs = Math.max(totalMs, resolvedBudget.totalEndMs);
      });

      let stable = true;
      registrations.forEach((registration, animateId) => {
        const authored =
          registration.phase?.start !== undefined || registration.phase?.end !== undefined;
        if (!authored) return;
        const resolved = cache.get(animateId);
        if (!resolved) return;
        const effectiveEndMs = resolvePhaseChainEndEstimateMs(registration, resolved, totalMs);
        const previous = phaseChainEndEstimates.get(animateId);
        if (previous === undefined || Math.abs(previous - effectiveEndMs) > 1e-9) {
          stable = false;
        }
        phaseChainEndEstimates.set(animateId, effectiveEndMs);
      });

      if (stable) break;
    }
  }

  // Final pass with the (converged or empty) estimates — for phase-free zone
  // registrations the estimates map stays empty and this is byte-identical to
  // the pre-fix single-pass resolution.
  cache.clear();
  circularFollowers.clear();
  resolveAll();

  let totalDurationMs = 0;
  cache.forEach((resolvedBudget) => {
    totalDurationMs = Math.max(totalDurationMs, resolvedBudget.totalEndMs);
  });

  const totalBudgetPx = totalDurationMs > 0 ? Math.max(totalDurationMs * SCROLL_PX_PER_MS, 1) : 0;
  const pxPerMs = SCROLL_PX_PER_MS;

  const budgets: Record<string, SceneScrollAnimationBudget> = {};
  cache.forEach((resolvedBudget, animateId) => {
    const registration = registrations.get(animateId);
    const hasAuthoredPhase =
      registration?.phase?.start !== undefined || registration?.phase?.end !== undefined;
    const baseBudget: SceneScrollAnimationBudget = {
      ...resolvedBudget,
      startPx: resolvedBudget.startMs * pxPerMs,
      enterStartPx: resolvedBudget.enterStartMs * pxPerMs,
      enterEndPx: resolvedBudget.enterEndMs * pxPerMs,
      exitStartPx:
        resolvedBudget.exitStartMs === null ? null : resolvedBudget.exitStartMs * pxPerMs,
      exitEndPx: resolvedBudget.exitEndMs === null ? null : resolvedBudget.exitEndMs * pxPerMs,
      totalEndPx: resolvedBudget.totalEndMs * pxPerMs,
      phaseStartPx: 0,
      phaseEndPx: 0,
    };

    const fallbackStartPx = baseBudget.enterStartPx;
    const fallbackEndPx = Math.max(baseBudget.enterEndPx, fallbackStartPx + 1);
    const phaseWindowStartPx = hasAuthoredPhase ? 0 : fallbackStartPx;
    const phaseWindowEndPx = hasAuthoredPhase ? totalBudgetPx : fallbackEndPx;
    const phaseStartPx = resolvePhaseBoundaryPx(
      registration?.phase?.start,
      fallbackStartPx,
      phaseWindowStartPx,
      phaseWindowEndPx
    );
    const phaseEndPx = Math.max(
      resolvePhaseBoundaryPx(
        registration?.phase?.end,
        fallbackEndPx,
        phaseWindowStartPx,
        phaseWindowEndPx
      ),
      phaseStartPx + 1
    );

    baseBudget.phaseStartPx = phaseStartPx;
    baseBudget.phaseEndPx = phaseEndPx;

    if (hasAuthoredPhase) {
      if (baseBudget.hasExit) {
        const exitDurationMs = clampToNonNegative(
          (resolvedBudget.exitEndMs ?? resolvedBudget.totalEndMs) -
            (resolvedBudget.exitStartMs ?? resolvedBudget.enterEndMs)
        );
        const exitDurationPx = Math.max(exitDurationMs, 1) * pxPerMs;
        baseBudget.exitEndPx = totalBudgetPx;
        baseBudget.exitStartPx = Math.max(phaseEndPx, totalBudgetPx - exitDurationPx);
        baseBudget.totalEndPx = baseBudget.exitEndPx;
      } else {
        baseBudget.totalEndPx = phaseEndPx;
      }
    }

    budgets[animateId] = baseBudget;
  });

  return {
    budgets,
    totalDurationMs,
    totalBudgetPx,
  };
}

function areSceneScrollAnimationBudgetsEqual(
  left: SceneScrollAnimationBudget,
  right: SceneScrollAnimationBudget
): boolean {
  return (
    left.animateId === right.animateId &&
    left.startMs === right.startMs &&
    left.enterStartMs === right.enterStartMs &&
    left.enterEndMs === right.enterEndMs &&
    left.exitStartMs === right.exitStartMs &&
    left.exitEndMs === right.exitEndMs &&
    left.totalEndMs === right.totalEndMs &&
    left.startPx === right.startPx &&
    left.enterStartPx === right.enterStartPx &&
    left.enterEndPx === right.enterEndPx &&
    left.exitStartPx === right.exitStartPx &&
    left.exitEndPx === right.exitEndPx &&
    left.totalEndPx === right.totalEndPx &&
    left.phaseStartPx === right.phaseStartPx &&
    left.phaseEndPx === right.phaseEndPx &&
    left.hasExit === right.hasExit
  );
}

export function areResolvedSceneScrollSequencesEqual(
  left: ResolvedSceneScrollSequence,
  right: ResolvedSceneScrollSequence
): boolean {
  if (
    left.totalDurationMs !== right.totalDurationMs ||
    left.totalBudgetPx !== right.totalBudgetPx
  ) {
    return false;
  }

  const leftKeys = Object.keys(left.budgets);
  const rightKeys = Object.keys(right.budgets);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftBudget = left.budgets[key];
    const rightBudget = right.budgets[key];
    return Boolean(
      leftBudget && rightBudget && areSceneScrollAnimationBudgetsEqual(leftBudget, rightBudget)
    );
  });
}
