export interface SceneScrollAnimationRegistration {
  animateId: string;
  delay: number;
  enterDuration: number;
  exitDuration: number;
  waitFor?: string;
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
  chain: Set<string>
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

  const predecessorEnd = registration.waitFor
    ? resolveTiming(registration.waitFor, registrations, cache, chain).totalEndMs
    : 0;
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

export function resolveSceneScrollAnimationBudgets(
  registrations: Map<string, SceneScrollAnimationRegistration>
): ResolvedSceneScrollSequence {
  const cache = new Map<string, SceneScrollAnimationTiming>();

  registrations.forEach((_, animateId) => {
    resolveTiming(animateId, registrations, cache, new Set<string>());
  });

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
      leftBudget &&
        rightBudget &&
        areSceneScrollAnimationBudgetsEqual(leftBudget, rightBudget)
    );
  });
}
