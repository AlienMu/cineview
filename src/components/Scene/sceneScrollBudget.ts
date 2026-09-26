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
  /** Phase declarations ignored because their dependency timing has no finite solution. */
  invalidPhaseIds?: string[];
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
      predecessorEnd = phaseChainEndEstimates.get(registration.after) ?? predecessor.enterEndMs;
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

interface DurationTerm {
  fraction: number;
  offset: number;
  phaseId?: string;
}

// An effective enter end is max(fraction * totalDuration + offset). Every after
// edge adds its delay/duration. Solve total >= each term directly instead of
// repeatedly expanding the zone until an iteration limit happens to be reached.
function resolvePhaseTimings(
  registrations: Map<string, SceneScrollAnimationRegistration>,
  circularFollowers: Set<string>
): { enterEnds: Map<string, number>; totalDurationMs: number; invalidPhaseIds: Set<string> } {
  const invalidPhaseIds = new Set<string>();
  registrations.forEach((registration, id) => {
    if (
      [registration.phase?.start, registration.phase?.end].some(
        (value) => value !== undefined && !Number.isFinite(value)
      )
    )
      invalidPhaseIds.add(id);
  });

  const shift = (terms: DurationTerm[], offset: number): DurationTerm[] =>
    terms.map((term) => ({ ...term, offset: term.offset + offset }));
  const maximum = (...groups: DurationTerm[][]): DurationTerm[] => {
    const terms = new Map<number, DurationTerm>();
    groups.flat().forEach((term) => {
      if (!terms.has(term.fraction) || terms.get(term.fraction)!.offset < term.offset) {
        terms.set(term.fraction, term);
      }
    });
    return [...terms.values()];
  };

  // Each unsuccessful pass removes at least one invalid phase declaration.
  // Ordinary after relationships remain intact and use the authored durations.
  for (;;) {
    const completions = new Map<string, DurationTerm[]>();
    const extents: DurationTerm[] = [];
    const resolve = (id: string): DurationTerm[] => {
      const cached = completions.get(id);
      if (cached) return cached;
      const registration = registrations.get(id);
      if (!registration) return [{ fraction: 0, offset: 0 }];
      const follows = Boolean(registration.after) && !circularFollowers.has(id);
      const predecessor = follows ? resolve(registration.after!) : [{ fraction: 0, offset: 0 }];
      const start = shift(predecessor, clampToNonNegative(registration.delay));
      const enterEnd = shift(start, Math.max(clampToNonNegative(registration.enterDuration), 1));
      extents.push(...shift(enterEnd, clampToNonNegative(registration.exitDuration)));
      const phase = invalidPhaseIds.has(id) ? undefined : registration.phase;
      let completion = enterEnd;
      if (phase?.start !== undefined || phase?.end !== undefined) {
        const phaseStart =
          phase.start === undefined
            ? start
            : maximum(
                [{ fraction: clamp(phase.start, 0, 1), offset: 0, phaseId: id }],
                follows ? start : []
              );
        completion = maximum(
          phase.end === undefined
            ? enterEnd
            : [{ fraction: clamp(phase.end, 0, 1), offset: 0, phaseId: id }],
          shift(phaseStart, 1)
        );
        // Every authored entrance must be reachable, including leaf nodes.
        // A phased exit also needs at least one pixel after entrance completion.
        extents.push(...shift(completion, registration.exitDuration > 0 ? 1 : 0));
      }
      completions.set(id, completion);
      return completion;
    };
    registrations.forEach((_, id) => resolve(id));

    let total = 0;
    const previousInvalidCount = invalidPhaseIds.size;
    extents.forEach((term) => {
      const required =
        term.fraction < 1 ? term.offset / (1 - term.fraction) : term.offset === 0 ? 0 : Infinity;
      if (!Number.isFinite(required) && term.phaseId) {
        invalidPhaseIds.add(term.phaseId);
      } else {
        total = Math.max(total, required);
      }
    });
    if (invalidPhaseIds.size !== previousInvalidCount) continue;
    const enterEnds = new Map<string, number>();
    completions.forEach((terms, id) => {
      enterEnds.set(
        id,
        terms.reduce((end, term) => Math.max(end, term.fraction * total + term.offset), 0)
      );
    });
    return { enterEnds, totalDurationMs: total, invalidPhaseIds };
  }
}

export function resolveSceneScrollAnimationBudgets(
  registrations: Map<string, SceneScrollAnimationRegistration>
): ResolvedSceneScrollSequence {
  const cache = new Map<string, SceneScrollAnimationTiming>();
  const circularFollowers = new Set<string>();
  let phaseChainEndEstimates = new Map<string, number>();
  let effectiveRegistrations = registrations;
  const hasPhaseAuthored = [...registrations.values()].some(
    (registration) =>
      registration.phase?.start !== undefined || registration.phase?.end !== undefined
  );
  const resolveAll = (): void => {
    effectiveRegistrations.forEach((_, animateId) => {
      resolveTiming(
        animateId,
        effectiveRegistrations,
        cache,
        new Set<string>(),
        circularFollowers,
        phaseChainEndEstimates
      );
    });
  };

  resolveAll();
  let invalidPhaseIds: Set<string> | undefined;
  let totalDurationMs = 0;
  if (hasPhaseAuthored) {
    const phaseTiming = resolvePhaseTimings(registrations, circularFollowers);
    totalDurationMs = phaseTiming.totalDurationMs;
    phaseChainEndEstimates = phaseTiming.enterEnds;
    invalidPhaseIds = phaseTiming.invalidPhaseIds;
    if (invalidPhaseIds.size > 0) {
      effectiveRegistrations = new Map(registrations);
      invalidPhaseIds.forEach((id) => {
        effectiveRegistrations.set(id, { ...registrations.get(id)!, phase: undefined });
      });
    }
    cache.clear();
    circularFollowers.clear();
    resolveAll();
  }

  cache.forEach((resolvedBudget) => {
    totalDurationMs = Math.max(totalDurationMs, resolvedBudget.totalEndMs);
  });

  const totalBudgetPx = totalDurationMs > 0 ? Math.max(totalDurationMs * SCROLL_PX_PER_MS, 1) : 0;
  const pxPerMs = SCROLL_PX_PER_MS;

  const budgets: Record<string, SceneScrollAnimationBudget> = {};
  cache.forEach((resolvedBudget, animateId) => {
    const registration = effectiveRegistrations.get(animateId);
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
    const phaseStartPx = Math.max(
      resolvePhaseBoundaryPx(
        registration?.phase?.start,
        fallbackStartPx,
        phaseWindowStartPx,
        phaseWindowEndPx
      ),
      registration?.after && !circularFollowers.has(animateId) ? fallbackStartPx : 0
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
    ...(invalidPhaseIds?.size ? { invalidPhaseIds: [...invalidPhaseIds] } : {}),
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
    left.totalBudgetPx !== right.totalBudgetPx ||
    (left.invalidPhaseIds ?? []).join('\0') !== (right.invalidPhaseIds ?? []).join('\0')
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
