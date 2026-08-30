import { createRef } from 'react';
import { render } from '@testing-library/react';
import type { AnimateTimelineFrame } from '../../types';
import { AnimateVideo } from './AnimateVideo';
import {
  SceneScrollTakeoverContext,
  SceneScrollTimelineContext,
  type SceneScrollTimelineState,
} from '../Scene/sceneScrollRuntime';

const mockFrame = {
  get: (): AnimateTimelineFrame => ({
    progress: 0.25,
    signedProgress: 0.25,
    phase: 'entering',
    source: 'gesture',
  }),
  on: jest.fn(() => jest.fn()),
};
const mockProgress = { get: () => 0.25, on: jest.fn(() => jest.fn()) };
const mockAnimateProps: Array<Record<string, unknown>> = [];
const mockRendererProps: Array<Record<string, unknown>> = [];
const mockRelease = jest.fn();
const mockWarmUp = jest.fn();

function createZoneState(approach: SceneScrollTimelineState['approach']): SceneScrollTimelineState {
  return {
    zoneId: 'zone-1',
    sceneIndex: 0,
    progressPx: 40,
    totalBudgetPx: 100,
    active: false,
    direction: null,
    approach,
    sequence: { budgets: {}, totalDurationMs: 100, totalBudgetPx: 100 },
  };
}

jest.mock('./animateTimeline', () => ({
  useAnimateTimeline: () => ({
    mode: 'drag',
    lane: 'drag',
    progress: mockProgress,
    signedProgress: { get: () => 0.25, on: jest.fn(() => jest.fn()) },
    phase: { get: () => 'entering', on: jest.fn(() => jest.fn()) },
    frame: mockFrame,
  }),
}));

jest.mock('./Animate', () => ({
  Animate: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
    mockAnimateProps.push(props);
    return <>{props.children}</>;
  },
}));

jest.mock('../../media/VideoFrameRenderer', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    VideoFrameRenderer: React.forwardRef<HTMLVideoElement, Record<string, unknown>>(
      function MockVideoFrameRenderer(props, ref) {
        mockRendererProps.push(props);
        React.useEffect(() => {
          const controlRef = props.controlRef as
            | { current: { release: () => void; warmUp: () => void } | null }
            | undefined;
          if (!controlRef) return undefined;
          controlRef.current = { release: mockRelease, warmUp: mockWarmUp };
          return () => {
            controlRef.current = null;
          };
        }, [props.controlRef]);
        return <video ref={ref} data-testid="renderer-video" />;
      }
    ),
  };
});

beforeEach(() => {
  mockAnimateProps.length = 0;
  mockRendererProps.length = 0;
  mockRelease.mockClear();
  mockWarmUp.mockClear();
});

describe('AnimateVideo plumbing', () => {
  it('forwards timeline, native media, ref, and enter/exit animation contracts', () => {
    const ref = createRef<HTMLVideoElement>();
    const enterAnimation = { initial: { opacity: 0 }, animate: { opacity: 1 } } as const;
    const exitAnimation = { initial: { opacity: 1 }, animate: { opacity: 0 } } as const;
    const onEnded = jest.fn();
    const onPlay = jest.fn();
    const onPause = jest.fn();
    const onTimeUpdate = jest.fn();
    const onError = jest.fn();

    render(
      <AnimateVideo
        ref={ref}
        src="/clip.mp4"
        poster="/poster.jpg"
        playbackRate={1.25}
        scrubRange={[3, 9]}
        duration={{ enter: 2000, exit: 600 }}
        enterAnimation={enterAnimation}
        exitAnimation={exitAnimation}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onError={onError}
      />
    );

    expect(ref.current).toBeInstanceOf(HTMLVideoElement);
    expect(mockAnimateProps[mockAnimateProps.length - 1]).toEqual(
      expect.objectContaining({
        enterAnimation,
        exitAnimation,
        duration: { enter: 2000, exit: 600 },
      })
    );
    expect(mockRendererProps[mockRendererProps.length - 1]).toEqual(
      expect.objectContaining({
        src: '/clip.mp4',
        poster: '/poster.jpg',
        playbackRate: 1.25,
        scrubRange: [3, 9],
        timelineFrame: mockFrame,
        onEnded,
        onPlay,
        onPause,
        onTimeUpdate,
        onError,
      })
    );
  });

  it('releases a scrubbed video when its zone is far and warms it when residency is disabled', () => {
    const renderWith = (releaseOnLeave: boolean, approach: SceneScrollTimelineState['approach']) =>
      render(
        <SceneScrollTakeoverContext.Provider value="zone-1">
          <SceneScrollTimelineContext.Provider
            value={{ zoneStates: { 'zone-1': createZoneState(approach) } }}
          >
            <AnimateVideo src="/residency.mp4" releaseOnLeave={releaseOnLeave} />
          </SceneScrollTimelineContext.Provider>
        </SceneScrollTakeoverContext.Provider>
      );

    const view = renderWith(true, 'far');
    expect(mockRelease).toHaveBeenCalledTimes(1);

    mockWarmUp.mockClear();
    view.rerender(
      <SceneScrollTakeoverContext.Provider value="zone-1">
        <SceneScrollTimelineContext.Provider
          value={{ zoneStates: { 'zone-1': createZoneState('far') } }}
        >
          <AnimateVideo src="/residency.mp4" releaseOnLeave={false} />
        </SceneScrollTimelineContext.Provider>
      </SceneScrollTakeoverContext.Provider>
    );
    expect(mockWarmUp).toHaveBeenCalledTimes(1);
  });

  it('does not inherit scrubbed eligibility when the video source changes', () => {
    const renderWith = (src: string, approach: SceneScrollTimelineState['approach']) => (
      <SceneScrollTakeoverContext.Provider value="zone-1">
        <SceneScrollTimelineContext.Provider
          value={{ zoneStates: { 'zone-1': createZoneState(approach) } }}
        >
          <AnimateVideo src={src} releaseOnLeave />
        </SceneScrollTimelineContext.Provider>
      </SceneScrollTakeoverContext.Provider>
    );

    const view = render(renderWith('/first.mp4', 'far'));
    expect(mockRelease).toHaveBeenCalledTimes(1);
    mockRelease.mockClear();

    view.rerender(renderWith('/second.mp4', 'near'));
    view.rerender(renderWith('/second.mp4', 'far'));
    expect(mockRelease).not.toHaveBeenCalled();
  });
});
