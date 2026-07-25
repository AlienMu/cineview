import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, MotionValue, useMotionValue, useTransform } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import { useCineViewContext } from '../../context/CineViewContext';
import type { SceneContextType } from './Animate';
import type { ResolvedAnimateTimeline, NormalizedAnimateVisibility } from './animateSemantics';
import type { SceneScrollZoneRuntime } from '../Scene/sceneScrollRuntime';
import {
  clamp,
  getDefaultValue,
  getVariantValue,
  lerp,
  lerpTransformValue,
  parseNumericValue,
  type AnimatableProperty,
  type VariantRecord,
} from './animateInterpolation';
import {
  subscribeVisibilityMeasurement,
  type VisibilityRootMeasurement,
} from './visibilityScheduler';

interface UseAnimateScrollParams {
  sceneContext: SceneContextType | null;
  zoneRuntime: SceneScrollZoneRuntime | null;
  zoneId: string | null;
  enterVariant: ParsedAnimationVariant | null;
  exitVariant: ParsedAnimationVariant | null;
  hasAuthoredEnterAnimation?: boolean;
  hasAuthoredExitAnimation?: boolean;
  componentId: string;
  duration: {
    enter: number;
    exit: number;
  };
  timeline: ResolvedAnimateTimeline;
  visibility: NormalizedAnimateVisibility;
  /** CineView-level default enter/exit gate margins (design px). Per-Animate
   *  visibility margins override these; both undefined → fall back to 50. */
  globalEnterMargin?: number;
  globalExitMargin?: number;
}

interface UseAnimateScrollReturn {
  style: Record<string, MotionValue<number> | MotionValue<string> | MotionValue<number | string>>;
  shouldRunInfinite: boolean;
  // Observable sources for the render-prop bridge. visualMotion: 0=initial, 1=entered,
  // -1=exited. phaseMotion mirrors the GatePhase. Non-subscribers pay no re-render.
  visualMotion: MotionValue<number>;
  phaseMotion: MotionValue<GatePhase>;
}

type AnimatedProperty = AnimatableProperty;

const DEFAULT_GATE_MARGIN_PX = 50;
const VISIBILITY_EXIT_EPSILON = 1e-6;

export type GatePhase = 'idle' | 'entering' | 'entered' | 'exiting' | 'exited';
export type GateAction = 'enter' | 'exit' | null;

/**
 * Pure phase-transition decision for the visibility gate state machine.
 *
 * Enter and exit gates overlap in relTop ∈ [0, exitMargin] (both true). Without
 * a mutex, reverse re-entry drives the element down through that band and the
 * machine flips enter→exit→enter within one update batch — the exit snap to
 * -epsilon flashes a near-animate frame ("element appears then replays from 0").
 * The overlap band is therefore a hysteresis dead zone: when BOTH gates are
 * true, hold the current phase (return null). Enter only fires strictly above
 * the band (enterGate && !exitGate); exit only strictly below it
 * (exitGate && !enterGate). Geometry (gate definitions) is unchanged — this only
 * governs which transition the band resolves to.
 *
 * Returns the tween to launch, or null to hold the current phase.
 */
export function resolveGatePhaseAction(
  phase: GatePhase,
  enterGate: boolean,
  exitGate: boolean,
  opts: { hasExplicitExit: boolean; replayOnReenter: boolean }
): GateAction {
  switch (phase) {
    case 'idle':
      return enterGate && !exitGate ? 'enter' : null;
    case 'entering':
      return exitGate && !enterGate && opts.hasExplicitExit ? 'exit' : null;
    case 'entered':
      // Only an authored exitAnimation exits. Without one the element holds at
      // its entered frame forever (never snaps to hidden), even when it scrolls
      // back up past the top — "no exitAnimation => stay visible". This mirrors
      // the `entering` guard above; their asymmetry was the snap-disappear bug.
      return exitGate && !enterGate && opts.hasExplicitExit ? 'exit' : null;
    case 'exiting':
      return enterGate && !exitGate && opts.replayOnReenter ? 'enter' : null;
    case 'exited':
      return enterGate && !exitGate && opts.replayOnReenter ? 'enter' : null;
    default:
      return null;
  }
}

/**
 * Pure decision for whether a visibility-driven element's infiniteAnimation
 * should be running.
 *
 * The infinite (e.g. pulse) loop must only run while the element is BOTH in its
 * entered phase AND currently intersecting the viewport. An element with no
 * authored exitAnimation (hasExplicitExit === false) never exits — its phase
 * stays 'entered' indefinitely even after it scrolls fully off-screen in either
 * direction. Without an explicit on-screen check the infinite loop then keeps
 * spinning off-screen forever (wasted work, and the element silently pulses
 * where nobody can see it). Tying it to live viewport intersection pauses the
 * loop the moment the element leaves the viewport in EITHER direction and
 * resumes it on return.
 */
export function resolveInfiniteActive(phase: GatePhase, onScreen: boolean): boolean {
  return phase === 'entered' && onScreen;
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

function hasExitAnimation(
  exitVariant: ParsedAnimationVariant | null,
  exitDuration: number
): boolean {
  return Boolean(
    exitDuration > 0 &&
    exitVariant?.exit &&
    Object.keys(exitVariant.exit as Record<string, unknown>).length > 0
  );
}

function useMixedValue(
  visualMotion: MotionValue<number>,
  variantsRef: MutableRefObject<{
    enterInitial: VariantRecord;
    enterAnimate: VariantRecord;
    exitTarget: VariantRecord;
  }>,
  property: AnimatedProperty
): MotionValue<number | string> {
  return useTransform(visualMotion, (progress) => {
    const variants = variantsRef.current;
    const initialValue = getVariantValue(
      variants.enterInitial,
      property,
      getDefaultValue(property, 'initial')
    );
    const animateValue = getVariantValue(
      variants.enterAnimate,
      property,
      getDefaultValue(property, 'animate')
    );
    const exitValue = getVariantValue(
      variants.exitTarget,
      property,
      getDefaultValue(property, 'exit')
    );

    if (progress >= 0) {
      return lerpTransformValue(initialValue, animateValue, progress);
    }

    return lerpTransformValue(animateValue, exitValue, Math.abs(progress));
  });
}

function useNumericValue(
  visualMotion: MotionValue<number>,
  variantsRef: MutableRefObject<{
    enterInitial: VariantRecord;
    enterAnimate: VariantRecord;
    exitTarget: VariantRecord;
  }>,
  property: AnimatedProperty
): MotionValue<number> {
  return useTransform(visualMotion, (progress) => {
    const variants = variantsRef.current;
    const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
    const initialValue = parseNumericValue(
      getVariantValue(variants.enterInitial, property, getDefaultValue(property, 'initial')),
      fallback
    );
    const animateValue = parseNumericValue(
      getVariantValue(variants.enterAnimate, property, getDefaultValue(property, 'animate')),
      fallback
    );
    const exitValue = parseNumericValue(
      getVariantValue(variants.exitTarget, property, getDefaultValue(property, 'exit')),
      fallback
    );

    if (progress >= 0) {
      return lerp(initialValue, animateValue, progress);
    }

    return lerp(animateValue, exitValue, Math.abs(progress));
  });
}

export function useAnimateScroll({
  sceneContext,
  zoneRuntime,
  zoneId,
  enterVariant,
  exitVariant,
  hasAuthoredEnterAnimation,
  hasAuthoredExitAnimation,
  componentId,
  duration,
  timeline,
  visibility,
  globalEnterMargin,
  globalExitMargin,
}: UseAnimateScrollParams): UseAnimateScrollReturn {
  const enterDuration = duration.enter;
  const exitDuration = duration.exit;
  const delay = timeline.delay;
  const waitFor = timeline.waitFor;
  const isScrollDriven = timeline.driver === 'scroll';
  const phaseStart = timeline.phase?.start;
  const phaseEnd = timeline.phase?.end;
  const replayOnReenter = visibility.replayOnReenter;
  // Resolve enter/exit gate margins: per-Animate override → CineView-level
  // default → 50. Design px × scale → physical px (the gate compares against
  // getBoundingClientRect, which is in physical px). Under the px2vw single-scale
  // model the margin scales by the same width-scale as every other length.
  // `scale` falls back to 1 when no CineViewContext (e.g. isolated tests).
  const cineViewContext = useCineViewContext();
  const gateScale = cineViewContext?.scale ?? 1;
  const enterMarginDesignPx = visibility.enterMargin ?? globalEnterMargin ?? DEFAULT_GATE_MARGIN_PX;
  const exitMarginDesignPx = visibility.exitMargin ?? globalExitMargin ?? DEFAULT_GATE_MARGIN_PX;
  const enterMarginPx = Math.max(0, enterMarginDesignPx * gateScale);
  const exitMarginPx = Math.max(0, exitMarginDesignPx * gateScale);
  const variantsRef = useRef({
    enterInitial: {} as VariantRecord,
    enterAnimate: {} as VariantRecord,
    exitTarget: {} as VariantRecord,
  });
  const visualMotion = useMotionValue(0);
  const [shouldRunInfiniteState, setShouldRunInfiniteState] = useState(false);
  const hostRef = useRef<HTMLElement | null>(null);
  const [hostVersion, setHostVersion] = useState(0);
  const registerZoneAnimation = zoneRuntime?.registerZoneAnimation;
  const unregisterZoneAnimation = zoneRuntime?.unregisterZoneAnimation;
  const zoneRuntimeVersion = zoneRuntime?.version;
  // Per-scene enter-completion bus (visibility waitFor). markEntered publishes
  // this element's entered/left state; subscribeEntered lets a follower wait for
  // its leader to actually finish instead of re-deriving the delay from
  // calculatedDelay (which double-counts the leader on the gate-relative clock).
  const markAnimateEntered = sceneContext?.markAnimateEntered;
  const subscribeAnimateEntered = sceneContext?.subscribeAnimateEntered;
  const hasParsedEnter = Boolean(
    enterVariant?.animate && Object.keys(enterVariant.animate as Record<string, unknown>).length > 0
  );
  const hasExplicitEnter = hasParsedEnter || Boolean(hasAuthoredEnterAnimation);
  const hasExplicitExit =
    hasExitAnimation(exitVariant, exitDuration) || Boolean(hasAuthoredExitAnimation);

  useEffect(() => {
    variantsRef.current = {
      enterInitial: (enterVariant?.initial as VariantRecord) || {},
      enterAnimate: (enterVariant?.animate as VariantRecord) || {},
      exitTarget: (exitVariant?.exit as VariantRecord) || {},
    };
  }, [enterVariant, exitVariant]);

  // --- Gate-based visibility state machine (replaces position-scrub) ---------
  // The old model mapped rect.top → a continuous enter progress, so any element
  // whose first frame sat below the viewport center rendered a mid-enter frame
  // it never scrolled into (and last-screen elements froze half-revealed). The
  // new model is a boolean GATE + a time-based tween: the element rests at its
  // initial frame until its enter gate is satisfied, then plays its enter
  // animation over enterDuration; exit is a symmetric gate + tween. No
  // position→progress mapping exists, so the mid-enter artifact is structurally
  // impossible.
  //
  // visualMotion convention (consumed by useMixedValue / useNumericValue):
  //   0  = initial frame      (>=0 lerps initial→animate)
  //   1  = fully entered (animate)
  //  -1  = fully exited        (<0 lerps animate→exit)
  // A tween from the entered state to exit snaps to -epsilon first (still the
  // animate frame visually) then tweens to -1, so it never passes through 0
  // (which would flash the initial frame).
  const phaseRef = useRef<GatePhase>('idle');
  // Mirror of phaseRef as a MotionValue so the render-prop bridge can subscribe to
  // phase changes. `.set()` is a no-op cost for non-subscribers, so this adds no
  // re-render to Animates that don't use function children.
  const phaseMotion = useMotionValue<GatePhase>('idle');
  const setPhase = useCallback(
    (p: GatePhase): void => {
      phaseRef.current = p;
      phaseMotion.set(p);
      // Publish entered/left to the per-scene bus so followers gated on this id
      // (visibility waitFor) can wake exactly when it completes. entered=true on
      // 'entered'; false on any non-entered phase (idle/entering/exiting/exited)
      // so a re-entering leader re-arms its followers.
      markAnimateEntered?.(componentId, p === 'entered');
    },
    [phaseMotion, markAnimateEntered, componentId]
  );
  const tweenControlsRef = useRef<{ stop: () => void } | null>(null);
  const enterDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Unsubscribe handle for an in-flight waitFor-leader subscription (visibility).
  const waitForUnsubRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  const stopTween = useCallback(() => {
    if (tweenControlsRef.current) {
      tweenControlsRef.current.stop();
      tweenControlsRef.current = null;
    }
    if (enterDelayTimerRef.current) {
      clearTimeout(enterDelayTimerRef.current);
      enterDelayTimerRef.current = null;
    }
    if (waitForUnsubRef.current) {
      waitForUnsubRef.current();
      waitForUnsubRef.current = null;
    }
  }, []);

  const runEnterTween = useCallback(() => {
    stopTween();
    setPhase('entering');
    // Re-enter from an exited/exiting state starts from the initial frame so the
    // enter animation replays from the top, not from the exit frame.
    if (visualMotion.get() < 0) {
      visualMotion.set(0);
    }
    const launch = (): void => {
      const controls = animate(visualMotion, 1, {
        duration: Math.max(enterDuration, 0) / 1000,
        ease: 'easeInOut',
        onComplete: () => {
          tweenControlsRef.current = null;
          setPhase('entered');
          setShouldRunInfiniteState(true);
        },
      });
      tweenControlsRef.current = controls;
    };
    // After the (optional) leader-completion wait, delay by this element's OWN
    // delay only. The leader's delay+duration is NOT re-added here: on the
    // visibility gate each element runs its own clock, so the shared-clock
    // calculatedDelay would double-count the leader (see the phase bus above).
    const launchAfterOwnDelay = (): void => {
      if (delay > 0) {
        enterDelayTimerRef.current = setTimeout(() => {
          enterDelayTimerRef.current = null;
          launch();
        }, delay);
      } else {
        launch();
      }
    };
    // waitFor gates on the LEADER actually completing. subscribeAnimateEntered
    // fires the callback immediately if the leader already entered (the "leader
    // long done" case — no re-wait), else once it does. No waitFor → straight to
    // the own-delay launch.
    if (waitFor && subscribeAnimateEntered) {
      waitForUnsubRef.current = subscribeAnimateEntered(waitFor, () => {
        waitForUnsubRef.current = null;
        launchAfterOwnDelay();
      });
    } else {
      launchAfterOwnDelay();
    }
    setShouldRunInfiniteState(false);
  }, [delay, enterDuration, stopTween, setPhase, visualMotion, waitFor, subscribeAnimateEntered]);

  const runExitTween = useCallback(() => {
    stopTween();
    setPhase('exiting');
    setShouldRunInfiniteState(false);
    // runExitTween is only reached when hasExplicitExit is true: resolveGatePhaseAction
    // never returns 'exit' for an element without an authored exitAnimation (no exit
    // => the element holds at its entered frame forever instead of snapping to hidden).
    // Snap into the exit branch at the animate frame (-epsilon ≈ animate) so the
    // tween to -1 never crosses 0 and flashes the initial frame.
    if (visualMotion.get() >= 0) {
      visualMotion.set(-VISIBILITY_EXIT_EPSILON);
    }
    const controls = animate(visualMotion, -1, {
      duration: Math.max(exitDuration, 0) / 1000,
      ease: 'easeInOut',
      onComplete: () => {
        tweenControlsRef.current = null;
        setPhase('exited');
      },
    });
    tweenControlsRef.current = controls;
  }, [exitDuration, stopTween, setPhase, visualMotion]);

  const runVisibilityUpdate = useCallback(
    (rootMeasurement?: VisibilityRootMeasurement) => {
      if (isScrollDriven) {
        return;
      }

      const hostElement = hostRef.current;
      if (!(hostElement instanceof HTMLElement)) {
        return;
      }

      // First-screen cold-start hold: scene 0 elements wait for priority assets
      // (firstSceneEnterReady === false). undefined = not gated (non-first scene).
      const firstSceneReady = sceneContext?.firstSceneEnterReady;
      if (firstSceneReady === false) {
        visualMotion.set(0);
        setPhase('idle');
        setShouldRunInfiniteState(false);
        return;
      }

      const rect = hostElement.getBoundingClientRect();
      // Pre-layout / unmounted host reports a zero-area box at the origin. A naive
      // gate read there would see relTop=0 and fire the enter prematurely, so bail
      // and keep the current phase until the element has a real box. In a real
      // browser this just defers the decision by one frame until layout settles.
      const hasMeasurableBox = rect.width > 0 || rect.height > 0 || rect.bottom !== rect.top;
      if (!hasMeasurableBox) {
        return;
      }
      const scrollRoot = hostElement.closest<HTMLElement>('[data-cineview-container="true"]');
      const containerTop =
        rootMeasurement?.top ?? (scrollRoot ? scrollRoot.getBoundingClientRect().top : 0);
      // The container is always full-height (project invariant), so its clientHeight
      // equals innerHeight in a real browser. Fall back to innerHeight when the
      // container reports 0 (jsdom, or before layout) so the gate math stays valid.
      const containerHeight = rootMeasurement?.height ?? scrollRoot?.clientHeight ?? 0;
      const vh = containerHeight || window.innerHeight || 1;
      const relTop = rect.top - containerTop;
      const relBottom = rect.bottom - containerTop;
      const elementHeight = Math.max(rect.height, relBottom - relTop, 0);

      // Oversized: an element taller than the usable enter band can never be
      // "fully inside with a bottom margin", so it uses a preparatory rule —
      // enter once its top crosses the viewport center, exit once its bottom
      // rises past 70% of the viewport.
      const isOversized = elementHeight > vh - enterMarginPx;
      const rawEnterGate = isOversized
        ? relTop <= vh / 2
        : relTop >= 0 && relBottom <= vh - enterMarginPx;
      // Symmetric exit: a normal element leaves via the TOP (top edge within
      // exitMargin of the viewport top) on forward scroll, OR via the BOTTOM
      // (bottom edge within exitMargin of the viewport bottom) on reverse scroll.
      // The single-sided top-only gate exited on forward scroll but never on
      // reverse — an element scrolled back down to the bottom held its entered
      // frame instead of exiting, which read as asymmetric.
      const exitGate = isOversized
        ? relBottom <= vh * 0.7
        : relTop <= exitMarginPx || relBottom >= vh - exitMarginPx;
      // Gate overlap differs by path. Normal: enter (relTop>=0 && relBottom<=vh−
      // enterMargin) overlaps the top exit band (relTop<=exitMargin) only in the
      // [0, exitMargin] comfort band, and touches the bottom exit band
      // (relBottom>=vh−exitMargin) only at the single point relBottom=vh−margin
      // (when enter/exit margins are equal) — both are hysteresis dead zones where
      // the switch mutex holds the current phase. Forward entry rising through the
      // bottom band stays in 'idle' (idle never exits), so no premature exit fires.
      // Oversized: enter (top<=center) and exit (bottom<=70%) overlap across a
      // large region where the element is genuinely leaving (top still above center
      // is a stale artifact), so exit must win — suppress enter whenever exit is
      // satisfied on this path.
      const enterGate = isOversized ? rawEnterGate && !exitGate : rawEnterGate;
      const aboveTop = relBottom <= 0;

      // First measurement: if the element is already scrolled past the top, reveal
      // it at its terminal (entered) frame without replaying an enter tween. It is
      // above the viewport (off-screen), so infinite stays paused until a later
      // measure brings it back on-screen.
      if (!initializedRef.current) {
        initializedRef.current = true;
        if (aboveTop) {
          stopTween();
          visualMotion.set(1);
          setPhase('entered');
          setShouldRunInfiniteState(resolveInfiniteActive('entered', false));
          return;
        }
        // First-screen cold-start reveal: whatever the author placed fully inside
        // the FIRST screen must play its enter on load, before any scroll. The
        // normal gate blocks this for an element in the bottom band (e.g. a scroll
        // hint pinned near the viewport bottom): its bottom edge sits within
        // enterMargin of the viewport bottom, so the enter gate's bottom cushion
        // fails AND the bottom exit gate (reverse-scroll leave) fires —
        // resolveGatePhaseAction sees both gates and holds at idle forever, so the
        // element never appears. Those bottom margins are scroll-IN / scroll-OUT
        // cushions that don't apply to the first paint. Scoped to scene 0 only
        // (firstSceneReady === true; non-first scenes are undefined and keep the
        // strict margins). Later measures fall through to the normal margin-gated
        // machine, so scroll-driven enter/exit is unchanged.
        if (firstSceneReady === true && !isOversized && relTop >= 0 && relBottom <= vh) {
          runEnterTween();
          return;
        }
      }

      // Phase-transition decision is a pure function (resolveGatePhaseAction) so
      // the overlap-band hysteresis mutex can be proven deterministically in tests
      // without the framer-motion mock collapsing the mid-exit flash frame.
      const action = resolveGatePhaseAction(phaseRef.current, enterGate, exitGate, {
        hasExplicitExit,
        replayOnReenter,
      });
      if (action === 'enter') {
        runEnterTween();
      } else if (action === 'exit') {
        runExitTween();
      }

      // Reconcile infinite-animation activity against on-screen visibility every
      // measure. An element with no authored exitAnimation (hasExplicitExit=false)
      // never leaves 'entered' in EITHER direction, so its phase stays 'entered'
      // even after it scrolls fully off-screen — leaving infiniteAnimation (e.g.
      // pulse) running off-screen forever (wasted work). resolveInfiniteActive
      // pauses it whenever the element is not intersecting the viewport, and a
      // later measure that brings it back on-screen (still 'entered') resumes it.
      const onScreen = relBottom > 0 && relTop < vh;
      setShouldRunInfiniteState(resolveInfiniteActive(phaseRef.current, onScreen));
    },
    [
      enterMarginPx,
      exitMarginPx,
      hasExplicitExit,
      isScrollDriven,
      replayOnReenter,
      runEnterTween,
      runExitTween,
      sceneContext?.firstSceneEnterReady,
      setPhase,
      stopTween,
      visualMotion,
    ]
  );

  // Register into the scene registry for duplicate/cycle validation and the
  // drag/scroll-zone timelineDuration fold. The visibility path no longer reads
  // calculatedDelay (it observes leader completion via the enter bus instead),
  // so getCalculatedDelay is not consumed here.
  useEffect(() => {
    const registerAnimate = sceneContext?.registerAnimate;
    const unregisterAnimate = sceneContext?.unregisterAnimate;
    if (!registerAnimate || !unregisterAnimate || (!hasExplicitEnter && !hasExplicitExit)) {
      return;
    }

    registerAnimate(componentId, {
      delay,
      duration: hasExplicitEnter ? enterDuration : exitDuration,
      waitFor,
    });

    return () => {
      unregisterAnimate(componentId);
    };
  }, [
    sceneContext?.registerAnimate,
    sceneContext?.unregisterAnimate,
    componentId,
    delay,
    enterDuration,
    exitDuration,
    waitFor,
    hasExplicitEnter,
    hasExplicitExit,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (hostRef.current?.isConnected) return;

    const element =
      document.querySelector(`[data-cineview-animate-host="${componentId}"]`) ??
      document.querySelector(`[data-cineview-animate-id="${componentId}"]`);
    if (element instanceof HTMLElement) {
      if (hostRef.current !== element) {
        hostRef.current = element;
        setHostVersion((version) => version + 1);
      }
    }
  }, [componentId, enterVariant, exitVariant]);

  useEffect(() => {
    if (
      !isScrollDriven ||
      !registerZoneAnimation ||
      !unregisterZoneAnimation ||
      !zoneId ||
      (!hasExplicitEnter && !hasExplicitExit)
    ) {
      return;
    }

    registerZoneAnimation(zoneId, {
      animateId: componentId,
      delay,
      enterDuration,
      exitDuration: hasExplicitExit ? exitDuration : 0,
      waitFor,
      ...(phaseStart !== undefined || phaseEnd !== undefined
        ? {
            phase: {
              start: phaseStart,
              end: phaseEnd,
            },
          }
        : {}),
    });

    return () => {
      unregisterZoneAnimation(zoneId, componentId);
    };
  }, [
    componentId,
    delay,
    enterDuration,
    exitDuration,
    hasExplicitExit,
    hasExplicitEnter,
    isScrollDriven,
    phaseEnd,
    phaseStart,
    zoneId,
    waitFor,
    registerZoneAnimation,
    unregisterZoneAnimation,
  ]);

  useEffect(() => {
    if (isScrollDriven) {
      if (!zoneRuntime || !zoneId) {
        // driver === 'scroll' now implies mode==='scroll' + sceneControlled +
        // an inherited zoneId (see Animate.tsx resolve), so a scroll-driven
        // element without a zone is structurally impossible. Kept as a defensive
        // early-return (rest at the initial frame) rather than a warning.
        visualMotion.set(0);
        return;
      }

      const zoneState = zoneRuntime.zoneStates[zoneId];
      const budget = zoneState?.sequence.budgets[componentId];
      if (!zoneState || !budget) {
        visualMotion.set(0);
        return;
      }

      const progressPx = clamp(zoneState.progressPx, 0, zoneState.totalBudgetPx);
      const fallbackStartPx = budget.enterStartPx;
      const fallbackEndPx = Math.max(budget.enterEndPx, budget.enterStartPx + 1);
      const phaseStartPx =
        typeof budget.phaseStartPx === 'number'
          ? budget.phaseStartPx
          : resolvePhaseBoundaryPx(phaseStart, fallbackStartPx, fallbackStartPx, fallbackEndPx);
      const phaseEndPx = Math.max(
        typeof budget.phaseEndPx === 'number'
          ? budget.phaseEndPx
          : resolvePhaseBoundaryPx(phaseEnd, fallbackEndPx, fallbackStartPx, fallbackEndPx),
        phaseStartPx + 1
      );

      if (progressPx <= phaseStartPx) {
        visualMotion.set(0);
        return;
      }

      if (!budget.hasExit) {
        if (progressPx >= phaseEndPx) {
          visualMotion.set(1);
          return;
        }

        visualMotion.set(
          clamp((progressPx - phaseStartPx) / Math.max(phaseEndPx - phaseStartPx, 1), 0, 1)
        );
        return;
      }

      const exitStartPx = budget.exitStartPx ?? phaseEndPx;
      const exitEndPx = budget.exitEndPx ?? exitStartPx + 1;

      if (progressPx <= phaseEndPx) {
        visualMotion.set(
          clamp((progressPx - phaseStartPx) / Math.max(phaseEndPx - phaseStartPx, 1), 0, 1)
        );
        return;
      }

      if (progressPx <= exitStartPx) {
        visualMotion.set(1);
        return;
      }

      if (progressPx >= exitEndPx) {
        visualMotion.set(-1);
        return;
      }

      visualMotion.set(
        -clamp((progressPx - exitStartPx) / Math.max(exitEndPx - exitStartPx, 1), 0, 1)
      );
      return;
    }

    runVisibilityUpdate();
  }, [
    zoneRuntime,
    zoneId,
    componentId,
    isScrollDriven,
    visualMotion,
    enterDuration,
    phaseStart,
    phaseEnd,
    hasExplicitEnter,
    hasExplicitExit,
    replayOnReenter,
    sceneContext?.scrollProgress,
    sceneContext?.scrollTimelineState,
    zoneRuntimeVersion,
    hostVersion,
    runVisibilityUpdate,
  ]);

  useEffect(() => {
    if (isScrollDriven) {
      return;
    }

    const hostElement = hostRef.current;
    if (!(hostElement instanceof HTMLElement) || typeof window === 'undefined') {
      return;
    }

    const scrollRoot =
      hostElement.closest<HTMLElement>('[data-cineview-container="true"]') ?? window;
    return subscribeVisibilityMeasurement(scrollRoot, runVisibilityUpdate);
  }, [hostVersion, isScrollDriven, runVisibilityUpdate]);

  // Stop any in-flight enter/exit tween + pending enter-delay timer on unmount so
  // framer-motion's animate() does not fire onComplete (setState) after teardown.
  useEffect(() => stopTween, [stopTween]);

  useEffect(() => {
    if (isScrollDriven) {
      if (!zoneRuntime || !zoneId) {
        setShouldRunInfiniteState(false);
        return;
      }

      const zoneState = zoneRuntime.zoneStates[zoneId];
      const budget = zoneState?.sequence.budgets[componentId];
      const runtimeState = sceneContext?.runtimeState;
      const runtimeAllowsInfinite =
        runtimeState === undefined ||
        (runtimeState !== 'covered' &&
          runtimeState !== 'inactive' &&
          runtimeState !== 'parked' &&
          runtimeState !== 'exiting');

      if (!zoneState || !budget || !runtimeAllowsInfinite) {
        setShouldRunInfiniteState(false);
        return;
      }

      const progressPx = clamp(zoneState.progressPx, 0, zoneState.totalBudgetPx);
      const fallbackStartPx = budget.enterStartPx;
      const fallbackEndPx = Math.max(budget.enterEndPx, budget.enterStartPx + 1);
      const phaseStartPx =
        typeof budget.phaseStartPx === 'number'
          ? budget.phaseStartPx
          : resolvePhaseBoundaryPx(phaseStart, fallbackStartPx, fallbackStartPx, fallbackEndPx);
      const phaseEndPx = Math.max(
        typeof budget.phaseEndPx === 'number'
          ? budget.phaseEndPx
          : resolvePhaseBoundaryPx(phaseEnd, fallbackEndPx, fallbackStartPx, fallbackEndPx),
        phaseStartPx + 1
      );
      const hasEntered = hasExplicitEnter ? progressPx >= phaseEndPx - 0.5 : progressPx > 0.5;
      const beforeExit =
        !budget.hasExit || budget.exitStartPx === null || progressPx <= budget.exitStartPx + 0.5;

      setShouldRunInfiniteState(hasEntered && beforeExit);
      return;
    }
  }, [
    componentId,
    hasExplicitEnter,
    isScrollDriven,
    phaseEnd,
    phaseStart,
    sceneContext?.runtimeState,
    zoneId,
    zoneRuntime,
    zoneRuntime?.version,
  ]);

  const opacity = useNumericValue(visualMotion, variantsRef, 'opacity');
  const x = useMixedValue(visualMotion, variantsRef, 'x');
  const y = useMixedValue(visualMotion, variantsRef, 'y');
  const scale = useNumericValue(visualMotion, variantsRef, 'scale');
  const rotate = useMixedValue(visualMotion, variantsRef, 'rotate');
  const rotateX = useMixedValue(visualMotion, variantsRef, 'rotateX');
  const rotateY = useMixedValue(visualMotion, variantsRef, 'rotateY');
  const skewX = useMixedValue(visualMotion, variantsRef, 'skewX');
  const skewY = useMixedValue(visualMotion, variantsRef, 'skewY');
  const filter = useMixedValue(visualMotion, variantsRef, 'filter');

  return {
    style: {
      opacity,
      x,
      y,
      scale,
      rotate,
      rotateX,
      rotateY,
      skewX,
      skewY,
      filter,
    },
    shouldRunInfinite: shouldRunInfiniteState,
    visualMotion,
    phaseMotion,
  };
}
