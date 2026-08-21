import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, MotionValue, useMotionValue, useTransform } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import { useCineViewContext } from '../../context/CineViewContext';
import type { SceneContextType } from './Animate';
import type { ResolvedAnimateTimeline, NormalizedAnimateVisibility } from './animateSemantics';
import type { SceneScrollTimelineState, SceneScrollZoneRuntime } from '../Scene/sceneScrollRuntime';
import type {
  SceneAnimationRegistrationLease,
  WaitForOutcome,
} from '../Scene/useSceneAnimationRegistry';
import {
  clamp,
  getDefaultValue,
  getVariantTerminalValue,
  interpolateVariantValue,
  parseNumericValue,
  type AnimatableProperty,
  type VariantRecord,
} from './animateInterpolation';
import {
  scheduleVisibilityRecheck,
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
  /** Whether this Animate has a parsed infinite variant to gate. Without one,
   *  the zone's visual subscription is the only per-frame consumer required. */
  hasInfiniteAnimation?: boolean;
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
  /** Manual enter/exit triggers (see `AnimateProps.enterRef` / `exitRef`).
   *  Honoured on the visibility lane only — the scroll-takeover lane's progress
   *  is a pure function of scrollTop and has no tween to trigger. */
  enterRef?: MutableRefObject<(() => void) | null>;
  exitRef?: MutableRefObject<(() => void) | null>;
  /** An animation was authored but its variants have not parsed yet. The gate
   *  must not start an enter attempt against the empty variant records — it
   *  would tween through the DEFAULT frames and then swap mid-flight once the
   *  real ones land. Hold the initial frame until the parse settles. */
  variantsPending?: boolean;
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

export type GatePhase = 'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited';
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

function resolveScrollPropertyValue(
  variants: {
    enterInitial: VariantRecord;
    enterAnimate: VariantRecord;
    exitTarget: VariantRecord;
  },
  property: AnimatedProperty,
  progress: number
): number | string {
  const entering = progress >= 0;
  const record = entering ? variants.enterAnimate : variants.exitTarget;
  return interpolateVariantValue(
    getVariantTerminalValue(
      entering ? variants.enterInitial : variants.enterAnimate,
      property,
      getDefaultValue(property, entering ? 'initial' : 'animate')
    ),
    record,
    property,
    getDefaultValue(property, entering ? 'animate' : 'exit'),
    entering ? progress : Math.abs(progress)
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
  return useTransform(visualMotion, (progress) =>
    resolveScrollPropertyValue(variantsRef.current, property, progress)
  );
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
    const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
    return parseNumericValue(
      resolveScrollPropertyValue(variantsRef.current, property, progress),
      fallback
    );
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
  hasInfiniteAnimation = false,
  componentId,
  duration,
  timeline,
  visibility,
  globalEnterMargin,
  globalExitMargin,
  enterRef,
  exitRef,
  variantsPending = false,
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
  // Continuous zone progress must stay on the MotionValue lane. The keyed
  // store is still the single source written by the native scroll controller,
  // but consuming it here avoids rebuilding React effects for every frame.
  const zoneStateMotion = useMotionValue<SceneScrollTimelineState | null>(
    zoneId && zoneRuntime
      ? (zoneRuntime.store?.getKeySnapshot(zoneId) ?? zoneRuntime.zoneStates[zoneId] ?? null)
      : null
  );
  const [shouldRunInfiniteState, setShouldRunInfiniteState] = useState(false);
  const hostRef = useRef<HTMLElement | null>(null);
  const [hostVersion, setHostVersion] = useState(0);
  const registerZoneAnimation = zoneRuntime?.registerZoneAnimation;
  const unregisterZoneAnimation = zoneRuntime?.unregisterZoneAnimation;
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
  const phaseMotion = useMotionValue<GatePhase>('idle');
  const setPhase = useCallback(
    (phase: GatePhase): void => {
      phaseRef.current = phase;
      phaseMotion.set(phase);
    },
    [phaseMotion]
  );
  const registrationLeaseRef = useRef<SceneAnimationRegistrationLease | null>(null);
  const tweenControlsRef = useRef<{ stop: () => void } | null>(null);
  const tweenTokenRef = useRef(0);
  const zoneEnteredPublishedRef = useRef(false);
  const enterDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitForUnsubRef = useRef<(() => void) | null>(null);
  const recheckCancelRef = useRef<(() => void) | null>(null);
  const runVisibilityUpdateRef = useRef<(measurement?: VisibilityRootMeasurement) => void>(
    () => {}
  );
  const waitingTokenRef = useRef(0);
  const waitingAttemptRef = useRef<{
    token: number;
    origin: 'idle' | 'exited' | 'exiting';
    dependencyReady: boolean;
    delayStarted: boolean;
    delayReady: boolean;
    coldStartBypass: boolean;
  } | null>(null);
  const initializedRef = useRef(false);
  // A default first-screen timeout performs one static reveal. This ref makes
  // that recovery an initialization event rather than a permanent gate, so
  // later measurements can still drive exit/re-entry and infinite lifecycle.
  const staticFallbackAppliedRef = useRef(false);

  const readZoneState = useCallback((): SceneScrollTimelineState | null => {
    if (!zoneRuntime || !zoneId) return null;
    return zoneRuntime.store?.getKeySnapshot(zoneId) ?? zoneRuntime.zoneStates[zoneId] ?? null;
  }, [zoneId, zoneRuntime]);

  useEffect(() => {
    if (!isScrollDriven || !zoneRuntime || !zoneId) {
      zoneStateMotion.set(null);
      return;
    }

    const publish = (): void => {
      zoneStateMotion.set(readZoneState());
    };
    publish();
    return zoneRuntime.store?.subscribeKey(zoneId, publish);
  }, [isScrollDriven, readZoneState, zoneId, zoneRuntime, zoneStateMotion]);

  // ── Manual control: enterRef / exitRef ─────────────────────────────────────
  //
  // Only the VISIBILITY lane can honour a manual trigger. On the scroll-takeover
  // lane visualMotion is a pure function of the zone's progressPx (single owner =
  // scroll position, CLAUDE.md rule 2), so a manual write would be overwritten on
  // the next scroll frame; Animate.tsx reports that misuse instead of pretending
  // it works.
  //
  // `waitFor` / `delay` double as the opt-in FALLBACK switch:
  //   enterRef + (waitFor|delay)  → the gate may still fire on its own after the
  //                                 wait (fallback), and a manual call preempts it.
  //   enterRef + neither          → the element holds at its initial frame forever
  //                                 until the consumer calls enterRef.current().
  // exitRef always disables the automatic exit gate: passing it means "I own when
  // this leaves", and there is no "auto-exit after a timeout" semantic to fall back on.
  const hasManualEnter = Boolean(enterRef) && !isScrollDriven;
  const hasManualExit = Boolean(exitRef) && !isScrollDriven;
  const enterFallbackAuthored = Boolean(waitFor) || delay > 0;
  const autoEnterSuppressed = hasManualEnter && !enterFallbackAuthored;
  const autoExitSuppressed = hasManualExit;
  // Manual ownership is sticky: once the consumer has driven the enter, the gate
  // never re-fires it on its own (an auto replay would fight the owner).
  const manualEnterUsedRef = useRef(false);
  // ⚠️ A manual EXIT must be sticky too. `autoExitSuppressed` only closes the exit
  // gate; the enter gate stays open, and `replayOnReenter` defaults to true — so an
  // element told to leave while still inside the viewport gets pulled straight back
  // in on the very next scroll tick. That is precisely the intended use ("this is
  // mine, it leaves when I say"), so exiting by hand claims the enter gate as well.
  const manualExitUsedRef = useRef(false);

  const publishEnterCompleted = useCallback(
    (lease: SceneAnimationRegistrationLease | null): void => {
      lease?.publishEnterCompleted();
    },
    []
  );

  const clearPendingEnter = useCallback((): void => {
    waitingTokenRef.current += 1;
    waitingAttemptRef.current = null;
    if (enterDelayTimerRef.current) {
      clearTimeout(enterDelayTimerRef.current);
      enterDelayTimerRef.current = null;
    }
    if (waitForUnsubRef.current) {
      waitForUnsubRef.current();
      waitForUnsubRef.current = null;
    }
    if (recheckCancelRef.current) {
      recheckCancelRef.current();
      recheckCancelRef.current = null;
    }
  }, []);

  const stopTween = useCallback(() => {
    tweenTokenRef.current += 1;
    if (tweenControlsRef.current) {
      tweenControlsRef.current.stop();
      tweenControlsRef.current = null;
    }
    clearPendingEnter();
  }, [clearPendingEnter]);

  const scheduleCurrentGateRecheck = useCallback((): void => {
    const hostElement = hostRef.current;
    const ownerWindow = hostElement?.ownerDocument?.defaultView;
    if (!ownerWindow) return;
    recheckCancelRef.current?.();
    recheckCancelRef.current = scheduleVisibilityRecheck(ownerWindow, () => {
      recheckCancelRef.current = null;
      runVisibilityUpdateRef.current();
    });
  }, []);

  const runEnterTween = useCallback(() => {
    clearPendingEnter();
    setPhase('entering');
    if (visualMotion.get() < 0) {
      visualMotion.set(0);
    }
    const completionLease = registrationLeaseRef.current;
    const tweenToken = ++tweenTokenRef.current;
    const controls = animate(visualMotion, 1, {
      duration: Math.max(enterDuration, 0) / 1000,
      ease: 'easeInOut',
      onComplete: () => {
        if (tweenTokenRef.current !== tweenToken) return;
        tweenControlsRef.current = null;
        setPhase('entered');
        publishEnterCompleted(completionLease);
        setShouldRunInfiniteState(true);
      },
    });
    tweenControlsRef.current = controls;
  }, [clearPendingEnter, enterDuration, publishEnterCompleted, setPhase, visualMotion]);

  const beginEnterAttempt = useCallback(
    (coldStartBypass = false): void => {
      const currentPhase = phaseRef.current;
      const origin: 'idle' | 'exited' | 'exiting' =
        currentPhase === 'exited' ? 'exited' : currentPhase === 'exiting' ? 'exiting' : 'idle';
      stopTween();
      const attempt = {
        token: ++waitingTokenRef.current,
        origin,
        dependencyReady: !waitFor,
        delayStarted: false,
        delayReady: false,
        coldStartBypass,
      };
      waitingAttemptRef.current = attempt;
      setPhase('waiting');
      setShouldRunInfiniteState(false);

      const handleOutcome = (outcome: WaitForOutcome): void => {
        if (waitingAttemptRef.current?.token !== attempt.token || outcome.kind === 'pending')
          return;
        attempt.dependencyReady = true;
        waitForUnsubRef.current = null;
        scheduleCurrentGateRecheck();
      };

      if (!waitFor) return;
      const lease = registrationLeaseRef.current;
      if (lease) {
        waitForUnsubRef.current = lease.observeWaitFor(handleOutcome);
      } else {
        handleOutcome({ kind: 'invalid', leaderId: waitFor, reason: 'missing' });
      }
    },
    [scheduleCurrentGateRecheck, setPhase, stopTween, waitFor]
  );

  const advanceEnterAttempt = useCallback((): void => {
    const attempt = waitingAttemptRef.current;
    if (!attempt || !attempt.dependencyReady) return;
    if (!attempt.delayStarted) {
      attempt.delayStarted = true;
      if (delay > 0) {
        const token = attempt.token;
        enterDelayTimerRef.current = setTimeout(() => {
          enterDelayTimerRef.current = null;
          if (waitingAttemptRef.current?.token !== token) return;
          attempt.delayReady = true;
          scheduleCurrentGateRecheck();
        }, delay);
        return;
      }
      attempt.delayReady = true;
    }
    if (attempt.delayReady) runEnterTween();
  }, [delay, runEnterTween, scheduleCurrentGateRecheck]);

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
    const tweenToken = ++tweenTokenRef.current;
    const controls = animate(visualMotion, -1, {
      duration: Math.max(exitDuration, 0) / 1000,
      ease: 'easeInOut',
      onComplete: () => {
        if (tweenTokenRef.current !== tweenToken) return;
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

      // Authored-but-unparsed: hold the initial frame and run no gate logic. The
      // element is already in the DOM (same shape as post-parse, see the FOUC
      // guard in Animate.tsx), but starting an enter attempt now would tween the
      // empty variant defaults and swap targets mid-flight when the parse lands.
      if (variantsPending) {
        return;
      }

      const hostElement = hostRef.current;
      if (!(hostElement instanceof HTMLElement)) {
        return;
      }

      // First-screen gate has four distinguishable states:
      //   known=false               -> the scroll store has not published yet;
      //                                hold initial without consuming the gate.
      //   active=true, ready=false  -> assets are pending (or timeout was handled);
      //                                hold initial.
      //   ready=true                -> play the authored visibility enter.
      //   active=false, ready=false -> default timeout recovery: reveal terminal
      //                                once, then resume normal exit/infinite life.
      // Undefined remains the non-first-scene, ungated path.
      const firstSceneGateKnown = sceneContext?.firstSceneEnterGateKnown;
      const firstSceneReady = sceneContext?.firstSceneEnterReady;
      const firstSceneActive = sceneContext?.firstSceneEnterActive;
      if (firstSceneGateKnown === false) {
        stopTween();
        visualMotion.set(0);
        setPhase('idle');
        setShouldRunInfiniteState(false);
        return;
      }
      if (firstSceneReady === false && firstSceneActive === true) {
        staticFallbackAppliedRef.current = false;
        stopTween();
        visualMotion.set(0);
        setPhase('idle');
        setShouldRunInfiniteState(false);
        return;
      }

      const applyStaticFallback =
        firstSceneReady === false &&
        firstSceneActive === false &&
        !staticFallbackAppliedRef.current &&
        // A consumer-owned enter must not be revealed by the cold-start timeout
        // recovery either — "never show it until I say so" includes this path.
        !autoEnterSuppressed;
      if (applyStaticFallback) {
        staticFallbackAppliedRef.current = true;
        initializedRef.current = true;
        stopTween();
        visualMotion.set(1);
        setPhase('entered');
        publishEnterCompleted(registrationLeaseRef.current);
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
      const onScreen = relBottom > 0 && relTop < vh;

      // Static timeout recovery owns this measurement: show the terminal frame
      // even when the element currently overlaps an exit band. Future measurements
      // rejoin the normal gate machine, so authored exit/re-entry remains available.
      if (applyStaticFallback) {
        setShouldRunInfiniteState(resolveInfiniteActive('entered', onScreen));
        return;
      }

      // First measurement: if the element is already scrolled past the top, reveal
      // it at its terminal (entered) frame without replaying an enter tween. It is
      // above the viewport (off-screen), so infinite stays paused until a later
      // measure brings it back on-screen.
      if (!initializedRef.current) {
        initializedRef.current = true;
        // Consumer-owned enter with no authored fallback: hold the initial frame
        // on the first measurement too. Neither the above-top terminal reveal nor
        // the first-screen cold-start bypass may show it before enterRef fires.
        if (autoEnterSuppressed) {
          setShouldRunInfiniteState(false);
          return;
        }
        if (aboveTop) {
          stopTween();
          visualMotion.set(1);
          setPhase('entered');
          publishEnterCompleted(registrationLeaseRef.current);
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
          beginEnterAttempt(true);
          advanceEnterAttempt();
          return;
        }
      }

      // A waiting attempt is not a running tween. Every measurement revalidates
      // eligibility; leaving the gate cancels all pending dependency/delay work.
      if (phaseRef.current === 'waiting') {
        const attempt = waitingAttemptRef.current;
        const coldStartEligible =
          attempt?.coldStartBypass === true &&
          firstSceneReady === true &&
          !isOversized &&
          relTop >= 0 &&
          relBottom <= vh;
        if (!attempt || (!coldStartEligible && (!enterGate || exitGate))) {
          const origin = attempt?.origin ?? 'idle';
          clearPendingEnter();
          setPhase(origin);
        } else {
          advanceEnterAttempt();
        }
      } else {
        // Phase-transition decision is a pure function (resolveGatePhaseAction) so
        // the overlap-band hysteresis mutex can be proven deterministically in tests.
        const action = resolveGatePhaseAction(phaseRef.current, enterGate, exitGate, {
          hasExplicitExit,
          replayOnReenter,
        });
        // Manual ownership wins over the gate: a suppressed lane never auto-fires,
        // and a lane the consumer has already driven never auto-replays.
        if (
          action === 'enter' &&
          !autoEnterSuppressed &&
          !manualEnterUsedRef.current &&
          !manualExitUsedRef.current
        ) {
          beginEnterAttempt();
          advanceEnterAttempt();
        } else if (action === 'exit' && !autoExitSuppressed) {
          runExitTween();
        }
      }

      // Reconcile infinite-animation activity against on-screen visibility every
      // measure. An element with no authored exitAnimation (hasExplicitExit=false)
      // never leaves 'entered' in EITHER direction, so its phase stays 'entered'
      // even after it scrolls fully off-screen — leaving infiniteAnimation (e.g.
      // pulse) running off-screen forever (wasted work). resolveInfiniteActive
      // pauses it whenever the element is not intersecting the viewport, and a
      // later measure that brings it back on-screen (still 'entered') resumes it.
      setShouldRunInfiniteState(resolveInfiniteActive(phaseRef.current, onScreen));
    },
    [
      advanceEnterAttempt,
      autoEnterSuppressed,
      autoExitSuppressed,
      beginEnterAttempt,
      clearPendingEnter,
      enterMarginPx,
      exitMarginPx,
      hasExplicitExit,
      isScrollDriven,
      publishEnterCompleted,
      replayOnReenter,
      runExitTween,
      sceneContext?.firstSceneEnterGateKnown,
      sceneContext?.firstSceneEnterActive,
      sceneContext?.firstSceneEnterReady,
      setPhase,
      stopTween,
      variantsPending,
      visualMotion,
    ]
  );
  runVisibilityUpdateRef.current = runVisibilityUpdate;

  // Manual triggers. Both preempt whatever is in flight: `runEnterTween` clears a
  // pending waitFor/delay attempt before starting, and a fresh `animate()` on the
  // same MotionValue supersedes a running tween (the token bump makes the stale
  // onComplete a no-op). "Interrupt" therefore means "drop the rest of this
  // timeline and play now" — never "restart the wait".
  const triggerManualEnter = useCallback((): void => {
    manualEnterUsedRef.current = true;
    // 消费者重新要求它出现 ⇒ 解除上一次手动退场的所有权，否则再也回不来。
    manualExitUsedRef.current = false;
    // Both flags are initialization bookkeeping: taking manual ownership counts as
    // having initialized, so a later measurement cannot re-run the first-measure
    // reveal on top of the consumer's frame.
    initializedRef.current = true;
    staticFallbackAppliedRef.current = true;
    runEnterTween();
  }, [runEnterTween]);

  const triggerManualExit = useCallback((): void => {
    manualExitUsedRef.current = true;
    runExitTween();
  }, [runExitTween]);

  useEffect(() => {
    if (!enterRef || isScrollDriven) return;
    enterRef.current = triggerManualEnter;
    return () => {
      if (enterRef.current === triggerManualEnter) enterRef.current = null;
    };
  }, [enterRef, isScrollDriven, triggerManualEnter]);

  useEffect(() => {
    if (!exitRef || isScrollDriven) return;
    exitRef.current = triggerManualExit;
    return () => {
      if (exitRef.current === triggerManualExit) exitRef.current = null;
    };
  }, [exitRef, isScrollDriven, triggerManualExit]);

  // Register once per authored timing configuration. The returned lease owns
  // completion, dependency observation and disposal for this exact generation.
  useEffect(() => {
    const registerAnimate = sceneContext?.registerAnimate;
    const unregisterAnimate = sceneContext?.unregisterAnimate;
    if (!registerAnimate || (!hasExplicitEnter && !hasExplicitExit)) {
      return;
    }

    const lease = registerAnimate(componentId, {
      delay,
      duration: hasExplicitEnter ? enterDuration : exitDuration,
      waitFor,
      driver: isScrollDriven ? 'scroll' : 'visibility',
    });
    registrationLeaseRef.current = lease ?? null;
    zoneEnteredPublishedRef.current = false;

    return () => {
      clearPendingEnter();
      if (registrationLeaseRef.current === lease) {
        registrationLeaseRef.current = null;
      }
      if (lease?.dispose) {
        lease.dispose();
      } else {
        unregisterAnimate?.(componentId);
      }
    };
  }, [
    sceneContext?.registerAnimate,
    sceneContext?.unregisterAnimate,
    clearPendingEnter,
    componentId,
    delay,
    enterDuration,
    exitDuration,
    waitFor,
    hasExplicitEnter,
    hasExplicitExit,
    isScrollDriven,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Do not adopt the host (and therefore do not subscribe to scroll
    // measurement) until the authored variants have parsed. The FOUC guard mounts
    // the element early so the DOM shape never changes, but the gate machine must
    // still start at the same point in the lifecycle it always did.
    if (variantsPending) return;
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
  }, [componentId, enterVariant, exitVariant, variantsPending]);

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

    const registrationOwner = registerZoneAnimation(zoneId, {
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
      unregisterZoneAnimation(zoneId, componentId, registrationOwner);
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

  const applyScrollZoneState = useCallback(
    (zoneState: SceneScrollTimelineState | null): void => {
      // S-F6: an Animate with no authored enter/exit (e.g. infiniteAnimation
      // only) never registers a zone budget, so the budget lookup below can
      // never succeed. Holding it at the initial frame (visualMotion 0) made it
      // permanently invisible inside a takeover zone (empty variants default
      // opacity to 0 at the initial frame) while the exact same element rendered
      // fine on the visibility path. There is nothing to scrub for it — it rests
      // at its entered frame (localProgress = 1 semantics: empty-variant
      // defaults resolve to opacity 1 / neutral transform). Phase mirrors the
      // rest state so the render-prop bridge and the per-scene enter bus see it
      // as entered (a follower waitFor-ing it is not deadlocked).
      if (!hasExplicitEnter && !hasExplicitExit) {
        if (visualMotion.get() !== 1) visualMotion.set(1);
        if (phaseRef.current !== 'entered') {
          setPhase('entered');
        }
        return;
      }

      if (!zoneRuntime || !zoneId) {
        // driver === 'scroll' now implies mode==='scroll' + sceneControlled +
        // an inherited zoneId (see Animate.tsx resolve), so a scroll-driven
        // element without a zone is structurally impossible. Kept as a defensive
        // early-return (rest at the initial frame) rather than a warning.
        if (visualMotion.get() !== 0) visualMotion.set(0);
        return;
      }

      const budget = zoneState?.sequence.budgets[componentId];
      if (!zoneState || !budget) {
        if (visualMotion.get() !== 0) visualMotion.set(0);
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

      // Publish enter completion through this registration's lease the first
      // time progress crosses the element's enter end. A visibility follower
      // can then observe the same generation-scoped completion fact used by
      // other drivers. Ref-gated to publish exactly once and never retract on
      // reverse scrub. Missing targets are diagnosed by the scene registry.
      if (progressPx >= phaseEndPx && !zoneEnteredPublishedRef.current) {
        zoneEnteredPublishedRef.current = true;
        publishEnterCompleted(registrationLeaseRef.current);
      }

      if (progressPx <= phaseStartPx) {
        if (visualMotion.get() !== 0) visualMotion.set(0);
        return;
      }

      if (!budget.hasExit) {
        if (progressPx >= phaseEndPx) {
          if (visualMotion.get() !== 1) visualMotion.set(1);
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
        if (visualMotion.get() !== 1) visualMotion.set(1);
        return;
      }

      if (progressPx >= exitEndPx) {
        if (visualMotion.get() !== -1) visualMotion.set(-1);
        return;
      }

      visualMotion.set(
        -clamp((progressPx - exitStartPx) / Math.max(exitEndPx - exitStartPx, 1), 0, 1)
      );
    },
    [
      componentId,
      hasExplicitEnter,
      hasExplicitExit,
      phaseEnd,
      phaseStart,
      publishEnterCompleted,
      setPhase,
      visualMotion,
      zoneId,
      zoneRuntime,
    ]
  );

  useEffect(() => {
    if (!isScrollDriven) return;

    const update = (): void => applyScrollZoneState(zoneStateMotion.get());
    update();
    // Infinite-only lanes have no progress-dependent visual state. Avoid even
    // the MotionValue callback on every frame; their phase is scene-owned.
    if (!hasExplicitEnter && !hasExplicitExit) return;
    return zoneStateMotion.on('change', update);
  }, [applyScrollZoneState, hasExplicitEnter, hasExplicitExit, isScrollDriven, zoneStateMotion]);

  useEffect(() => {
    if (isScrollDriven) return;
    runVisibilityUpdate();
  }, [
    hostVersion,
    isScrollDriven,
    runVisibilityUpdate,
    sceneContext?.scrollProgress,
    sceneContext?.scrollTimelineState,
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

  const infiniteStateRef = useRef(false);
  const updateInfiniteState = useCallback(
    (zoneState: SceneScrollTimelineState | null): void => {
      if (!hasInfiniteAnimation || !isScrollDriven || !zoneRuntime || !zoneId) {
        if (infiniteStateRef.current) {
          infiniteStateRef.current = false;
          setShouldRunInfiniteState(false);
        }
        return;
      }

      const runtimeState = sceneContext?.runtimeState;
      const runtimeAllowsInfinite =
        runtimeState === undefined ||
        (runtimeState !== 'covered' &&
          runtimeState !== 'inactive' &&
          runtimeState !== 'parked' &&
          runtimeState !== 'exiting');

      // S-F6: an infinite-only element (no authored enter/exit) has no zone
      // budget by design — it rests at its entered frame (see the visualMotion
      // effect above), so its loop is gated purely by the scene runtime state.
      if (!hasExplicitEnter && !hasExplicitExit) {
        if (infiniteStateRef.current !== runtimeAllowsInfinite) {
          infiniteStateRef.current = runtimeAllowsInfinite;
          setShouldRunInfiniteState(runtimeAllowsInfinite);
        }
        return;
      }

      const budget = zoneState?.sequence.budgets[componentId];
      if (!zoneState || !budget || !runtimeAllowsInfinite) {
        if (infiniteStateRef.current) {
          infiniteStateRef.current = false;
          setShouldRunInfiniteState(false);
        }
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
      const next = hasEntered && beforeExit;
      if (infiniteStateRef.current !== next) {
        infiniteStateRef.current = next;
        setShouldRunInfiniteState(next);
      }
    },
    [
      componentId,
      hasExplicitEnter,
      hasExplicitExit,
      hasInfiniteAnimation,
      isScrollDriven,
      phaseEnd,
      phaseStart,
      sceneContext?.runtimeState,
      setShouldRunInfiniteState,
      zoneId,
      zoneRuntime,
    ]
  );

  useEffect(() => {
    if (!isScrollDriven || !hasInfiniteAnimation) {
      updateInfiniteState(null);
      return;
    }

    updateInfiniteState(zoneStateMotion.get());
    if (!hasExplicitEnter && !hasExplicitExit) return;
    return zoneStateMotion.on('change', updateInfiniteState);
  }, [
    hasExplicitEnter,
    hasExplicitExit,
    hasInfiniteAnimation,
    isScrollDriven,
    updateInfiniteState,
    zoneStateMotion,
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
