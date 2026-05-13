export interface ScrollZoneAnimationRegistration {
  animateId: string;
  delay: number;
  enterDuration: number;
  exitDuration: number;
  waitFor?: string;
}

export interface ScrollZoneAnimationBudget {
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
  hasExit: boolean;
}

export interface ResolvedScrollSequence {
  budgets: Record<string, ScrollZoneAnimationBudget>;
  totalDurationMs: number;
  totalBudgetPx: number;
}

const DEFAULT_SCROLL_PX_PER_MS = 0.18;

function clampToNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function resolveTiming(
  animateId: string,
  registrations: Map<string, ScrollZoneAnimationRegistration>,
  cache: Map<
    string,
    Omit<
      ScrollZoneAnimationBudget,
      'startPx' | 'enterStartPx' | 'enterEndPx' | 'exitStartPx' | 'exitEndPx' | 'totalEndPx'
    >
  >,
  chain: Set<string>
): Omit<
  ScrollZoneAnimationBudget,
  'startPx' | 'enterStartPx' | 'enterEndPx' | 'exitStartPx' | 'exitEndPx' | 'totalEndPx'
> {
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

export function resolveScrollZoneAnimationBudgets(
  registrations: Map<string, ScrollZoneAnimationRegistration>,
  budget: 'auto' | number
): ResolvedScrollSequence {
  const cache = new Map<
    string,
    Omit<
      ScrollZoneAnimationBudget,
      'startPx' | 'enterStartPx' | 'enterEndPx' | 'exitStartPx' | 'exitEndPx' | 'totalEndPx'
    >
  >();

  registrations.forEach((_, animateId) => {
    resolveTiming(animateId, registrations, cache, new Set<string>());
  });

  let totalDurationMs = 0;
  cache.forEach((resolvedBudget) => {
    totalDurationMs = Math.max(totalDurationMs, resolvedBudget.totalEndMs);
  });

  const totalBudgetPx =
    typeof budget === 'number'
      ? Math.max(budget, 1)
      : Math.max(totalDurationMs * DEFAULT_SCROLL_PX_PER_MS, 1);
  const pxPerMs = totalDurationMs > 0 ? totalBudgetPx / totalDurationMs : DEFAULT_SCROLL_PX_PER_MS;

  const budgets: Record<string, ScrollZoneAnimationBudget> = {};
  cache.forEach((resolvedBudget, animateId) => {
    budgets[animateId] = {
      ...resolvedBudget,
      startPx: resolvedBudget.startMs * pxPerMs,
      enterStartPx: resolvedBudget.enterStartMs * pxPerMs,
      enterEndPx: resolvedBudget.enterEndMs * pxPerMs,
      exitStartPx:
        resolvedBudget.exitStartMs === null ? null : resolvedBudget.exitStartMs * pxPerMs,
      exitEndPx: resolvedBudget.exitEndMs === null ? null : resolvedBudget.exitEndMs * pxPerMs,
      totalEndPx: resolvedBudget.totalEndMs * pxPerMs,
    };
  });

  return {
    budgets,
    totalDurationMs,
    totalBudgetPx,
  };
}
