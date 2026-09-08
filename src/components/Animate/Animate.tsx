/**
 * Animate Component - Unified entry point that selects implementation based on mode.
 * drag mode: uses useAnimateDrag
 * scroll mode: uses useAnimateScroll
 */

import React, {
  useEffect,
  useRef,
  useState,
  useContext,
  createContext,
  useMemo,
  isValidElement,
} from 'react';
import type { ReactElement } from 'react';
import { motion, MotionValue, useAnimation } from 'framer-motion';
import type { ParsedAnimationVariant, ScrollMode, ScrollTimelineState } from '../../types';
import type { AnimateRegistrationInfo } from '../../animations/registry';
import type {
  SceneAnimationLaneDeclarationLease,
  SceneAnimationRegistrationLease,
  ScenePreparationLease,
} from '../Scene/useSceneAnimationRegistry';
import type { DragSceneTransaction, PreparedSceneSnapshot } from '../Scene/dragPreparedState';
import { parseAnimationSafely, type AnimationParseFailure } from '../../utils/animationHelpers';
import { devWarn } from '../../utils/devLog';
import { useAnimateDrag } from './useAnimateDrag';
import { useAnimateScroll } from './useAnimateScroll';
import { useAnimateArrival } from './useAnimateArrival';
import {
  normalizeAnimateSemantics,
  type AnimateInternalProps,
  type ResolvedAnimateTimeline,
} from './animateSemantics';
import type { DragRelease, ScrollTransitionSnapshot } from '../../hooks/useSceneManager';
import { ScrollRenderBridge, DragRenderBridge } from './AnimateRenderBridge';
import {
  ScrollStagger,
  DragStagger,
  ArrivalStagger,
  countStaggerItems,
  resolveStaggerTiming,
} from './StaggerContainer';
import { IDLE_RENDER_STATE } from './animateRenderState';
import { AnimateTimelineProvider } from './animateTimeline';
import { useAnimatePublicTimeline } from './useAnimatePublicTimeline';
import type { AnimateRenderState } from '../../types';
import { useCineViewRuntimeContext } from '../runtime/runtimeContext';
import {
  SceneScrollRuntimeContext,
  SceneScrollTimelineContext,
  SceneScrollTakeoverContext,
} from '../Scene/sceneScrollRuntime';
import type { SceneScrollZoneRuntime } from '../Scene/sceneScrollRuntime';
import { useStructurallyStableValue } from '../../utils/useStructurallyStableValue';

export type SceneRuntimeState =
  'inactive' | 'entering' | 'active' | 'exiting' | 'covered' | 'parked';

// Scene Context
export interface SceneBaseRuntimeContext {
  mode: ScrollMode;
  isActive: boolean;
  isVisible?: boolean;
  visibilityProgress?: number;
  runtimeState?: SceneRuntimeState;
  isSceneAnimating?: boolean;
  transitionDirection?: 'forward' | 'backward' | null;
  sceneState: 'initial' | 'entering' | 'active' | 'exiting';
  sceneOffset: number;
  sceneTransitionDuration: number;
  /** Monotonic formal-arrival token for this Scene in drag mode. */
  activationToken?: number;
  activationKind?: 'ready' | 'static' | 'commit' | 'programmatic' | null;
  getTimelineDuration?: () => number;
  enterDuration: number;
}

export interface SceneDragRuntimeContext {
  isDragging: boolean;
  dragProgressMotion: MotionValue<number>;
  renderProgressMotion?: MotionValue<number>;
  /** CineView-owned immutable playback transaction for this target Scene. */
  dragTransaction?: DragSceneTransaction | null;
  /** Latest stable local compilation; used only for cold-start/standalone capture. */
  preparedSnapshot?: PreparedSceneSnapshot | null;
  dragTimelineProgress?: number;
  // The per-scene element track (elapsed ms of THIS scene's enter timeline),
  // owned and driven by the scene's own useElementTrack. This is the UNIFIED
  // enter source read by useAnimateDrag (incoming / active-settle / cold-start).
  sharedElapsedMotion?: MotionValue<number>;
  renderProgress?: number;
  // Read-only release directive (two-track model). useAnimateDrag reads only its
  // `mode` to decide whether the post-commit active scene is still entering.
  dragRelease?: DragRelease | null;
  sharedTimelineDurationMs?: number;
  // False only for the scroll stack's pre-publication empty snapshot. This keeps
  // an unknown gate distinct from the explicit static-fallback state.
  firstSceneEnterGateKnown?: boolean;
  // True only while the first mounted scene is playing its one-shot cold-start
  // enter animation, driven by the scene's own element track once first-screen
  // priority images are ready. Lets the active offset-0 scene resolve through the
  // enter lerp path instead of snapping straight to rest.
  firstSceneEnterActive?: boolean;
  // Cold-start START trigger for the first mounted scene, mirrored from the
  // global useFirstSceneEnter gate. Three-state for the scroll visibility path:
  // `true` = first scene, assets ready, may play its enter; `false` = first
  // scene, held at initial (pre-load / preventDefault); `undefined` = not the
  // first scene, never gated by cold start.
  firstSceneEnterReady?: boolean;
}

export interface SceneScrollRuntimeBridgeContext {
  scrollProgress?: number;
  isScrolling?: boolean;
  scrollDirection?: 'forward' | 'backward' | null;
  scrollTimelineState?: ScrollTimelineState | null;
  scrollActiveSceneIndex?: number;
  scrollTransitionSnapshot?: ScrollTransitionSnapshot | null;
}

export interface SceneAnimationRegistryContext {
  beginPreparation?: () => ScenePreparationLease;
  registerAnimate: (
    id: string,
    info: AnimateRegistrationInfo
  ) => SceneAnimationRegistrationLease | void;
  /** Declare a non-scene lane for dependency diagnostics without extending T_self. */
  declareAnimateLane?: (
    id: string,
    lane: 'drag' | 'scroll' | 'visibility'
  ) => SceneAnimationLaneDeclarationLease;
  /** Compatibility cleanup for contexts that do not return a lease. */
  unregisterAnimate: (id: string) => void;
  getCalculatedDelay: (id: string) => number;
}

export type SceneContextType = SceneBaseRuntimeContext &
  SceneDragRuntimeContext &
  SceneScrollRuntimeBridgeContext &
  SceneAnimationRegistryContext;

export const SceneContext = createContext<SceneContextType | null>(null);

/** Neutral outer style for stagger containers. Must be a module-level constant
 *  (stable reference), otherwise each render creates a new object causing framer to rebuild bindings. */
const STAGGER_NEUTRAL_STYLE = Object.freeze({ opacity: 1 });

let animateIdCounter = 0;

export const Animate = ({
  enterAnimation,
  exitAnimation,
  loopAnimation,
  animateId,
  duration,
  timeline,
  visibility,
  stagger,
  enterRef,
  exitRef,
  children,
}: AnimateInternalProps): React.ReactNode => {
  const componentId = useRef(animateId || `animate-${++animateIdCounter}`);
  const id = componentId.current;
  const sceneContext = useContext(SceneContext);

  const cineViewRuntime = useCineViewRuntimeContext();
  const reportRuntimeError = cineViewRuntime?.reportError;
  const prefersReducedMotion = cineViewRuntime?.prefersReducedMotion === true;
  const zoneRuntime = useContext(SceneScrollRuntimeContext);
  const inheritedZoneId = useContext(SceneScrollTakeoverContext);

  const [enterVariant, setEnterVariant] = useState<ParsedAnimationVariant | null>(null);
  const [exitVariant, setExitVariant] = useState<ParsedAnimationVariant | null>(null);
  const [infiniteVariant, setInfiniteVariant] = useState<ParsedAnimationVariant | null>(null);
  const [settledParseGeneration, setSettledParseGeneration] = useState(0);
  const parseGenerationRef = useRef(0);
  const settledParseInputsRef = useRef<{
    enterAnimation: typeof enterAnimation;
    exitAnimation: typeof exitAnimation;
    loopAnimation: typeof loopAnimation;
  } | null>(null);
  const arrivalDiagnosticKeysRef = useRef<Set<string>>(new Set());
  const preparationLeaseRef = useRef<{
    generation: number;
    lease: ScenePreparationLease;
  } | null>(null);
  const allCreatedLeasesRef = useRef<Set<ScenePreparationLease>>(new Set());
  const stableEnterAnimation = useStructurallyStableValue(enterAnimation);
  const stableExitAnimation = useStructurallyStableValue(exitAnimation);
  const stableLoopAnimation = useStructurallyStableValue(loopAnimation);
  const dragInfiniteControls = useAnimation();
  const scrollInfiniteControls = useAnimation();
  const normalizedSemantics = normalizeAnimateSemantics({ duration, timeline, visibility });
  const mode = sceneContext?.mode ?? cineViewRuntime?.mode ?? 'drag';

  const authoredDragArrival = mode === 'drag' && normalizedSemantics.timeline.driver === 'clock';
  // Driver selection is frozen for one formal Scene activation. Prop updates during
  // a pass are authoring for the next activation (or remount), never a live handoff.
  const driverSelectionRef = useRef<{ token: number; mode: ScrollMode; arrival: boolean } | null>(
    null
  );
  const activationSelectionToken =
    mode === 'drag' && sceneContext?.isActive ? (sceneContext.activationToken ?? 0) : 0;
  if (
    driverSelectionRef.current === null ||
    driverSelectionRef.current.mode !== mode ||
    driverSelectionRef.current.token !== activationSelectionToken ||
    (activationSelectionToken === 0 && driverSelectionRef.current.arrival !== authoredDragArrival)
  ) {
    driverSelectionRef.current = {
      token: activationSelectionToken,
      mode,
      arrival: authoredDragArrival,
    };
  }
  const isDragArrival = mode === 'drag' && driverSelectionRef.current.arrival;
  const beginPreparation = sceneContext?.beginPreparation;
  const declareAnimateLane = sceneContext?.declareAnimateLane;
  // Resolve driver + mode + inherited zoneId down to a concrete lane.
  // scroll lane only when: scroll mode, scene driver (default), and actually
  // inside a Scene.scroll zone. Everything else (drag mode, no zone, or explicit
  // driver:'clock') is the standalone visibility gate.
  const resolvedTimeline = useMemo<ResolvedAnimateTimeline>(() => {
    const { driver, ...rest } = normalizedSemantics.timeline;
    const isSceneScroll = mode === 'scroll' && driver === 'scene' && Boolean(inheritedZoneId);
    return { ...rest, lane: isSceneScroll ? 'scroll' : 'visibility' };
  }, [inheritedZoneId, mode, normalizedSemantics.timeline]);
  const normalizedEnterDuration = normalizedSemantics.duration.enter;
  const normalizedExitDuration = normalizedSemantics.duration.exit;
  const normalizedDelay = resolvedTimeline.delay;
  const normalizedAfter = resolvedTimeline.after;
  const resolvedZoneId = resolvedTimeline.zoneId ?? inheritedZoneId;
  // The keyed store is intentionally kept outside React's render path. A
  // scroll frame updates the zone's progress MotionValue in useAnimateScroll;
  // only registration/authoring changes rebuild this stable runtime envelope.
  const zoneTimeline = useContext(SceneScrollTimelineContext);
  const arrivalPlaybackToken =
    isDragArrival && sceneContext?.isActive ? (sceneContext.activationToken ?? 0) : 0;
  const currentAuthoringParseReady =
    settledParseGeneration > 0 &&
    settledParseInputsRef.current?.enterAnimation === stableEnterAnimation &&
    settledParseInputsRef.current?.exitAnimation === stableExitAnimation &&
    settledParseInputsRef.current?.loopAnimation === stableLoopAnimation;
  const arrivalRenderSnapshotRef = useRef<{
    token: number;
    ready: boolean;
    enterVariant: ParsedAnimationVariant | null;
    exitVariant: ParsedAnimationVariant | null;
    infiniteVariant: ParsedAnimationVariant | null;
    hasAuthoredEnterAnimation: boolean;
    enterDuration: number;
    exitDuration: number;
    delay: number;
    stagger: typeof stagger;
    enterAnimation: typeof stableEnterAnimation;
    exitAnimation: typeof stableExitAnimation;
    loopAnimation: typeof stableLoopAnimation;
  } | null>(null);
  const captureArrivalRenderSnapshot = (): void => {
    arrivalRenderSnapshotRef.current = {
      token: arrivalPlaybackToken,
      ready: currentAuthoringParseReady,
      enterVariant: currentAuthoringParseReady ? enterVariant : null,
      exitVariant: currentAuthoringParseReady ? exitVariant : null,
      infiniteVariant: currentAuthoringParseReady ? infiniteVariant : null,
      hasAuthoredEnterAnimation: Boolean(stableEnterAnimation),
      enterDuration: normalizedEnterDuration,
      exitDuration: normalizedExitDuration,
      delay: normalizedDelay,
      stagger,
      enterAnimation: stableEnterAnimation,
      exitAnimation: stableExitAnimation,
      loopAnimation: stableLoopAnimation,
    };
  };
  const arrivalSnapshot = arrivalRenderSnapshotRef.current;
  if (
    isDragArrival &&
    (arrivalPlaybackToken === 0 ||
      arrivalSnapshot === null ||
      arrivalSnapshot.token !== arrivalPlaybackToken)
  ) {
    captureArrivalRenderSnapshot();
  }
  const activeArrivalSnapshot = isDragArrival ? arrivalRenderSnapshotRef.current : null;
  if (
    activeArrivalSnapshot &&
    !activeArrivalSnapshot.ready &&
    settledParseGeneration > 0 &&
    settledParseInputsRef.current?.enterAnimation === activeArrivalSnapshot.enterAnimation &&
    settledParseInputsRef.current?.exitAnimation === activeArrivalSnapshot.exitAnimation &&
    settledParseInputsRef.current?.loopAnimation === activeArrivalSnapshot.loopAnimation
  ) {
    activeArrivalSnapshot.ready = true;
    activeArrivalSnapshot.enterVariant = enterVariant;
    activeArrivalSnapshot.exitVariant = exitVariant;
    activeArrivalSnapshot.infiniteVariant = infiniteVariant;
  }
  // Keep a pending parse attached to the activation that requested it. New props
  // are picked up when the next activation captures its authoring snapshot.
  const parseEnterAnimation = activeArrivalSnapshot
    ? activeArrivalSnapshot.enterAnimation
    : stableEnterAnimation;
  const parseExitAnimation = activeArrivalSnapshot
    ? activeArrivalSnapshot.exitAnimation
    : stableExitAnimation;
  const parseLoopAnimation = activeArrivalSnapshot
    ? activeArrivalSnapshot.loopAnimation
    : stableLoopAnimation;
  const renderEnterVariant = activeArrivalSnapshot?.ready
    ? activeArrivalSnapshot.enterVariant
    : isDragArrival
      ? null
      : enterVariant;
  const renderExitVariant = activeArrivalSnapshot?.ready
    ? activeArrivalSnapshot.exitVariant
    : isDragArrival
      ? null
      : exitVariant;
  const renderInfiniteVariant = activeArrivalSnapshot?.ready
    ? activeArrivalSnapshot.infiniteVariant
    : isDragArrival
      ? null
      : infiniteVariant;
  const renderEnterDuration = activeArrivalSnapshot?.enterDuration ?? normalizedEnterDuration;
  const renderExitDuration = activeArrivalSnapshot?.exitDuration ?? normalizedExitDuration;
  const renderDelay = activeArrivalSnapshot?.delay ?? normalizedDelay;
  const renderStagger = activeArrivalSnapshot ? activeArrivalSnapshot.stagger : stagger;

  useEffect(() => {
    if (!isDragArrival) return;
    const lease: SceneAnimationLaneDeclarationLease | undefined = declareAnimateLane?.(
      id,
      'visibility'
    );
    return (): void => lease?.dispose();
  }, [declareAnimateLane, id, isDragArrival]);

  useEffect(() => {
    if (!isDragArrival) return;

    const reportIgnoredField = (field: 'after' | 'exitAnimation', message: string): void => {
      const key = `${id}:${field}`;
      if (arrivalDiagnosticKeysRef.current.has(key)) return;
      arrivalDiagnosticKeysRef.current.add(key);
      reportRuntimeError?.({
        code: 'INVALID_ANIMATION',
        message,
        context: { componentId: id, field, lane: 'visibility', mode: 'drag' },
      });
      devWarn(message);
    };

    if (normalizedAfter) {
      reportIgnoredField(
        'after',
        `Animate "${id}" ignores after in drag mode when timeline.driver is 'clock'.`
      );
    }
    if (stableExitAnimation) {
      reportIgnoredField(
        'exitAnimation',
        `Animate "${id}" ignores exitAnimation in drag mode when timeline.driver is 'clock'.`
      );
    }
  }, [id, isDragArrival, normalizedAfter, reportRuntimeError, stableExitAnimation]);

  const isRenderProp = typeof children === 'function';

  // ── FOUC guard: authored-but-not-yet-parsed ────────────────────────────────
  //
  // Preset variants resolve through an async import, so the first commit after a
  // page load has `enterVariant === null` even though the author DID declare an
  // animation. Returning bare children there paints the child at its natural CSS
  // (opacity 1) for one or more frames, and the element then snaps to its initial
  // frame once the parse lands — the "flash, hide, then animate in" on refresh.
  //
  // Rendering the normal motion path instead keeps the DOM shape identical before
  // and after the parse (no remount, no shifted measurement timing) and lets each
  // driver resolve the INITIAL frame: the visibility lane already seeds
  // visualMotion at 0, the arrival lane seeds 0 whenever an enter was authored,
  // and the drag lane is held at its initial frame via `variantsPending` below.
  // Only a genuinely animation-free Animate still early-returns bare children.
  const authoredPlayableAnimation = Boolean(parseEnterAnimation) || Boolean(parseLoopAnimation);
  // ⚠️ Must also require "parse not yet settled". `parseAnimationSafely` returns null
  // when preset does not exist / chunk load fails, but the parse effect still advances
  // settledParseGeneration — checking only "variant is empty" cannot distinguish "still
  // parsing" from "parse failed". Missing this condition leaves the failed state
  // permanently pending: element is held at initial frame (opacity 0) by each driver,
  // and before the fix it rendered bare children as fail-open. Turning a diagnosable
  // degradation into a permanent blank is a worse failure mode. See the branch matrix
  // guard in animateStaggerOuterStyle.test.tsx.
  const parseSettled = isDragArrival
    ? (activeArrivalSnapshot?.ready ?? currentAuthoringParseReady)
    : currentAuthoringParseReady;
  const variantsPending =
    authoredPlayableAnimation &&
    !parseSettled &&
    !renderEnterVariant &&
    !renderExitVariant &&
    !renderInfiniteVariant;

  // ── enterRef / exitRef lane support ────────────────────────────────────────
  //
  // A manual trigger only means something on a TIME-driven lane (visibility, or
  // drag + driver:'clock'). On a SCRUB lane the visual position is a pure
  // function of its single owner — zone progressPx for scroll takeover, the finger
  // for scene-controlled drag — so anything a manual call wrote would be recomputed
  // away on the next frame. Reporting that is the honest behaviour; silently
  // accepting the ref would look like a framework bug at the call site.
  const isScrubLane = mode === 'drag' ? !isDragArrival : resolvedTimeline.lane === 'scroll';
  /** Currently actually driven by useAnimateScroll's visibility state machine — only it can claim the ref. */
  const manualControlLane = mode === 'scroll' && !isScrubLane;
  const manualControlDiagnosticKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!enterRef && !exitRef) return;

    const reportUnsupported = (field: 'enterRef' | 'exitRef', message: string): void => {
      const key = `${id}:${field}`;
      if (manualControlDiagnosticKeysRef.current.has(key)) return;
      manualControlDiagnosticKeysRef.current.add(key);
      reportRuntimeError?.({
        code: 'INVALID_ANIMATION',
        message,
        context: { componentId: id, field, mode, scrub: isScrubLane },
      });
      devWarn(message);
    };

    if (isScrubLane) {
      const lane =
        mode === 'drag'
          ? 'the Scene element track (drag)'
          : 'the zone scroll budget (scroll takeover)';
      if (enterRef) {
        reportUnsupported(
          'enterRef',
          `Animate "${id}" ignores enterRef: this element is driven by ${lane}, whose progress has a single owner. ` +
            `Use timeline.driver:'clock' (drag) or move it outside the takeover zone (scroll) for manual control.`
        );
      }
      if (exitRef) {
        reportUnsupported(
          'exitRef',
          `Animate "${id}" ignores exitRef: this element is driven by ${lane}, whose progress has a single owner. ` +
            `Use timeline.driver:'clock' (drag) or move it outside the takeover zone (scroll) for manual control.`
        );
      }
      return;
    }

    if (isDragArrival && exitRef) {
      reportUnsupported(
        'exitRef',
        `Animate "${id}" ignores exitRef in drag mode when timeline.driver is 'clock': this lane has no exit pass (it also ignores exitAnimation).`
      );
    }
  }, [enterRef, exitRef, id, isDragArrival, isScrubLane, mode, reportRuntimeError]);

  const activeStagger = isDragArrival ? renderStagger : stagger;
  const staggerContainer =
    activeStagger && !isRenderProp && renderEnterVariant && isValidElement(children)
      ? (children as ReactElement)
      : null;
  const staggerActive = Boolean(staggerContainer);
  const staggerEach = activeStagger?.each ?? 40;
  const staggerFrom = activeStagger?.from ?? 'first';
  const staggerTiming = useMemo(
    () =>
      staggerContainer && renderEnterVariant
        ? resolveStaggerTiming(
            renderEnterVariant,
            renderEnterDuration,
            staggerEach,
            staggerFrom,
            countStaggerItems(staggerContainer)
          )
        : null,
    [renderEnterDuration, renderEnterVariant, staggerContainer, staggerEach, staggerFrom]
  );
  const staggerExitTiming = useMemo(
    () =>
      staggerContainer && renderExitVariant
        ? resolveStaggerTiming(
            renderExitVariant,
            renderExitDuration,
            staggerEach,
            staggerFrom,
            countStaggerItems(staggerContainer),
            'exit'
          )
        : null,
    [renderExitDuration, renderExitVariant, staggerContainer, staggerEach, staggerFrom]
  );
  const effectiveEnterDuration = staggerTiming?.effectiveDurationMs ?? renderEnterDuration;
  const effectiveExitDuration = staggerExitTiming?.effectiveDurationMs ?? renderExitDuration;
  const scrollZoneRuntime = useMemo<SceneScrollZoneRuntime | null>(
    () =>
      zoneRuntime
        ? {
            ...zoneRuntime,
            zoneStates: zoneTimeline?.zoneStates ?? {},
            store: zoneTimeline?.store,
          }
        : null,
    [zoneRuntime, zoneTimeline?.store, zoneTimeline?.zoneStates]
  );

  useEffect(() => {
    const createdLeases = allCreatedLeasesRef.current;
    const generation = ++parseGenerationRef.current;
    const isCurrentGeneration = (): boolean => parseGenerationRef.current === generation;
    const completePreparation = (): void => {
      const current = preparationLeaseRef.current;
      if (!current || current.generation !== generation) return;
      current.lease.complete();
      createdLeases.delete(current.lease);
      preparationLeaseRef.current = null;
    };

    // Replacing an unresolved generation (including React StrictMode's probe
    // generation) is cancellation, not successful preparation. Completing it
    // would synchronously publish a transient empty snapshot before this new
    // generation has parsed and registered its variants.
    preparationLeaseRef.current?.lease.cancel();
    preparationLeaseRef.current = null;
    const preparationLease = mode === 'drag' && !isDragArrival ? beginPreparation?.() : undefined;
    if (preparationLease) {
      createdLeases.add(preparationLease);
    }
    preparationLeaseRef.current = preparationLease ? { generation, lease: preparationLease } : null;
    const reportFailure = (failure: AnimationParseFailure): void => {
      if (!isCurrentGeneration()) return;
      reportRuntimeError?.(failure);
    };

    // A new authoring generation must never display a previous generation's
    // variant while its preset chunk is pending or after it fails open.
    setEnterVariant(null);
    setExitVariant(null);
    setInfiniteVariant(null);
    setSettledParseGeneration(0);

    if (!parseEnterAnimation && !parseLoopAnimation) {
      reportRuntimeError?.({
        code: 'INVALID_ANIMATION',
        message: `Animate "${id}" requires enterAnimation or loopAnimation.`,
        context: {
          componentId: id,
          hasExitAnimation: Boolean(parseExitAnimation),
        },
      });
      completePreparation();
      return (): void => {
        // Dispose all leases created during this effect, regardless of generation.
        // StrictMode double-invoke creates orphaned leases when the first mount is
        // torn down before its lease is completed/cancelled via generation matching.
        createdLeases.forEach((lease) => lease.cancel());
        createdLeases.clear();
        if (isCurrentGeneration()) parseGenerationRef.current += 1;
      };
    }

    const parseAnimations = async (): Promise<void> => {
      const [enter, exit, infinite] = await Promise.all([
        parseAnimationSafely(parseEnterAnimation, id, 'enter', reportFailure),
        parseAnimationSafely(parseExitAnimation, id, 'exit', reportFailure),
        parseAnimationSafely(parseLoopAnimation, id, 'loop', reportFailure),
      ]);

      // Re-check generation after await to prevent stale closure from overwriting newer state.
      // The isCurrentGeneration check captures `generation` at effect start, but parseGenerationRef
      // may have been incremented by a newer effect while this parse was in flight.
      if (parseGenerationRef.current !== generation) return;

      settledParseInputsRef.current = {
        enterAnimation: parseEnterAnimation,
        exitAnimation: parseExitAnimation,
        loopAnimation: parseLoopAnimation,
      };
      setEnterVariant((enter as ParsedAnimationVariant) ?? null);
      setExitVariant((exit as ParsedAnimationVariant) ?? null);
      setInfiniteVariant((infinite as ParsedAnimationVariant) ?? null);
      setSettledParseGeneration(generation);
    };

    void parseAnimations();

    return (): void => {
      // Cancel all leases created during this effect, regardless of generation.
      // StrictMode double-invoke creates orphaned leases when the first mount is
      // torn down before its lease is completed/cancelled via generation matching.
      createdLeases.forEach((lease) => lease.cancel());
      createdLeases.clear();
      if (isCurrentGeneration()) parseGenerationRef.current += 1;
    };
  }, [
    id,
    mode,
    isDragArrival,
    reportRuntimeError,
    beginPreparation,
    parseEnterAnimation,
    parseExitAnimation,
    parseLoopAnimation,
  ]);

  // Authoring may change while a clock-driven arrival is active. Parse new
  // values in the background for the next activation, while this activation
  // keeps consuming its frozen snapshot.
  useEffect(() => {
    if (!isDragArrival || arrivalPlaybackToken === 0 || !activeArrivalSnapshot) return;
    const changed =
      activeArrivalSnapshot.enterAnimation !== stableEnterAnimation ||
      activeArrivalSnapshot.exitAnimation !== stableExitAnimation ||
      activeArrivalSnapshot.loopAnimation !== stableLoopAnimation;
    if (!changed) return;
    void Promise.all([
      parseAnimationSafely(stableEnterAnimation, id, 'enter'),
      parseAnimationSafely(stableExitAnimation, id, 'exit'),
      parseAnimationSafely(stableLoopAnimation, id, 'loop'),
    ]);
  }, [
    activeArrivalSnapshot,
    arrivalPlaybackToken,
    id,
    isDragArrival,
    stableEnterAnimation,
    stableExitAnimation,
    stableLoopAnimation,
  ]);

  // Scene-driven drag Animates use the shared element track. Explicit
  // driver 'clock' Animates use the independent post-arrival clock below
  // and must never register into the Scene timeline / T_self.
  const dragResult = useAnimateDrag({
    sceneContext: mode === 'drag' && !isDragArrival ? sceneContext : null,
    enterVariant,
    exitVariant,
    componentId: id,
    delay: normalizedDelay,
    enterDuration: effectiveEnterDuration,
    exitDuration: effectiveExitDuration,
    after: normalizedAfter,
    variantsPending,
  });

  const arrivalResult = useAnimateArrival({
    enabled: isDragArrival,
    sceneContext: mode === 'drag' ? sceneContext : null,
    enterVariant: renderEnterVariant,
    hasAuthoredEnterAnimation:
      activeArrivalSnapshot?.hasAuthoredEnterAnimation ?? Boolean(enterAnimation),
    parseReady: activeArrivalSnapshot?.ready ?? settledParseGeneration > 0,
    delay: renderDelay,
    enterDuration: effectiveEnterDuration,
    // ref ownership: only the currently active driver can claim it, otherwise the effects
    // from both hooks would overwrite each other's `enterRef.current` (last one wins), and
    // the consumer gets a trigger that doesn't actually drive anything.
    enterRef: isDragArrival ? enterRef : undefined,
  });

  const scrollResult = useAnimateScroll({
    sceneContext: mode === 'scroll' ? sceneContext : null,
    zoneRuntime: mode === 'scroll' ? scrollZoneRuntime : null,
    zoneId: resolvedZoneId,
    enterVariant,
    exitVariant,
    hasAuthoredEnterAnimation: Boolean(enterAnimation),
    hasAuthoredExitAnimation: Boolean(exitAnimation),
    hasInfiniteAnimation: Boolean(infiniteVariant),
    componentId: id,
    duration: {
      enter: effectiveEnterDuration,
      exit: effectiveExitDuration,
    },
    timeline: resolvedTimeline,
    visibility: normalizedSemantics.visibility,
    globalEnterMargin: cineViewRuntime?.scrollEnterMargin,
    globalExitMargin: cineViewRuntime?.scrollExitMargin,
    // Same as above: when drag arrival is active, this hook doesn't drive anything and must not claim the ref.
    // scrub lanes (scroll takeover / drag scene-controlled) also don't claim — the contract is "ignore",
    // so `enterRef.current` must remain null so consumer's capability detection isn't misled.
    enterRef: manualControlLane ? enterRef : undefined,
    exitRef: manualControlLane ? exitRef : undefined,
    variantsPending,
  });

  // This effect is declared after useAnimateDrag, so its registration effect has
  // already published the parsed variant into the registry before preparation is
  // released. Failed parses still release and produce a stable snapshot without
  // the invalid Animate.
  useEffect(() => {
    if (mode !== 'drag' || settledParseGeneration === 0) return;
    const current = preparationLeaseRef.current;
    if (!current || current.generation !== settledParseGeneration) return;
    current.lease.complete();
    preparationLeaseRef.current = null;
  }, [mode, settledParseGeneration]);

  const publicTimeline = useAnimatePublicTimeline({
    mode,
    isDragArrival,
    timelineLane: mode === 'scroll' || isDragArrival ? resolvedTimeline.lane : 'drag',
    sceneContext,
    arrivalVisualMotion: arrivalResult.visualMotion,
    arrivalPhaseMotion: arrivalResult.phaseMotion,
    scrollVisualMotion: scrollResult.visualMotion,
    scrollPhaseMotion: scrollResult.phaseMotion,
    dragVisualState: dragResult.visualState,
  });

  useEffect(() => {
    const activeInfiniteVariant = isDragArrival ? renderInfiniteVariant : infiniteVariant;
    if (mode !== 'drag' || !activeInfiniteVariant) return;

    const shouldRunInfinite =
      !prefersReducedMotion &&
      (isDragArrival ? arrivalResult.shouldRunInfinite : dragResult.shouldRunInfinite);
    if (!shouldRunInfinite) {
      dragInfiniteControls.stop();
      return;
    }

    dragInfiniteControls.start({
      ...(activeInfiniteVariant.animate as Record<string, unknown>),
      transition: {
        ...(((activeInfiniteVariant.animate as Record<string, unknown>).transition as Record<
          string,
          unknown
        >) || {}),
        repeat: Infinity,
      },
    } as never);
  }, [
    arrivalResult.shouldRunInfinite,
    dragInfiniteControls,
    dragResult.shouldRunInfinite,
    infiniteVariant,
    isDragArrival,
    mode,
    prefersReducedMotion,
    renderInfiniteVariant,
  ]);

  useEffect(() => {
    if (mode !== 'scroll' || !infiniteVariant) return;

    // A persistent loop is motion the page decided to play, so it is exactly what
    // "reduce motion" asks us not to start (WCAG 2.3.3). Scrub is untouched: that is
    // the reader's own scroll being reflected back.
    if (prefersReducedMotion || !scrollResult.shouldRunInfinite) {
      scrollInfiniteControls.stop();
      return;
    }

    scrollInfiniteControls.start({
      ...(infiniteVariant.animate as Record<string, unknown>),
      transition: {
        ...(((infiniteVariant.animate as Record<string, unknown>).transition as Record<
          string,
          unknown
        >) || {}),
        repeat: Infinity,
      },
    } as never);
  }, [
    mode,
    infiniteVariant,
    prefersReducedMotion,
    scrollResult.shouldRunInfinite,
    scrollInfiniteControls,
  ]);

  // render-prop bridge: when children is a function, attach corresponding bridge to
  // subscribe progress/phase source based on current mode; otherwise pass through as-is.
  // Non-function children have zero extra cost (no bridge, no subscription).
  const renderFn = isRenderProp
    ? (children as (state: AnimateRenderState) => React.ReactNode)
    : undefined;
  const plainChildren = isRenderProp ? null : (children as React.ReactNode);
  const bridgedChildren: React.ReactNode = !renderFn ? (
    plainChildren
  ) : mode === 'scroll' || isDragArrival ? (
    <ScrollRenderBridge
      signedVisual={isDragArrival ? arrivalResult.visualMotion : scrollResult.visualMotion}
      phaseMotion={isDragArrival ? arrivalResult.phaseMotion : scrollResult.phaseMotion}
      render={renderFn}
    />
  ) : (
    <DragRenderBridge visualState={dragResult.visualState} render={renderFn} />
  );

  // Tier 2 stagger: when children is a single valid element container + has stagger + has enterVariant,
  // child elements are staggered via framer's native variant propagation (solution B, bypasses whitelist).
  // Outer motion.div's visual style is neutralized (otherwise container entry + child stagger double-animate),
  // but visualMotion still runs internally as the trigger source for stagger subscription. render-prop and
  // stagger are mutually exclusive (function children has no container to decompose).
  const staggeredContent: React.ReactNode =
    staggerContainer && renderEnterVariant ? (
      mode === 'scroll' ? (
        <ScrollStagger
          container={staggerContainer}
          variant={renderEnterVariant}
          each={staggerEach}
          from={staggerFrom}
          itemDurationMs={staggerTiming?.itemDurationMs}
          effectiveDurationMs={staggerTiming?.effectiveDurationMs}
          exitVariant={renderExitVariant}
          exitItemDurationMs={staggerExitTiming?.itemDurationMs}
          signedVisual={scrollResult.visualMotion}
        />
      ) : isDragArrival ? (
        <ArrivalStagger
          container={staggerContainer}
          variant={renderEnterVariant}
          each={staggerEach}
          from={staggerFrom}
          itemDurationMs={staggerTiming?.itemDurationMs}
          effectiveDurationMs={staggerTiming?.effectiveDurationMs}
          phaseMotion={arrivalResult.phaseMotion}
          staticReveal={arrivalResult.staticReveal}
        />
      ) : (
        <DragStagger
          container={staggerContainer}
          variant={renderEnterVariant}
          each={staggerEach}
          from={staggerFrom}
          itemDurationMs={staggerTiming?.itemDurationMs}
          effectiveDurationMs={staggerTiming?.effectiveDurationMs}
          exitVariant={renderExitVariant}
          exitItemDurationMs={staggerExitTiming?.itemDurationMs}
          visualState={dragResult.visualState}
        />
      )
    ) : null;
  const content = staggerActive ? staggeredContent : bridgedChildren;
  const providedContent = (
    <AnimateTimelineProvider value={publicTimeline}>{content}</AnimateTimelineProvider>
  );
  // ⚠️ When stagger is active, outer layer must relinquish visual properties (otherwise container
  // entry + child stagger double-animate), but **cannot switch style to undefined**: that means
  // "framer no longer owns this property", not "property returns to default value" — the inline
  // value last written to the DOM stays as-is. During variantsPending, outer layer briefly bound
  // to opacity 0 scrub style; once parse lands and switches to undefined, that 0 is permanently
  // pinned to the container, and even if child stagger reveals to opacity 1, they're all covered
  // by the container (verified by main page typewriter subtitle disappearing on first-screen).
  // Explicitly provide a stable neutral style, let framer own it throughout and write back 1 on takeover.
  const scrollOuterStyle = staggerActive ? STAGGER_NEUTRAL_STYLE : scrollResult.style;
  const dragOuterStyle = staggerActive
    ? STAGGER_NEUTRAL_STYLE
    : isDragArrival
      ? arrivalResult.style
      : dragResult.style;

  if (!renderEnterVariant && !renderExitVariant && !renderInfiniteVariant && !variantsPending) {
    // No-animation early exit: no progress to push, function children get initial state directly
    // (otherwise would render as [object Function]).
    return (
      <AnimateTimelineProvider value={publicTimeline}>
        {renderFn ? renderFn(IDLE_RENDER_STATE) : plainChildren}
      </AnimateTimelineProvider>
    );
  }

  if (mode === 'scroll') {
    if (renderInfiniteVariant) {
      return (
        <div data-cineview-animate-host={id}>
          {/* scrollOuterStyle (not scrollResult.style): when stagger is active, outer layer must
              relinquish visual properties, see explanation above at scrollOuterStyle definition.
              This branch previously bound raw scrub style directly, was the only one of four return
              branches that missed this guard — when stagger + infinite appear together, outer layer
              stays at scrub lane initial frame opacity 0, darkening the entire group of children
              already staggered to 1. Branch matrix guard is in animateStaggerOuterStyle.test.tsx. */}
          <motion.div
            style={scrollOuterStyle}
            className="cineview-animate"
            data-cineview-animate-id={id}
          >
            <motion.div animate={scrollInfiniteControls}>{providedContent}</motion.div>
          </motion.div>
        </div>
      );
    }

    return (
      <div data-cineview-animate-host={id}>
        <motion.div
          style={scrollOuterStyle}
          className="cineview-animate"
          data-cineview-animate-id={id}
        >
          {providedContent}
        </motion.div>
      </div>
    );
  }

  if (renderInfiniteVariant) {
    return (
      <motion.div style={dragOuterStyle} className="cineview-animate" data-cineview-animate-id={id}>
        <motion.div animate={dragInfiniteControls}>{providedContent}</motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div style={dragOuterStyle} className="cineview-animate" data-cineview-animate-id={id}>
      {providedContent}
    </motion.div>
  );
};

Animate.displayName = 'Animate';

export default Animate;
