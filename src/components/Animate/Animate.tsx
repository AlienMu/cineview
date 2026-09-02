/**
 * Animate Component - 统一入口，根据 mode 选择实现
 * drag 模式：使用 useAnimateDrag
 * scroll 模式：使用 useAnimateScroll
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
  | 'inactive'
  | 'entering'
  | 'active'
  | 'exiting'
  | 'covered'
  | 'parked';

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

/** stagger 容器的中性外层样式：见下方 scrollOuterStyle 处的所有权说明。
 *  必须是模块级常量（稳定引用），否则每次渲染换新对象会让 framer 重建绑定。 */
const STAGGER_NEUTRAL_STYLE = Object.freeze({ opacity: 1 });

let animateIdCounter = 0;

export const Animate: React.FC<AnimateInternalProps> = ({
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
}) => {
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
    };
  };
  const arrivalSnapshot = arrivalRenderSnapshotRef.current;
  if (
    isDragArrival &&
    (arrivalPlaybackToken === 0 ||
      arrivalSnapshot === null ||
      arrivalSnapshot.token !== arrivalPlaybackToken ||
      (!arrivalSnapshot.ready && currentAuthoringParseReady))
  ) {
    captureArrivalRenderSnapshot();
  }
  const activeArrivalSnapshot = isDragArrival ? arrivalRenderSnapshotRef.current : null;
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
  const renderStagger = activeArrivalSnapshot?.stagger ?? stagger;

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
  const authoredPlayableAnimation = Boolean(stableEnterAnimation) || Boolean(stableLoopAnimation);
  // ⚠️ 必须同时要求「解析尚未 settle」。`parseAnimationSafely` 在预设不存在 / chunk
  // 加载失败时返回 null，但解析 effect 照样推进 settledParseGeneration —— 只看
  // 「变体为空」无法区分「还在解析」与「解析失败」。漏掉这个条件会让失败态永久
  // pending：元素被各 driver 永久按在 initial 帧（opacity 0），而修复前它是渲染裸
  // children 的 fail-open。把一个可诊断的降级变成永久空白是更坏的失败模式。
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
  /** 本次渲染下真正由 `useAnimateScroll` 的 visibility 状态机驱动 —— 只有它可认领 ref。 */
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
    const generation = ++parseGenerationRef.current;
    const isCurrentGeneration = (): boolean => parseGenerationRef.current === generation;
    const completePreparation = (): void => {
      const current = preparationLeaseRef.current;
      if (!current || current.generation !== generation) return;
      current.lease.complete();
      preparationLeaseRef.current = null;
    };
    const cancelPreparation = (): void => {
      const current = preparationLeaseRef.current;
      if (!current || current.generation !== generation) return;
      current.lease.cancel();
      preparationLeaseRef.current = null;
    };

    // Replacing an unresolved generation (including React StrictMode's probe
    // generation) is cancellation, not successful preparation. Completing it
    // would synchronously publish a transient empty snapshot before this new
    // generation has parsed and registered its variants.
    preparationLeaseRef.current?.lease.cancel();
    preparationLeaseRef.current = null;
    const preparationLease = mode === 'drag' && !isDragArrival ? beginPreparation?.() : undefined;
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

    if (!stableEnterAnimation && !stableLoopAnimation) {
      reportRuntimeError?.({
        code: 'INVALID_ANIMATION',
        message: `Animate "${id}" requires enterAnimation or loopAnimation.`,
        context: {
          componentId: id,
          hasExitAnimation: Boolean(stableExitAnimation),
        },
      });
      completePreparation();
      return (): void => {
        completePreparation();
        if (isCurrentGeneration()) parseGenerationRef.current += 1;
      };
    }

    const parseAnimations = async (): Promise<void> => {
      const [enter, exit, infinite] = await Promise.all([
        parseAnimationSafely(stableEnterAnimation, id, 'enter', reportFailure),
        parseAnimationSafely(stableExitAnimation, id, 'exit', reportFailure),
        parseAnimationSafely(stableLoopAnimation, id, 'loop', reportFailure),
      ]);

      if (!isCurrentGeneration()) return;
      settledParseInputsRef.current = {
        enterAnimation: stableEnterAnimation,
        exitAnimation: stableExitAnimation,
        loopAnimation: stableLoopAnimation,
      };
      setEnterVariant((enter as ParsedAnimationVariant) ?? null);
      setExitVariant((exit as ParsedAnimationVariant) ?? null);
      setInfiniteVariant((infinite as ParsedAnimationVariant) ?? null);
      setSettledParseGeneration(generation);
    };

    void parseAnimations();

    return (): void => {
      cancelPreparation();
      if (isCurrentGeneration()) parseGenerationRef.current += 1;
    };
  }, [
    id,
    mode,
    isDragArrival,
    reportRuntimeError,
    beginPreparation,
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
    // ref 归属：只有当前生效的 driver 才可认领，否则两条 hook 的 effect 会互相覆盖
    // `enterRef.current`（后跑的赢），消费者拿到的是一条根本不驱动任何东西的 trigger。
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
    // 同上：drag arrival 生效时本 hook 不驱动任何东西，不得认领 ref。
    // scrub 轨（scroll takeover / drag scene-controlled）也不认领 —— 契约是「忽略」，
    // 那就必须让 `enterRef.current` 保持 null，消费者的能力探测才不会被误导。
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

  // render-prop 桥接:children 为函数时,按当前 mode 挂对应 bridge 订阅进度/相位源;
  // 否则原样透传。非函数 children 零额外成本(不挂 bridge、不订阅)。
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

  // Tier 2 stagger:children 为单个有效元素容器 + 有 stagger + 有 enterVariant 时,
  // 子元素由 framer 原生 variant 传播错峰(方案B,绕白名单)。外层 motion.div 的视觉
  // style 中和(否则容器整体入场与子元素错峰双重动画),但 visualMotion 仍在内部跑作
  // 触发源供 stagger 订阅。render-prop 与 stagger 互斥(函数 children 无容器可拆)。
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
  // ⚠️ stagger 生效时外层必须交出视觉属性（否则容器整体入场与子元素错峰双重动画），
  // 但**不能把 style 切成 undefined**：那是「framer 不再拥有该属性」，而不是「属性回到
  // 默认值」——上一次写进 DOM 的 inline 值会原样留着。variantsPending 期间外层曾短暂
  // 绑过 opacity 0 的 scrub style，解析落地后一旦切成 undefined，那个 0 就永久钉在
  // 容器上，子元素错峰揭示到 opacity 1 也全被容器盖住（实测首屏打字机副标题整段消失）。
  // 显式给一个稳定的中性 style，让 framer 全程持有并在接管瞬间写回 1。
  const scrollOuterStyle = staggerActive ? STAGGER_NEUTRAL_STYLE : scrollResult.style;
  const dragOuterStyle = staggerActive
    ? STAGGER_NEUTRAL_STYLE
    : isDragArrival
      ? arrivalResult.style
      : dragResult.style;

  if (!renderEnterVariant && !renderExitVariant && !renderInfiniteVariant && !variantsPending) {
    // 无动画早退:无进度可推,函数 children 直接给初始态(否则会渲染成 [object Function])。
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
          {/* scrollOuterStyle（不是 scrollResult.style）：stagger 生效时外层必须交出
              视觉属性，见上方 scrollOuterStyle 处的说明。此分支曾直接绑原始 scrub
              style，是四个返回分支里唯一漏掉该守卫的一个——stagger + infinite 同时
              出现时外层会停在 scrub 轨初始帧 opacity 0，把已错峰到 1 的子元素整组
              压暗。分支矩阵守卫见 animateStaggerOuterStyle.test.tsx。 */}
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
