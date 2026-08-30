import { act, render } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import { Animate } from './Animate';
import { useAnimateTimeline } from './animateTimeline';
import { SceneContext, type SceneContextType } from './Animate';
import type { DragVisualState } from './useAnimateDrag';
import type { AnimateTimeline } from '../../types';

const mockDragVisualState = motionValue<DragVisualState | null>({
  mode: 'enter',
  direction: 'forward',
  transitionProgress: 0,
  sharedElapsedMs: 0,
  projectedSceneElapsedMs: 0,
  sharedTimelineDurationMs: 1000,
  sceneTimelineDurationMs: 1000,
  localProgress: 0,
  sceneOffset: 0,
});
const mockScrollVisualMotion = motionValue(0);
const mockScrollPhaseMotion = motionValue<'idle' | 'entering' | 'entered' | 'exiting' | 'exited'>(
  'idle'
);

jest.mock('./useAnimateDrag', () => ({
  useAnimateDrag: () => ({
    style: {},
    opacity: motionValue(1),
    x: motionValue(0),
    y: motionValue(0),
    scale: motionValue(1),
    rotate: motionValue(0),
    useInteractiveStyles: true,
    shouldRunInfinite: false,
    visualState: mockDragVisualState,
  }),
}));

jest.mock('./useAnimateScroll', () => ({
  useAnimateScroll: () => ({
    style: {},
    shouldRunInfinite: false,
    visualMotion: mockScrollVisualMotion,
    phaseMotion: mockScrollPhaseMotion,
  }),
}));

function TimelineProbe({
  onRead,
}: {
  onRead: (timeline: ReturnType<typeof useAnimateTimeline>) => void;
}): JSX.Element | null {
  onRead(useAnimateTimeline());
  return null;
}

describe('useAnimateTimeline', () => {
  it('exposes a stable read-only MotionValue source without React frame renders', () => {
    let renderCount = 0;
    const timelineRef: { current: AnimateTimeline | null } = { current: null };
    const observedProgress: number[] = [];

    function Probe(): JSX.Element {
      renderCount += 1;
      return (
        <TimelineProbe
          onRead={(value) => {
            timelineRef.current = value;
            value.progress.on('change', (next) => observedProgress.push(next));
          }}
        />
      );
    }

    render(
      <Animate>
        <Probe />
      </Animate>
    );

    const timeline = timelineRef.current!;
    expect(timeline.mode).toBe('drag');
    expect(timeline.lane).toBe('drag');
    const firstProgress = timeline.progress;
    act(() => {
      mockDragVisualState.set({
        ...mockDragVisualState.get()!,
        localProgress: 0.5,
      });
    });

    expect(timeline.progress).toBe(firstProgress);
    expect(timeline.progress.get()).toBe(0.5);
    expect(observedProgress).toEqual([0.5]);
    expect(renderCount).toBe(1);
  });

  it('publishes progress, phase, and gesture ownership as one atomic frame', () => {
    const timelineRef: { current: AnimateTimeline | null } = { current: null };
    const sceneContext = {
      mode: 'drag',
      isDragging: true,
      dragTransaction: { phase: 'driving' },
    } as SceneContextType;

    render(
      <SceneContext.Provider value={sceneContext}>
        <Animate>
          <TimelineProbe onRead={(value) => (timelineRef.current = value)} />
        </Animate>
      </SceneContext.Provider>
    );

    const timeline = timelineRef.current! as AnimateTimeline & {
      frame: {
        get: () => {
          progress: number;
          signedProgress: number;
          phase: string;
          source: string;
        };
        on: (
          event: 'change',
          listener: (frame: {
            progress: number;
            signedProgress: number;
            phase: string;
            source: string;
          }) => void
        ) => () => void;
      };
    };
    const observedFrames: ReturnType<typeof timeline.frame.get>[] = [];
    timeline.frame.on('change', (frame) => observedFrames.push(frame));

    act(() => {
      mockDragVisualState.set({
        ...mockDragVisualState.get()!,
        mode: 'enter',
        localProgress: 0.5,
      });
    });

    expect(observedFrames).toEqual([
      {
        progress: 0.5,
        signedProgress: 0.5,
        phase: 'entering',
        source: 'gesture',
      },
    ]);
  });

  it.each([
    ['settling', 'continuation'],
    ['bouncing', 'continuation'],
    ['programmatic', 'programmatic'],
  ] as const)('maps a %s drag transaction to the %s source', (transactionPhase, source) => {
    const timelineRef: { current: AnimateTimeline | null } = { current: null };

    render(
      <SceneContext.Provider
        value={
          {
            mode: 'drag',
            isDragging: false,
            dragTransaction: { phase: transactionPhase },
          } as SceneContextType
        }
      >
        <Animate>
          <TimelineProbe onRead={(value) => (timelineRef.current = value)} />
        </Animate>
      </SceneContext.Provider>
    );

    expect(
      (
        timelineRef.current as AnimateTimeline & {
          frame: { get: () => { source: string } };
        }
      ).frame.get().source
    ).toBe(source);
  });

  it('keeps a formal bounce transaction authoritative on its hidden terminal frame', () => {
    const timelineRef: { current: AnimateTimeline | null } = { current: null };

    render(
      <SceneContext.Provider
        value={
          {
            mode: 'drag',
            isDragging: false,
            dragTransaction: { phase: 'bouncing' },
          } as SceneContextType
        }
      >
        <Animate>
          <TimelineProbe onRead={(value) => (timelineRef.current = value)} />
        </Animate>
      </SceneContext.Provider>
    );

    act(() => {
      mockDragVisualState.set({
        ...mockDragVisualState.get()!,
        mode: 'hidden',
        localProgress: 0,
      });
    });

    expect(timelineRef.current?.frame.get()).toEqual({
      progress: 0,
      signedProgress: 0,
      phase: 'idle',
      source: 'continuation',
    });
  });

  it('does not expose candidate or suspended pointer input as gesture ownership', () => {
    const timelineRef: { current: AnimateTimeline | null } = { current: null };

    render(
      <SceneContext.Provider
        value={
          {
            mode: 'drag',
            isDragging: true,
            dragTransaction: null,
          } as SceneContextType
        }
      >
        <Animate>
          <TimelineProbe onRead={(value) => (timelineRef.current = value)} />
        </Animate>
      </SceneContext.Provider>
    );

    expect(
      (
        timelineRef.current as AnimateTimeline & {
          frame: { get: () => { source: string } };
        }
      ).frame.get().source
    ).toBe('idle');
  });

  it('maps scroll signed progress, phase, and source without a React subscription', () => {
    const timelineRef: { current: AnimateTimeline | null } = { current: null };
    let renders = 0;

    function Probe(): JSX.Element {
      renders += 1;
      return <TimelineProbe onRead={(value) => (timelineRef.current = value)} />;
    }

    render(
      <SceneContext.Provider value={{ mode: 'scroll' } as SceneContextType}>
        <Animate timeline={{ driver: 'clock' }}>
          <Probe />
        </Animate>
      </SceneContext.Provider>
    );

    const timeline = timelineRef.current! as AnimateTimeline & {
      frame: { get: () => { source: string } };
    };
    expect(timeline.lane).toBe('visibility');
    act(() => {
      mockScrollVisualMotion.set(0.75);
      mockScrollPhaseMotion.set('entered');
    });

    expect(timeline.progress.get()).toBe(0.75);
    expect(timeline.signedProgress.get()).toBe(0.75);
    expect(timeline.phase.get()).toBe('entered');
    expect(timeline.frame.get()).toEqual({
      progress: 0.75,
      signedProgress: 0.75,
      phase: 'entered',
      source: 'visibility',
    });
    expect(renders).toBe(1);
  });

  it('throws when used outside Animate so the ownership boundary is explicit', () => {
    function InvalidConsumer(): JSX.Element | null {
      useAnimateTimeline();
      return null;
    }

    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    try {
      expect(() => render(<InvalidConsumer />)).toThrow(
        'useAnimateTimeline must be used inside an <Animate> child.'
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps the public shape free of setters', () => {
    const timelineRef: { current: AnimateTimeline | null } = { current: null };

    render(
      <Animate>
        <TimelineProbe onRead={(value) => (timelineRef.current = value)} />
      </Animate>
    );

    expect(timelineRef.current).not.toBeNull();
    expect((timelineRef.current as unknown as Record<string, unknown>).setProgress).toBeUndefined();
    expect((timelineRef.current as unknown as Record<string, unknown>).setPhase).toBeUndefined();
  });
});
