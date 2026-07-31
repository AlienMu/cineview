import { createRef } from 'react';
import { render } from '@testing-library/react';
import type { AnimateTimelineFrame } from '../../types';
import { AnimateVideo } from './AnimateVideo';

const mockFrame = {
  get: (): AnimateTimelineFrame => ({
    progress: 0.25,
    signedProgress: 0.25,
    phase: 'entering',
    source: 'gesture',
  }),
  on: jest.fn(() => jest.fn()),
};
const mockAnimateProps: Array<Record<string, unknown>> = [];
const mockRendererProps: Array<Record<string, unknown>> = [];

jest.mock('./animateTimeline', () => ({
  useAnimateTimeline: () => ({
    mode: 'drag',
    driver: 'drag',
    progress: { get: () => 0.25, on: jest.fn(() => jest.fn()) },
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
        return <video ref={ref} data-testid="renderer-video" />;
      }
    ),
  };
});

beforeEach(() => {
  mockAnimateProps.length = 0;
  mockRendererProps.length = 0;
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
});
