import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildAnimationRegistrySnapshot,
  freezeAnimationRegistrySnapshot,
  isLaneCompatible,
  type AnimateRegistrationInfo,
  type AnimateTimelineLane,
  type AnimationRegistryIssue,
  type AnimationRegistrySnapshot,
  type FrozenAnimationRegistrySnapshot,
} from '../../animations/registry';
import type { ParsedAnimationVariant } from '../../types';
import type { CineViewRuntimeContextValue } from '../runtime/runtimeContext';
import { devWarn } from '../../utils/devLog';

interface UseSceneAnimationRegistryParams {
  sceneIndex: number;
  baseDuration: number;
  reportError?: CineViewRuntimeContextValue['reportError'];
  onStableSnapshot?: (
    snapshot: FrozenAnimationRegistrySnapshot,
    revision: number,
    enterVariantsByAnimateId: ReadonlyMap<string, ParsedAnimationVariant>
  ) => void;
}

export interface ScenePreparationLease {
  /** Publish synchronously when this generation parsed and registered successfully. */
  complete: () => void;
  /** Release a superseded/unmounted generation without publishing a transient snapshot. */
  cancel: () => void;
}

export type AfterInvalidReason =
  'missing' | 'cycle' | 'duplicate' | 'leader-unregistered' | 'incompatible-lane';

export type AfterOutcome =
  | { kind: 'pending'; leaderId: string; generation?: number }
  | {
      kind: 'satisfied';
      source: 'none' | 'completed';
      leaderId?: string;
      generation?: number;
    }
  | { kind: 'invalid'; leaderId: string; reason: AfterInvalidReason };

export interface SceneAnimationRegistrationLease {
  readonly animateId: string;
  readonly generation: number;
  getCalculatedDelay: () => number;
  setEnterVariant?: (variant: ParsedAnimationVariant) => void;
  observeAfter: (listener: (outcome: AfterOutcome) => void) => () => void;
  publishEnterCompleted: () => void;
  dispose: () => void;
}

export interface SceneAnimationLaneDeclarationLease {
  dispose: () => void;
}

export interface SceneAnimationRegistryPort {
  timelineDuration: number;
  isStable: boolean;
  beginPreparation: () => ScenePreparationLease;
  registerAnimate: (id: string, info: AnimateRegistrationInfo) => SceneAnimationRegistrationLease;
  /** Declare a non-scene lane for dependency diagnostics without extending T_self. */
  declareAnimateLane: (id: string, lane: AnimateTimelineLane) => SceneAnimationLaneDeclarationLease;
  /** Legacy registration adapter for callers not yet migrated to lease.dispose(). */
  unregisterAnimate: (id: string) => void;
  getCalculatedDelay: (animateId: string) => number;
  getTimelineDuration: () => number;
}

interface RegistrationRecord {
  token: symbol;
  id: string;
  generation: number;
  info: AnimateRegistrationInfo;
  enterVariant: ParsedAnimationVariant | null;
  enterCompleted: boolean;
  disposed: boolean;
}

interface LaneDeclarationRecord {
  token: symbol;
  id: string;
  lane: AnimateTimelineLane;
  disposed: boolean;
}

interface AfterSubscription {
  follower: RegistrationRecord;
  listener: (outcome: AfterOutcome) => void;
  leaderId: string;
  sawLeader: boolean;
  lastSignature: string | null;
  terminal: boolean;
}

function getIssueKey(issue: AnimationRegistryIssue): string {
  switch (issue.type) {
    case 'missing-dependency':
      return `${issue.type}:${issue.animateId}:${issue.after}`;
    case 'circular-dependency':
      return `${issue.type}:${issue.animateId}:${issue.cycle.join('>')}`;
    case 'duplicate-id':
      return `${issue.type}:${issue.animateId}`;
    case 'incompatible-lane':
      return `${issue.type}:${issue.animateId}:${issue.after}:${issue.followerLane}:${issue.leaderLane}`;
  }
}

function outcomeSignature(outcome: AfterOutcome): string {
  if (outcome.kind === 'invalid') {
    return `${outcome.kind}:${outcome.leaderId}:${outcome.reason}`;
  }
  return `${outcome.kind}:${outcome.leaderId ?? ''}:${outcome.generation ?? ''}:${outcome.kind === 'satisfied' ? outcome.source : ''}`;
}

function getLatestRecord(records: Map<symbol, RegistrationRecord>): RegistrationRecord | undefined {
  let latest: RegistrationRecord | undefined;
  records.forEach((record) => {
    latest = record;
  });
  return latest;
}

function mapsEqual<K, V>(
  left: ReadonlyMap<K, V>,
  right: ReadonlyMap<K, V>,
  valuesEqual: (leftValue: V, rightValue: V) => boolean = Object.is
): boolean {
  if (left.size !== right.size) return false;
  for (const [key, leftValue] of left) {
    const rightValue = right.get(key);
    if (rightValue === undefined || !valuesEqual(leftValue, rightValue)) return false;
  }
  return true;
}

function registrySnapshotsEqual(
  left: AnimationRegistrySnapshot,
  right: AnimationRegistrySnapshot
): boolean {
  return (
    left.timelineDuration === right.timelineDuration &&
    mapsEqual(left.registrations, right.registrations, (leftInfo, rightInfo) =>
      Boolean(
        leftInfo.delay === rightInfo.delay &&
        leftInfo.duration === rightInfo.duration &&
        leftInfo.after === rightInfo.after &&
        leftInfo.lane === rightInfo.lane
      )
    ) &&
    mapsEqual(left.calculatedDelays, right.calculatedDelays) &&
    left.issues.length === right.issues.length &&
    left.issues.every((issue, index) => getIssueKey(issue) === getIssueKey(right.issues[index]))
  );
}

/**
 * Expands registry issue objects into developer-readable Problem/Fallback/Fix messages.
 * Used only inside dev guards, so production builds eliminate this entirely.
 */
function buildIssueDevWarning(issue: AnimationRegistryIssue, sceneIndex: number): string {
  if (issue.type === 'missing-dependency') {
    return (
      `Animation dependency error in Scene ${sceneIndex}.\n\n` +
      `Problem: Animate component "${issue.animateId}" references non-existent component "${issue.after}" via after.\n` +
      `Fallback: The invalid dependency is ignored so the animation can continue.\n` +
      `Fix: Ensure the after component ID matches an existing Animate component's animateId prop.\n`
    );
  }
  if (issue.type === 'circular-dependency') {
    return (
      `Animation dependency cycle in Scene ${sceneIndex}.\n\n` +
      `Problem: Animate after chain contains a cycle: ${issue.cycle.join(' -> ')}.\n` +
      `Fallback: The invalid dependency is ignored so the animations can continue.\n` +
      `Fix: Remove the circular after reference so each Animate starts after an earlier independent animation.\n`
    );
  }
  if (issue.type === 'duplicate-id') {
    return (
      `Duplicate Animate id in Scene ${sceneIndex}.\n\n` +
      `Problem: More than one Animate component registered animateId "${issue.animateId}".\n` +
      `Fallback: Dependents ignore the ambiguous dependency and continue.\n` +
      `Fix: Give each Animate component in a Scene a unique animateId.\n`
    );
  }
  return (
    `Incompatible animation dependency in Scene ${sceneIndex}.\n\n` +
    `Problem: ${issue.followerLane} Animate "${issue.animateId}" cannot follow ` +
    `${issue.leaderLane} Animate "${issue.after}".\n` +
    `Fallback: The incompatible dependency is ignored so the animation can continue.\n` +
    `Fix: Keep both animations on one compatible lane or remove the after edge.\n`
  );
}

export function useSceneAnimationRegistry({
  sceneIndex,
  baseDuration,
  reportError,
  onStableSnapshot,
}: UseSceneAnimationRegistryParams): SceneAnimationRegistryPort {
  const ownersByIdRef = useRef<Map<string, Map<symbol, RegistrationRecord>>>(new Map());
  const laneDeclarationsByIdRef = useRef<Map<string, Map<symbol, LaneDeclarationRecord>>>(
    new Map()
  );
  const registrationsRef = useRef<Map<string, AnimateRegistrationInfo>>(new Map());
  const declaredLanesRef = useRef<Map<string, AnimateTimelineLane>>(new Map());
  const duplicateIdsRef = useRef<Set<string>>(new Set());
  const snapshotRef = useRef<AnimationRegistrySnapshot>(
    buildAnimationRegistrySnapshot({
      baseDuration,
      registrations: registrationsRef.current,
    })
  );
  const reportedIssuesRef = useRef<Set<string>>(new Set());
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionsByLeaderRef = useRef<Map<string, Set<AfterSubscription>>>(new Map());
  const generationRef = useRef(0);
  const preparationCountRef = useRef(0);
  const stableRevisionRef = useRef(0);
  const lastPublishedSnapshotRef = useRef<AnimationRegistrySnapshot | null>(null);
  const lastPublishedVariantsRef = useRef<ReadonlyMap<string, ParsedAnimationVariant> | null>(null);
  const mountedRef = useRef(true);
  const reportErrorRef = useRef(reportError);
  reportErrorRef.current = reportError;
  const onStableSnapshotRef = useRef(onStableSnapshot);
  onStableSnapshotRef.current = onStableSnapshot;
  const timelineDurationRef = useRef(baseDuration);
  const [timelineDuration, setTimelineDuration] = useState(baseDuration);
  const [isStable, setIsStable] = useState(false);

  const markUnstable = useCallback((): void => {
    if (mountedRef.current) setIsStable(false);
  }, []);

  const reportIssues = useCallback(
    (issues: AnimationRegistryIssue[]): void => {
      issues.forEach((issue) => {
        const key = getIssueKey(issue);
        if (reportedIssuesRef.current.has(key)) return;
        reportedIssuesRef.current.add(key);

        let code: string;
        let message: string;

        if (issue.type === 'missing-dependency') {
          code = 'INVALID_ANIMATION';
          message = `Animate "${issue.animateId}" references non-existent component "${issue.after}" via after in Scene ${sceneIndex}.`;
        } else if (issue.type === 'circular-dependency') {
          code = 'CIRCULAR_DEPENDENCY';
          message = `Animate after chain contains a cycle in Scene ${sceneIndex}: ${issue.cycle.join(' -> ')}.`;
        } else if (issue.type === 'duplicate-id') {
          code = 'INVALID_COMPONENT_HIERARCHY';
          message = `More than one Animate component registered animateId "${issue.animateId}" in Scene ${sceneIndex}.`;
        } else {
          code = 'INVALID_ANIMATION';
          message =
            `Animate "${issue.animateId}" uses ${issue.followerLane} after "${issue.after}" ` +
            `driven by ${issue.leaderLane} in Scene ${sceneIndex}; this dependency direction is incompatible.`;
        }

        reportErrorRef.current?.({ code, message, context: { sceneIndex } });

        // Diagnostic message is constructed only inside the dev branch: after esbuild
        // folds NODE_ENV to 'production', the entire block is eliminated and the
        // Problem/Fallback/Fix template (1191 bytes raw) is dropped from the bundle.
        // Passing a thunk was tried but failed: assigning the thunk to a variable then
        // passing it cross-module to devWarn prevents esbuild from proving it's unused,
        // keeping the entire closure with its literals alive (measured +8 bytes).
        if (process.env.NODE_ENV === 'development') {
          devWarn(buildIssueDevWarning(issue, sceneIndex));
        }
      });
    },
    [sceneIndex]
  );

  const syncSelectedRegistrations = useCallback((): void => {
    registrationsRef.current.clear();
    declaredLanesRef.current.clear();
    duplicateIdsRef.current.clear();

    ownersByIdRef.current.forEach((owners, id) => {
      const latest = getLatestRecord(owners);
      if (latest) registrationsRef.current.set(id, latest.info);
      if (owners.size > 1) duplicateIdsRef.current.add(id);
    });

    laneDeclarationsByIdRef.current.forEach((declarations, id) => {
      let latest: LaneDeclarationRecord | undefined;
      declarations.forEach((declaration) => {
        if (!declaration.disposed) latest = declaration;
      });
      if (latest) declaredLanesRef.current.set(id, latest.lane);
    });
  }, []);

  const rebuildSnapshot = useCallback((): AnimationRegistrySnapshot => {
    syncSelectedRegistrations();
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration,
      registrations: registrationsRef.current,
      declaredLanes: declaredLanesRef.current,
      duplicateIds: duplicateIdsRef.current,
    });
    snapshotRef.current = snapshot;
    timelineDurationRef.current = snapshot.timelineDuration;
    if (mountedRef.current) {
      setTimelineDuration((previous) =>
        previous === snapshot.timelineDuration ? previous : snapshot.timelineDuration
      );
    }
    return snapshot;
  }, [baseDuration, syncSelectedRegistrations]);

  const hasCycleForFollower = useCallback((followerId: string): boolean => {
    return snapshotRef.current.issues.some(
      (issue) => issue.type === 'circular-dependency' && issue.cycle.includes(followerId)
    );
  }, []);

  const evaluateSubscription = useCallback(
    (subscription: AfterSubscription, stable: boolean): AfterOutcome => {
      const { follower, leaderId } = subscription;
      const leaderOwners = ownersByIdRef.current.get(leaderId);
      const declaredLeaderLane = declaredLanesRef.current.get(leaderId);

      if (!leaderOwners || leaderOwners.size === 0) {
        if (
          stable &&
          declaredLeaderLane !== undefined &&
          follower.info.lane !== undefined &&
          !isLaneCompatible(follower.info.lane, declaredLeaderLane)
        ) {
          subscription.sawLeader = true;
          return { kind: 'invalid', leaderId, reason: 'incompatible-lane' };
        }
        return stable
          ? {
              kind: 'invalid',
              leaderId,
              reason: subscription.sawLeader ? 'leader-unregistered' : 'missing',
            }
          : { kind: 'pending', leaderId };
      }

      subscription.sawLeader = true;
      const leader = getLatestRecord(leaderOwners)!;

      if (stable && hasCycleForFollower(follower.id)) {
        return { kind: 'invalid', leaderId, reason: 'cycle' };
      }
      if (stable && leaderOwners.size > 1) {
        return { kind: 'invalid', leaderId, reason: 'duplicate' };
      }
      if (
        stable &&
        follower.info.lane !== undefined &&
        leader.info.lane !== undefined &&
        !isLaneCompatible(follower.info.lane, leader.info.lane)
      ) {
        return { kind: 'invalid', leaderId, reason: 'incompatible-lane' };
      }
      if (leader.enterCompleted) {
        return {
          kind: 'satisfied',
          source: 'completed',
          leaderId,
          generation: leader.generation,
        };
      }
      return { kind: 'pending', leaderId, generation: leader.generation };
    },
    [hasCycleForFollower]
  );

  const emitOutcome = useCallback(
    (subscription: AfterSubscription, outcome: AfterOutcome): void => {
      if (subscription.terminal) return;
      const signature = outcomeSignature(outcome);
      if (subscription.lastSignature === signature) return;
      subscription.lastSignature = signature;
      subscription.listener(outcome);
      if (outcome.kind !== 'pending') subscription.terminal = true;
    },
    []
  );

  const reconcileSubscriptions = useCallback(
    (stable: boolean): void => {
      subscriptionsByLeaderRef.current.forEach((subscriptions) => {
        [...subscriptions].forEach((subscription) => {
          if (subscription.follower.disposed || subscription.terminal) {
            subscriptions.delete(subscription);
            return;
          }
          emitOutcome(subscription, evaluateSubscription(subscription, stable));
          if (subscription.terminal) subscriptions.delete(subscription);
        });
      });
      subscriptionsByLeaderRef.current.forEach((subscriptions, leaderId) => {
        if (subscriptions.size === 0) subscriptionsByLeaderRef.current.delete(leaderId);
      });
    },
    [emitOutcome, evaluateSubscription]
  );

  const publishStableSnapshot = useCallback((snapshot: AnimationRegistrySnapshot): void => {
    if (preparationCountRef.current !== 0 || !mountedRef.current) return;

    const enterVariantsByAnimateId = new Map<string, ParsedAnimationVariant>();
    ownersByIdRef.current.forEach((owners, animateId) => {
      const current = getLatestRecord(owners);
      if (current?.enterVariant) {
        enterVariantsByAnimateId.set(animateId, current.enterVariant);
      }
    });

    const previousSnapshot = lastPublishedSnapshotRef.current;
    const previousVariants = lastPublishedVariantsRef.current;
    const unchanged =
      previousSnapshot !== null &&
      previousVariants !== null &&
      registrySnapshotsEqual(previousSnapshot, snapshot) &&
      mapsEqual(previousVariants, enterVariantsByAnimateId);

    setIsStable(true);
    if (unchanged) return;

    stableRevisionRef.current += 1;
    lastPublishedSnapshotRef.current = snapshot;
    lastPublishedVariantsRef.current = new Map(enterVariantsByAnimateId);
    onStableSnapshotRef.current?.(
      freezeAnimationRegistrySnapshot(snapshot),
      stableRevisionRef.current,
      enterVariantsByAnimateId
    );
  }, []);

  const flushStableValidation = useCallback((): void => {
    if (preparationCountRef.current !== 0 || !mountedRef.current) return;
    if (validationTimerRef.current !== null) {
      clearTimeout(validationTimerRef.current);
      validationTimerRef.current = null;
    }

    const snapshot = rebuildSnapshot();
    reportIssues(snapshot.issues);
    reconcileSubscriptions(true);
    publishStableSnapshot(snapshot);
  }, [publishStableSnapshot, rebuildSnapshot, reconcileSubscriptions, reportIssues]);

  const scheduleValidation = useCallback((): void => {
    markUnstable();
    if (validationTimerRef.current !== null) clearTimeout(validationTimerRef.current);
    validationTimerRef.current = setTimeout(() => {
      validationTimerRef.current = null;
      flushStableValidation();
    }, 0);
  }, [flushStableValidation, markUnstable]);

  const beginPreparation = useCallback((): ScenePreparationLease => {
    preparationCountRef.current += 1;
    markUnstable();
    let released = false;

    const release = (): boolean => {
      if (released) return false;
      released = true;
      preparationCountRef.current = Math.max(0, preparationCountRef.current - 1);
      return preparationCountRef.current === 0;
    };

    return {
      complete: (): void => {
        if (!release()) return;
        // All CURRENT parsed Animate generations in this Scene have registered
        // their variants. Publish synchronously before the next pointer event can
        // acquire drag ownership; a timer-only publish leaves a one-task window
        // where release has no transaction to consume.
        flushStableValidation();
      },
      cancel: (): void => {
        if (!release()) return;
        // StrictMode tears down the first effect generation before immediately
        // starting its replacement. Publishing synchronously here would expose a
        // transient empty T=0 snapshot, consume scene 0's cold-start one-shot, and
        // leave the real generation at its terminal frame. Defer reconciliation:
        // a replacement preparation blocks the timer, while a genuine unmount is
        // still validated after all registration cleanup in this task completes.
        scheduleValidation();
      },
    };
  }, [flushStableValidation, markUnstable, scheduleValidation]);

  const removeFollowerSubscriptions = useCallback((record: RegistrationRecord): void => {
    subscriptionsByLeaderRef.current.forEach((subscriptions, leaderId) => {
      subscriptions.forEach((subscription) => {
        if (subscription.follower.token === record.token) subscriptions.delete(subscription);
      });
      if (subscriptions.size === 0) subscriptionsByLeaderRef.current.delete(leaderId);
    });
  }, []);

  const disposeRecord = useCallback(
    (record: RegistrationRecord): void => {
      if (record.disposed) return;
      record.disposed = true;
      removeFollowerSubscriptions(record);
      const owners = ownersByIdRef.current.get(record.id);
      owners?.delete(record.token);
      if (owners?.size === 0) ownersByIdRef.current.delete(record.id);
      rebuildSnapshot();
      scheduleValidation();
    },
    [rebuildSnapshot, removeFollowerSubscriptions, scheduleValidation]
  );

  const registerAnimate = useCallback(
    (id: string, info: AnimateRegistrationInfo): SceneAnimationRegistrationLease => {
      const record: RegistrationRecord = {
        token: Symbol(id),
        id,
        generation: ++generationRef.current,
        info,
        enterVariant: null,
        enterCompleted: false,
        disposed: false,
      };
      let owners = ownersByIdRef.current.get(id);
      if (!owners) {
        owners = new Map();
        ownersByIdRef.current.set(id, owners);
      }
      owners.set(record.token, record);
      rebuildSnapshot();
      scheduleValidation();

      if (
        process.env.NODE_ENV === 'development' &&
        typeof window !== 'undefined' &&
        (window as Window & { __CINEVIEW_DRAG_DEBUG__?: boolean }).__CINEVIEW_DRAG_DEBUG__
      ) {
        const calculatedDelay = snapshotRef.current.calculatedDelays.get(id) ?? info.delay;
        console.log(
          `[Scene ${sceneIndex}] Registered ${id}: delay=${info.delay}ms, calculated=${calculatedDelay}ms, duration=${info.duration}ms`
        );
        console.log(`[Scene ${sceneIndex}] Timeline duration: ${timelineDurationRef.current}ms`);
      }

      if (registrationsRef.current.size > 100) {
        devWarn(
          `Scene ${sceneIndex} has ${registrationsRef.current.size} Animate components.\n\n` +
            `Recommendation: Consider reducing the number of animated elements or splitting into multiple scenes.`
        );
      }

      return {
        animateId: id,
        generation: record.generation,
        getCalculatedDelay: (): number =>
          snapshotRef.current.calculatedDelays.get(id) ?? record.info.delay,
        setEnterVariant: (variant): void => {
          if (record.disposed) return;
          const currentOwners = ownersByIdRef.current.get(id);
          if (!currentOwners?.has(record.token)) return;
          record.enterVariant = variant;
          scheduleValidation();
        },
        observeAfter: (listener): (() => void) => {
          if (!record.info.after) {
            listener({ kind: 'satisfied', source: 'none' });
            return () => undefined;
          }
          const subscription: AfterSubscription = {
            follower: record,
            listener,
            leaderId: record.info.after,
            sawLeader: false,
            lastSignature: null,
            terminal: false,
          };
          let subscriptions = subscriptionsByLeaderRef.current.get(subscription.leaderId);
          if (!subscriptions) {
            subscriptions = new Set();
            subscriptionsByLeaderRef.current.set(subscription.leaderId, subscriptions);
          }
          subscriptions.add(subscription);
          // Registration changes reconcile at the end of the current task so a
          // follower mounted before its leader does not observe a phantom missing
          // edge. Once that stable pass has completed, a late gate observer must
          // consume the current terminal result immediately; otherwise a missing or
          // cyclic dependency can remain pending forever with no future mutation to
          // trigger another reconcile.
          const registryIsStable =
            preparationCountRef.current === 0 && validationTimerRef.current === null;
          emitOutcome(subscription, evaluateSubscription(subscription, registryIsStable));
          return () => {
            subscription.terminal = true;
            subscriptions?.delete(subscription);
            if (subscriptions?.size === 0) {
              subscriptionsByLeaderRef.current.delete(subscription.leaderId);
            }
          };
        },
        publishEnterCompleted: (): void => {
          if (record.disposed || record.enterCompleted) return;
          const currentOwners = ownersByIdRef.current.get(id);
          if (!currentOwners?.has(record.token)) return;
          record.enterCompleted = true;
          reconcileSubscriptions(false);
        },
        dispose: (): void => disposeRecord(record),
      };
    },
    [
      disposeRecord,
      emitOutcome,
      evaluateSubscription,
      rebuildSnapshot,
      reconcileSubscriptions,
      sceneIndex,
      scheduleValidation,
    ]
  );

  const declareAnimateLane = useCallback(
    (id: string, lane: AnimateTimelineLane): SceneAnimationLaneDeclarationLease => {
      const record: LaneDeclarationRecord = {
        token: Symbol(id),
        id,
        lane,
        disposed: false,
      };
      let declarations = laneDeclarationsByIdRef.current.get(id);
      if (!declarations) {
        declarations = new Map();
        laneDeclarationsByIdRef.current.set(id, declarations);
      }
      declarations.set(record.token, record);
      rebuildSnapshot();
      scheduleValidation();

      return {
        dispose: (): void => {
          if (record.disposed) return;
          record.disposed = true;
          const current = laneDeclarationsByIdRef.current.get(id);
          current?.delete(record.token);
          if (current?.size === 0) laneDeclarationsByIdRef.current.delete(id);
          rebuildSnapshot();
          scheduleValidation();
        },
      };
    },
    [rebuildSnapshot, scheduleValidation]
  );

  const unregisterAnimate = useCallback(
    (id: string): void => {
      const owners = ownersByIdRef.current.get(id);
      const latest = owners ? getLatestRecord(owners) : undefined;
      if (latest) disposeRecord(latest);
    },
    [disposeRecord]
  );

  const getCalculatedDelay = useCallback((animateId: string): number => {
    return (
      snapshotRef.current.calculatedDelays.get(animateId) ??
      registrationsRef.current.get(animateId)?.delay ??
      0
    );
  }, []);

  const getTimelineDuration = useCallback((): number => timelineDurationRef.current, []);

  useEffect(() => {
    scheduleValidation();
  }, [baseDuration, scheduleValidation]);

  useEffect(() => {
    mountedRef.current = true;
    const ownersById = ownersByIdRef.current;
    const laneDeclarationsById = laneDeclarationsByIdRef.current;
    const registrations = registrationsRef.current;
    const declaredLanes = declaredLanesRef.current;
    const duplicateIds = duplicateIdsRef.current;
    const reportedIssues = reportedIssuesRef.current;
    const subscriptionsByLeader = subscriptionsByLeaderRef.current;

    return (): void => {
      mountedRef.current = false;
      if (validationTimerRef.current !== null) {
        clearTimeout(validationTimerRef.current);
        validationTimerRef.current = null;
      }
      preparationCountRef.current = 0;
      ownersById.clear();
      laneDeclarationsById.clear();
      registrations.clear();
      declaredLanes.clear();
      duplicateIds.clear();
      reportedIssues.clear();
      subscriptionsByLeader.clear();
    };
  }, []);

  return {
    timelineDuration,
    isStable,
    beginPreparation,
    registerAnimate,
    declareAnimateLane,
    unregisterAnimate,
    getCalculatedDelay,
    getTimelineDuration,
  };
}
