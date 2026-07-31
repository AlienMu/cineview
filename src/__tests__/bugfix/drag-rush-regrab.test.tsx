/**
 * D-F1/D-F7 regression — rush re-grab (pointerdown DURING the release settle
 * window), the acceptance FAIL found on trusted CDP touch input: three rapid
 * grab-after-release cycles produced single-frame whole-stack jumps of -307px
 * (dt=14ms, finger displacement 0 in that window) and all three committed.
 *
 * Root cause: the re-grab FLUSH-COMMITTED the in-flight release — it finalized
 * the page at the release ratio while the render lane still had remaining
 * progress, so the whole stack teleported by that remainder in ONE frame. It
 * also diverged from mouse input, which absorbed the same grab as a scrub.
 *
 * POST-FIX spec (takeover, asserted here):
 *  - a re-grab NEVER commits: the in-flight lane is STOPPED where it stands and
 *    the page freezes under the finger (no teleport, no index change),
 *  - the gesture continues from that frozen render position — progress =
 *    frozen base + finger delta — and the normal threshold rules decide at
 *    release, so a continued push commits forward and a scrub-back reverses,
 *  - a tap (press + release without movement) neither snaps nor drops the
 *    release: the preempted element-track settle is RESUMED from the preempt
 *    point (a continuation — never a replay from 0) and completes to T,
 *  - a takeover scrubbed all the way back to rest ABANDONS the transition
 *    pre-commit (bounce rewind, index unchanged).
 */
import React, { createRef } from 'react';
import { act, createEvent, fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

interface RecordedAnimateCall {
  isMotion: boolean;
  fromValue: number;
  target: number;
  stopped: boolean;
  completed: boolean;
  onUpdate?: (latest: number) => void;
  onComplete?: () => void;
  complete: () => void;
}

const animateCalls: RecordedAnimateCall[] = [];
const mockOpacityMotions = new Map<string, { get: () => unknown }>();

function readAnimateOpacity(animateId: string): number {
  const value = mockOpacityMotions.get(animateId)?.get();
  expect(typeof value).toBe('number');
  return value as number;
}

jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');

  const createMotionValueStub = <T,>(initial: T) => {
    let current = initial;
    const listeners = new Set<(value: T) => void>();
    return {
      get: () => current,
      set: (value: T) => {
        current = value;
        listeners.forEach((listener) => listener(current));
      },
      on: (event: string, listener: (value: T) => void) => {
        if (event !== 'change') {
          return () => undefined;
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  const MotionDiv = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>): React.ReactElement => {
      const {
        children,
        // framer-only props stripped from the DOM element:
        initial: _initial,
        animate: _animate,
        exit: _exit,
        variants: _variants,
        transition: _transition,
        onPanStart: _onPanStart,
        onPan: _onPan,
        onPanEnd: _onPanEnd,
        // style may contain MotionValue stubs — drop it (jsdom needs no layout)
        style: _style,
        ...rest
      } = props;
      const animateId = rest['data-cineview-animate-id'];
      const opacity =
        _style && typeof _style === 'object'
          ? (_style as Record<string, unknown>).opacity
          : undefined;
      if (
        typeof animateId === 'string' &&
        opacity &&
        typeof opacity === 'object' &&
        typeof (opacity as { get?: unknown }).get === 'function'
      ) {
        mockOpacityMotions.set(animateId, opacity as { get: () => unknown });
      }
      return React.createElement('div', { ref, ...rest }, children as React.ReactNode);
    }
  );
  MotionDiv.displayName = 'MotionDiv';

  return {
    __esModule: true,
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: React.PropsWithChildren) =>
      React.createElement(React.Fragment, null, children),
    useAnimation: () => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      set: jest.fn(),
      mount: jest.fn(),
    }),
    // Memoized per call site like the real hook — a fresh stub per render would
    // silently reset scene-owned tracks (elementElapsedMotion) to 0.
    useMotionValue: <T,>(initial: T) => {
      // `React` here is the untyped require above — no type arguments.
      const ref = React.useRef(null);
      if (ref.current === null) {
        ref.current = createMotionValueStub(initial);
      }
      return ref.current;
    },
    useMotionValueEvent: (
      value: { on?: (event: string, cb: (v: unknown) => void) => () => void },
      event: string,
      callback: (v: unknown) => void
    ) => {
      React.useEffect(() => value.on?.(event, callback));
    },
    useTransform: (
      source: {
        get: () => unknown;
        on?: (event: string, listener: (value: unknown) => void) => () => void;
      },
      transform: (value: unknown) => unknown
    ) => {
      const ref = React.useRef(null);
      if (ref.current === null) {
        ref.current = createMotionValueStub(transform(source.get()));
      }
      const motionValue = ref.current;
      React.useEffect(
        () =>
          source.on?.('change', (value: unknown) => {
            motionValue.set(transform(value));
          }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
      );
      return motionValue;
    },
    // Step-driver animate: records every call, never auto-completes. Tests
    // drive settle/bounce/element-track tweens manually so the in-flight
    // release window (the rush re-grab target) can be held open.
    animate: (
      value: { get: () => number; set: (next: number) => void } | number,
      target: number,
      options?: { onUpdate?: (latest: number) => void; onComplete?: () => void }
    ) => {
      const isMotion = typeof value === 'object' && value !== null;
      const call: RecordedAnimateCall = {
        isMotion,
        fromValue: isMotion ? (value as { get: () => number }).get() : (value as number),
        target,
        stopped: false,
        completed: false,
        onUpdate: options?.onUpdate,
        onComplete: options?.onComplete,
        complete: () => {
          if (call.stopped || call.completed) return;
          call.completed = true;
          if (isMotion) (value as { set: (next: number) => void }).set(target);
          options?.onUpdate?.(target);
          options?.onComplete?.();
        },
      };
      animateCalls.push(call);
      return {
        stop: () => {
          call.stopped = true;
        },
      };
    },
  };
});

import { Animate, AnimateVideo, CineView, Scene } from '../../index';
import type { CineViewRef } from '../../types';

const videoTimes = new WeakMap<HTMLMediaElement, number>();

Object.defineProperties(HTMLMediaElement.prototype, {
  duration: {
    configurable: true,
    get: () => 10,
  },
  readyState: {
    configurable: true,
    get: () => 1,
  },
  currentTime: {
    configurable: true,
    get(this: HTMLMediaElement) {
      return videoTimes.get(this) ?? 0;
    },
    set(this: HTMLMediaElement, value: number) {
      videoTimes.set(this, value);
    },
  },
});

function readVideoTime(index: number): number {
  const video = document.querySelector(`[aria-label="drag-video-${index}"]`);
  expect(video).toBeInstanceOf(HTMLVideoElement);
  return (video as HTMLVideoElement).currentTime;
}

const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

const VIEWPORT = window.innerHeight; // 768 in jsdom

function firePointer(
  element: Element,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  values: Record<string, number | boolean>
): void {
  const event = createEvent[type](element);
  Object.entries({ isPrimary: true, button: 0, clientX: 100, ...values }).forEach(
    ([key, value]) => {
      Object.defineProperty(event, key, { configurable: true, value });
    }
  );
  fireEvent(element, event);
}

function sceneWrapper(index: number): HTMLElement {
  const wrapper = document.querySelector(`[data-scene-index="${index}"]`) as HTMLElement | null;
  expect(wrapper).not.toBeNull();
  return wrapper as HTMLElement;
}

function sceneSurface(index: number): HTMLElement {
  const surface = sceneWrapper(index).firstElementChild as HTMLElement | null;
  expect(surface).not.toBeNull();
  return surface as HTMLElement;
}

/**
 * The stack's translate offset for a scene, in percent. Read numerically: the
 * offset is computed from a float renderProgress, so exact string matching is
 * brittle (0.1 of finger travel renders as `9.999999999999998%`).
 */
function sceneOffsetPercent(index: number): number {
  const transform = sceneWrapper(index).style.transform;
  const match = /translate3d\(0, (-?[\d.e-]+)%, 0\)/.exec(transform);
  expect(match).not.toBeNull();
  return Number((match as RegExpExecArray)[1]);
}

function renderLaneCalls(): RecordedAnimateCall[] {
  return animateCalls.filter((call) => !call.isMotion);
}

function elementTrackCalls(): RecordedAnimateCall[] {
  return animateCalls.filter((call) => call.isMotion);
}

/** Flush pending microtasks/timers inside act (async variant parsing, scene
 * mounts at commit) so no state update lands outside an act() boundary. */
async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderHarness(): Promise<React.RefObject<CineViewRef>> {
  const cineViewRef = createRef<CineViewRef>();
  render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
      config={{ size: 750 }}
    >
      {[0, 1, 2].map((index) => (
        <Scene key={index} sceneId={`scene-${index}`}>
          <Animate animateId={`title-${index}`} enterAnimation="fade-in" duration={{ enter: 4000 }}>
            <h1>Scene {index}</h1>
          </Animate>
          <AnimateVideo
            src={`/drag-video-${index}.mp4`}
            aria-label={`drag-video-${index}`}
            animateId={`video-${index}`}
            duration={{ enter: 4000 }}
            preload={false}
          />
        </Scene>
      ))}
    </CineView>
  );

  await waitFor(() => {
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
  });
  // Let async animation parsing + registry registration settle so scene
  // timelines (T = 4000) are known before the gesture starts.
  await flushAsync();
  return cineViewRef;
}

/**
 * Drag scene 0 upward past the threshold and release, leaving the settle
 * page-slide in flight (the step-driver mock never auto-completes it).
 * Returns the element-track settle continuation created by the release.
 */
function releaseIntoSettle(): RecordedAnimateCall {
  const surface = sceneSurface(0);
  const startY = 600;
  const ownershipY = startY - 1;
  const endY = ownershipY - VIEWPORT / 2; // post-ownership drag ratio exactly 0.5
  const trackCallsBefore = elementTrackCalls().length;

  firePointer(surface, 'pointerDown', { pointerId: 1, clientY: startY });
  firePointer(surface, 'pointerMove', { pointerId: 1, clientY: ownershipY });
  firePointer(surface, 'pointerMove', { pointerId: 1, clientY: endY });
  firePointer(surface, 'pointerUp', { pointerId: 1, clientY: endY });

  // The release published a settle directive: the incoming scene's element
  // track starts its continuation, and the render lane starts the page slide.
  const settleTrackCalls = elementTrackCalls().slice(trackCallsBefore);
  expect(settleTrackCalls.length).toBe(1);
  const renderLane = renderLaneCalls().slice(-1)[0];
  expect(renderLane).toBeDefined();
  expect(renderLane.target).toBe(1);
  expect(renderLane.completed).toBe(false);
  return settleTrackCalls[0];
}

describe('D-F1: rush re-grab during the release settle window', () => {
  beforeEach(() => {
    animateCalls.length = 0;
    mockOpacityMotions.clear();
    jest.clearAllMocks();
  });

  it('takes the in-flight release over instead of flush-committing: no teleport, and continuing the push commits forward once', async () => {
    const cineViewRef = await renderHarness();
    releaseIntoSettle();
    expect(cineViewRef.current?.getCurrentScene()).toBe(0); // commit pending

    // The settle page-slide advanced the page from the 0.5 release ratio toward
    // 1 — freeze it partway (0.8) so the takeover has a real remainder to NOT
    // teleport through.
    const inFlightLane = renderLaneCalls().slice(-1)[0];
    act(() => {
      inFlightLane.onUpdate?.(0.8);
    });
    expect(sceneWrapper(0).style.transform).toBe('translate3d(0, -80%, 0)');

    // Rush re-grab while the slide is in flight. Takeover: the lane is stopped
    // where it stands, the index does NOT change (no flush-commit), and the
    // page does NOT jump — the frozen 0.8 is held under the finger.
    const surface = sceneSurface(0);
    firePointer(surface, 'pointerDown', { pointerId: 2, clientY: 500 });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(inFlightLane.stopped).toBe(true);
    expect(sceneWrapper(0).style.transform).toBe('translate3d(0, -80%, 0)');

    // A late frame of the stopped lane is inert — it can never commit.
    act(() => {
      inFlightLane.complete();
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);

    // The first directional frame acquires ownership and becomes the zero
    // baseline. The next frame adds +0.1 on top of frozen 0.8 -> 0.9.
    firePointer(surface, 'pointerMove', { pointerId: 2, clientY: 499 });
    firePointer(surface, 'pointerMove', { pointerId: 2, clientY: 499 - VIEWPORT / 10 });
    expect(sceneOffsetPercent(0)).toBeCloseTo(-90, 6);
    expect(sceneOffsetPercent(1)).toBeCloseTo(10, 6);

    // Releasing past the threshold runs the normal decision and commits ONCE.
    firePointer(surface, 'pointerUp', { pointerId: 2, clientY: 499 - VIEWPORT / 10 });
    const newRenderLane = renderLaneCalls().slice(-1)[0];
    expect(newRenderLane).not.toBe(inFlightLane);
    expect(newRenderLane.target).toBe(1); // forward page slide
    const transformBeforeCommit = [
      sceneWrapper(0).style.transform,
      sceneWrapper(1).style.transform,
    ];
    const incomingOpacityBeforeCommit = readAnimateOpacity('title-1');
    expect(incomingOpacityBeforeCommit).toBeGreaterThan(0);
    act(() => {
      newRenderLane.complete();
      // React has not flushed currentScene=1 yet. The old coordinate system must
      // remain completely untouched inside this callback; a command-style
      // relative-progress reset would synchronously jump it to [0%, 100%].
      expect([sceneWrapper(0).style.transform, sceneWrapper(1).style.transform]).toEqual(
        transformBeforeCommit
      );
      // The incoming element track must stay on the same visual frame too. A
      // hidden/initial handoff here would flash the content even if wrappers stay put.
      expect(readAnimateOpacity('title-1')).toBeCloseTo(incomingOpacityBeforeCommit, 6);
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    expect(sceneWrapper(0).style.transform).toBe('translate3d(0, -100%, 0)');
    expect(sceneWrapper(1).style.transform).toBe('translate3d(0, 0%, 0)');
    expect(readAnimateOpacity('title-1')).toBeCloseTo(incomingOpacityBeforeCommit, 6);
    await flushAsync();
    expect(readAnimateOpacity('title-1')).toBeCloseTo(incomingOpacityBeforeCommit, 6);
  });

  it('lets the incoming scene engine take over the shared release lane without teleporting', async () => {
    const cineViewRef = await renderHarness();
    releaseIntoSettle();

    const inFlightLane = renderLaneCalls().slice(-1)[0];
    act(() => {
      inFlightLane.onUpdate?.(0.8);
    });

    // The incoming scene covers the visible lower part of the viewport while the
    // release is in flight. Dispatch directly to its surface so this exercises a
    // different Scene engine from the one that created the shared render lane.
    const incomingSurface = sceneSurface(1);
    firePointer(incomingSurface, 'pointerDown', { pointerId: 31, clientY: 500 });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(inFlightLane.stopped).toBe(true);
    expect(sceneOffsetPercent(0)).toBeCloseTo(-80, 6);
    expect(sceneOffsetPercent(1)).toBeCloseTo(20, 6);

    firePointer(incomingSurface, 'pointerMove', { pointerId: 31, clientY: 499 });
    firePointer(incomingSurface, 'pointerMove', {
      pointerId: 31,
      clientY: 499 - VIEWPORT / 10,
    });
    expect(sceneOffsetPercent(0)).toBeCloseTo(-90, 6);
    expect(sceneOffsetPercent(1)).toBeCloseTo(10, 6);

    firePointer(incomingSurface, 'pointerUp', {
      pointerId: 31,
      clientY: 499 - VIEWPORT / 10,
    });
    const replacementLane = renderLaneCalls().slice(-1)[0];
    expect(replacementLane).not.toBe(inFlightLane);
    expect(replacementLane.target).toBe(1);

    act(() => {
      replacementLane.complete();
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    await flushAsync();
  });

  it('keeps the backward handoff visually fixed before and after the scene-index commit', async () => {
    const cineViewRef = await renderHarness();

    act(() => {
      cineViewRef.current?.goToScene(1, false);
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    expect(sceneWrapper(0).style.transform).toBe('translate3d(0, -100%, 0)');
    expect(sceneWrapper(1).style.transform).toBe('translate3d(0, 0%, 0)');

    const surface = sceneSurface(1);
    const startY = 200;
    const ownershipY = startY + 1;
    const endY = ownershipY + VIEWPORT / 2;
    firePointer(surface, 'pointerDown', { pointerId: 7, clientY: startY });
    firePointer(surface, 'pointerMove', { pointerId: 7, clientY: ownershipY });
    firePointer(surface, 'pointerMove', { pointerId: 7, clientY: endY });
    firePointer(surface, 'pointerUp', { pointerId: 7, clientY: endY });

    const backwardLane = renderLaneCalls().slice(-1)[0];
    expect(backwardLane.target).toBe(-1);
    const transformBeforeCommit = [
      sceneWrapper(0).style.transform,
      sceneWrapper(1).style.transform,
    ];
    act(() => {
      backwardLane.complete();
      // React has not flushed currentScene=0 yet. Keep the last rendered drag
      // frame intact; synchronously rebasing the relative progress against the
      // old currentScene=1 origin would create the visible one-frame jump.
      expect([sceneWrapper(0).style.transform, sceneWrapper(1).style.transform]).toEqual(
        transformBeforeCommit
      );
    });

    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(sceneWrapper(0).style.transform).toBe('translate3d(0, 0%, 0)');
    expect(sceneWrapper(1).style.transform).toBe('translate3d(0, 100%, 0)');
    await flushAsync();
  });

  it('a rush re-grab tap resumes the original render and element continuations from their frozen values', async () => {
    const cineViewRef = await renderHarness();
    const settleContinuation = releaseIntoSettle();
    expect(settleContinuation.fromValue).toBeGreaterThan(0);
    expect(settleContinuation.target).toBe(4000);

    const inFlightLane = renderLaneCalls().slice(-1)[0];
    act(() => {
      inFlightLane.onUpdate?.(0.9);
      settleContinuation.onUpdate?.(2800);
    });
    const surface = sceneSurface(0);
    firePointer(surface, 'pointerDown', { pointerId: 2, clientY: 500 });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(inFlightLane.stopped).toBe(true);
    expect(settleContinuation.stopped).toBe(true);
    const renderCallsBeforeTap = renderLaneCalls().length;
    const trackCallsBeforeTap = elementTrackCalls().length;

    // No direction-qualified move means no ownership. Releasing the candidate
    // resumes both original continuations; it does not create a drag session.
    firePointer(surface, 'pointerUp', { pointerId: 2, clientY: 500 });
    const resumedRender = renderLaneCalls().slice(renderCallsBeforeTap);
    const resumedElement = elementTrackCalls().slice(trackCallsBeforeTap);
    expect(resumedRender).toHaveLength(1);
    expect(resumedRender[0].fromValue).toBeCloseTo(0.9, 6);
    expect(resumedRender[0].target).toBe(1);
    expect(resumedElement).toHaveLength(1);
    expect(resumedElement[0].fromValue).toBe(2800);
    expect(resumedElement[0].target).toBe(4000);

    act(() => {
      resumedRender[0].complete();
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(1);

    act(() => {
      resumedElement[0].complete();
    });
    expect(resumedElement[0].completed).toBe(true);
    expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    await flushAsync();
  });

  it('a candidate tap suspends and resumes an in-flight bounce on both tracks', async () => {
    const cineViewRef = await renderHarness();
    const surface = sceneSurface(0);
    const callsBeforeRelease = animateCalls.length;
    const startY = 600;
    const ownershipY = startY - 1;
    const endY = ownershipY - VIEWPORT / 10;

    firePointer(surface, 'pointerDown', { pointerId: 11, clientY: startY });
    firePointer(surface, 'pointerMove', { pointerId: 11, clientY: ownershipY });
    firePointer(surface, 'pointerMove', { pointerId: 11, clientY: endY });
    firePointer(surface, 'pointerUp', { pointerId: 11, clientY: endY });

    const bounceCalls = animateCalls
      .slice(callsBeforeRelease)
      .filter((call) => call.isMotion && call.target === 0);
    expect(bounceCalls).toHaveLength(2);
    const renderBounce = bounceCalls.find((call) => call.fromValue < 1);
    const elementBounce = bounceCalls.find((call) => call.fromValue >= 1);
    expect(renderBounce).toBeDefined();
    expect(elementBounce).toBeDefined();

    act(() => {
      renderBounce?.onUpdate?.(0.06);
      elementBounce?.onUpdate?.(60);
    });
    const callsBeforeTap = animateCalls.length;
    firePointer(surface, 'pointerDown', { pointerId: 12, clientY: 500 });

    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(renderBounce?.stopped).toBe(true);
    expect(elementBounce?.stopped).toBe(true);
    expect(sceneOffsetPercent(0)).toBeCloseTo(-6, 6);
    expect(readVideoTime(1)).toBeCloseTo(0.15, 2);

    firePointer(surface, 'pointerUp', { pointerId: 12, clientY: 500 });
    const resumedBounces = animateCalls
      .slice(callsBeforeTap)
      .filter((call) => call.isMotion && call.target === 0);
    expect(resumedBounces).toHaveLength(2);
    expect(resumedBounces.map((call) => call.fromValue).sort((a, b) => a - b)).toEqual([
      expect.closeTo(0.06, 6),
      60,
    ]);

    act(() => {
      resumedBounces.forEach((call) => call.complete());
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(sceneOffsetPercent(0)).toBeCloseTo(0, 6);
    expect(readVideoTime(1)).toBeCloseTo(0, 6);
    await flushAsync();
  });

  it('a rush re-grab can scrub the taken-over transition BACK to rest, abandoning it pre-commit (no scene change)', async () => {
    const cineViewRef = await renderHarness();
    releaseIntoSettle();

    // Advance the page-slide to 0.6, then take it over.
    const inFlightLane = renderLaneCalls().slice(-1)[0];
    act(() => {
      inFlightLane.onUpdate?.(0.6);
    });
    const surface = sceneSurface(0);
    firePointer(surface, 'pointerDown', { pointerId: 2, clientY: 300 });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(inFlightLane.stopped).toBe(true);

    // Drag DOWN by exactly the frozen progress: 0.6 - 0.6 = 0. The page returns
    // to rest under the finger — scene 0 fully back, scene 1 fully out.
    firePointer(surface, 'pointerMove', { pointerId: 2, clientY: 301 });
    firePointer(surface, 'pointerMove', {
      pointerId: 2,
      clientY: 301 + VIEWPORT * 0.6,
    });
    expect(sceneWrapper(0).style.transform).toBe('translate3d(0, 0%, 0)');
    expect(sceneWrapper(1).style.transform).toBe('translate3d(0, 100%, 0)');

    // Releasing at rest ABANDONS the taken-over transition pre-commit: no scene
    // change, and the would-be incoming scene's element track is rewound.
    const trackCallsBeforeRelease = elementTrackCalls().length;
    firePointer(surface, 'pointerUp', { pointerId: 2, clientY: 301 + VIEWPORT * 0.6 });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);

    const rewind = elementTrackCalls().slice(trackCallsBeforeRelease);
    expect(rewind.length).toBe(1);
    expect(rewind[0].target).toBe(0); // bounce back to the start of the enter
    act(() => {
      rewind[0].complete();
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    await flushAsync();
  });

  it('a rush re-grab can carry the transition FORWARD to a second commit in one continuous gesture', async () => {
    const cineViewRef = await renderHarness();
    releaseIntoSettle();

    // Take the slide over at 0.9 and complete it forward by dragging on.
    const inFlightLane = renderLaneCalls().slice(-1)[0];
    act(() => {
      inFlightLane.onUpdate?.(0.9);
    });
    const surface = sceneSurface(0);
    firePointer(surface, 'pointerDown', { pointerId: 2, clientY: 500 });
    firePointer(surface, 'pointerMove', { pointerId: 2, clientY: 499 });
    firePointer(surface, 'pointerMove', { pointerId: 2, clientY: 499 - VIEWPORT * 0.1 });
    // 0.9 + 0.1 = 1.0: the render lane is saturated at a full page.
    expect(sceneWrapper(0).style.transform).toBe('translate3d(0, -100%, 0)');
    expect(sceneWrapper(1).style.transform).toBe('translate3d(0, 0%, 0)');

    firePointer(surface, 'pointerUp', { pointerId: 2, clientY: 499 - VIEWPORT * 0.1 });
    // The finger already drove render progress to the exact target. Release must
    // commit synchronously instead of allocating a zero-length render tween.
    expect(renderLaneCalls().slice(-1)[0]).toBe(inFlightLane);
    expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    await flushAsync();
  });

  it('keeps video time continuous from forward drag through settle and the scene commit', async () => {
    const cineViewRef = await renderHarness();
    const settleContinuation = releaseIntoSettle();
    const draggedTime = readVideoTime(1);
    expect(draggedTime).toBeGreaterThan(0);
    expect(draggedTime).toBeLessThan(10);

    act(() => {
      settleContinuation.onUpdate?.(3000);
    });
    const settledTime = readVideoTime(1);
    expect(settledTime).toBeGreaterThan(draggedTime);
    expect(settledTime).toBeCloseTo(7.5, 5);

    const renderLane = renderLaneCalls().slice(-1)[0];
    act(() => {
      renderLane.complete();
      expect(readVideoTime(1)).toBeCloseTo(settledTime, 6);
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    expect(readVideoTime(1)).toBeCloseTo(settledTime, 6);

    act(() => {
      settleContinuation.complete();
    });
    expect(readVideoTime(1)).toBeCloseTo(10, 6);
    await flushAsync();
  });

  it('rewinds the incoming video with the element track on a sub-threshold bounce', async () => {
    const cineViewRef = await renderHarness();
    const surface = sceneSurface(0);
    const callsBefore = elementTrackCalls().length;

    firePointer(surface, 'pointerDown', { pointerId: 21, clientY: 600 });
    firePointer(surface, 'pointerMove', { pointerId: 21, clientY: 599 });
    firePointer(surface, 'pointerMove', { pointerId: 21, clientY: 500 });
    const draggedTime = readVideoTime(1);
    expect(draggedTime).toBeGreaterThan(0);
    expect(draggedTime).toBeLessThan(10);
    firePointer(surface, 'pointerUp', { pointerId: 21, clientY: 500 });

    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    const rewinds = elementTrackCalls()
      .slice(callsBefore)
      .filter((call) => call.target === 0 && call.fromValue > 0 && !call.stopped);
    expect(rewinds.length).toBeGreaterThan(0);
    act(() => {
      rewinds.forEach((rewind) => rewind.complete());
    });
    expect(readVideoTime(1)).toBeCloseTo(0, 6);
    await flushAsync();
  });

  it('freezes video time on rush re-grab and resumes from that exact frame', async () => {
    await renderHarness();
    const settleContinuation = releaseIntoSettle();
    const renderLane = renderLaneCalls().slice(-1)[0];
    act(() => {
      renderLane.onUpdate?.(0.8);
      settleContinuation.onUpdate?.(2800);
    });
    const frozenTime = readVideoTime(1);
    expect(frozenTime).toBeCloseTo(7, 5);

    const surface = sceneSurface(0);
    firePointer(surface, 'pointerDown', { pointerId: 22, clientY: 500 });
    expect(readVideoTime(1)).toBeCloseTo(frozenTime, 6);
    firePointer(surface, 'pointerMove', { pointerId: 22, clientY: 499 });
    expect(readVideoTime(1)).toBeCloseTo(frozenTime, 6);
    firePointer(surface, 'pointerUp', { pointerId: 22, clientY: 499 });

    const resumed = elementTrackCalls().slice(-1)[0];
    expect(resumed.fromValue).toBeCloseTo(2800, 6);
    act(() => {
      resumed.onUpdate?.(3200);
    });
    expect(readVideoTime(1)).toBeCloseTo(8, 5);
    await flushAsync();
  });

  it('advances returning video monotonically during a backward drag and holds the commit frame', async () => {
    const cineViewRef = await renderHarness();
    act(() => {
      cineViewRef.current?.goToScene(1, false);
    });

    const surface = sceneSurface(1);
    firePointer(surface, 'pointerDown', { pointerId: 23, clientY: 200 });
    firePointer(surface, 'pointerMove', { pointerId: 23, clientY: 201 });
    firePointer(surface, 'pointerMove', { pointerId: 23, clientY: 201 + VIEWPORT / 4 });
    const quarterTime = readVideoTime(0);
    expect(quarterTime).toBeGreaterThan(0);

    firePointer(surface, 'pointerMove', { pointerId: 23, clientY: 201 + VIEWPORT / 2 });
    const halfTime = readVideoTime(0);
    expect(halfTime).toBeGreaterThan(quarterTime);
    expect(halfTime).toBeLessThanOrEqual(10);
    firePointer(surface, 'pointerUp', { pointerId: 23, clientY: 201 + VIEWPORT / 2 });

    const timeBeforeCommit = readVideoTime(0);
    expect(timeBeforeCommit).toBeCloseTo(halfTime, 6);
    const backwardLane = renderLaneCalls().slice(-1)[0];
    expect(backwardLane.target).toBe(-1);
    act(() => {
      backwardLane.complete();
      expect(readVideoTime(0)).toBeCloseTo(timeBeforeCommit, 6);
    });
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(readVideoTime(0)).toBeCloseTo(timeBeforeCommit, 6);
    await flushAsync();
  });
});
