import type { AnimateTimelineFrame } from '../types';

export type VideoPlaybackOwnershipStatus =
  | 'framework-scrub'
  | 'play-pending'
  | 'native-playback'
  | 'native-paused'
  | 'play-rejected'
  | 'ended';

export interface VideoPlaybackOwnershipState {
  readonly activationId: number;
  readonly status: VideoPlaybackOwnershipStatus;
  readonly activePlayRequestId: number | null;
  readonly nextPlayRequestId: number;
  readonly lastSeekTime: number | null;
  readonly endpointLatched: boolean;
  readonly outgoingLatched: boolean;
  /** The next native pause event acknowledges a framework-issued pause command. */
  readonly frameworkPausePending: boolean;
}

export type VideoPlaybackOwnershipCommand =
  | { readonly type: 'pause' }
  | { readonly type: 'seek'; readonly time: number }
  | { readonly type: 'play'; readonly requestId: number };

interface TimelineFrameEvent {
  readonly type: 'timeline-frame';
  readonly frame: AnimateTimelineFrame;
  readonly duration: number;
  readonly scrubRange?: readonly [fromSeconds: number, toSeconds: number];
}

export type VideoPlaybackOwnershipEvent =
  | TimelineFrameEvent
  | { readonly type: 'media-play'; readonly requestId?: number }
  | { readonly type: 'media-pause' }
  | { readonly type: 'media-ended' }
  | { readonly type: 'play-resolved'; readonly requestId: number }
  | { readonly type: 'play-rejected'; readonly requestId: number }
  | { readonly type: 'activate'; readonly activationId: number }
  | { readonly type: 'reset'; readonly activationId: number };

export interface VideoPlaybackOwnershipResult {
  readonly state: VideoPlaybackOwnershipState;
  readonly commands: readonly VideoPlaybackOwnershipCommand[];
}

const PROGRESS_EPSILON = 0.001;
const TAKEOVER_HYSTERESIS = 0.02;
const SEEK_EPSILON_SECONDS = 0.0001;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isValidDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

function normalizedRange(
  duration: number,
  scrubRange?: readonly [number, number]
): readonly [number, number] | null {
  if (!isValidDuration(duration)) return null;
  if (!scrubRange) return [0, duration];
  const from = Number.isFinite(scrubRange[0]) ? clamp(scrubRange[0], 0, duration) : 0;
  const to = Number.isFinite(scrubRange[1]) ? clamp(scrubRange[1], 0, duration) : duration;
  return [from, to];
}

export function mapVideoScrubProgress(
  progress: number,
  duration: number,
  scrubRange?: readonly [fromSeconds: number, toSeconds: number]
): number | null {
  const range = normalizedRange(duration, scrubRange);
  if (!range) return null;
  const normalizedProgress = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  return range[0] + normalizedProgress * (range[1] - range[0]);
}

export function createVideoPlaybackOwnershipState(
  activationId: number
): VideoPlaybackOwnershipState {
  return {
    activationId,
    status: 'framework-scrub',
    activePlayRequestId: null,
    nextPlayRequestId: 1,
    lastSeekTime: null,
    endpointLatched: false,
    outgoingLatched: false,
    frameworkPausePending: false,
  };
}

function result(
  state: VideoPlaybackOwnershipState,
  commands: readonly VideoPlaybackOwnershipCommand[] = []
): VideoPlaybackOwnershipResult {
  return { state, commands };
}

function resetState(
  state: VideoPlaybackOwnershipState,
  activationId: number
): VideoPlaybackOwnershipState {
  return {
    ...createVideoPlaybackOwnershipState(activationId),
    nextPlayRequestId: state.nextPlayRequestId,
  };
}

function isNativeOwner(status: VideoPlaybackOwnershipStatus): boolean {
  return status === 'native-playback' || status === 'native-paused' || status === 'play-pending';
}

function isScrubSource(source: AnimateTimelineFrame['source']): boolean {
  return (
    source === 'gesture' ||
    source === 'continuation' ||
    source === 'programmatic' ||
    source === 'scroll' ||
    source === 'visibility'
  );
}

function shouldTakeOverNativeOwner(
  state: VideoPlaybackOwnershipState,
  frame: AnimateTimelineFrame
): boolean {
  if (state.endpointLatched && frame.progress >= 1 - TAKEOVER_HYSTERESIS) return false;
  if (frame.source === 'scroll' || frame.source === 'visibility') return true;
  if (frame.source !== 'gesture') return false;
  return frame.progress < 1 - TAKEOVER_HYSTERESIS;
}

function canReclaimTerminalState(
  state: VideoPlaybackOwnershipState,
  frame: AnimateTimelineFrame
): boolean {
  if (state.status !== 'ended' && state.status !== 'play-rejected') return true;
  return frame.source === 'gesture' && frame.progress < 1 - TAKEOVER_HYSTERESIS;
}

function shouldAutoPlay(event: TimelineFrameEvent, endpointLatched: boolean): boolean {
  if (!event.scrubRange || endpointLatched || event.frame.progress < 1 - PROGRESS_EPSILON) {
    return false;
  }
  const range = normalizedRange(event.duration, event.scrubRange);
  if (!range) return false;
  return range[1] < event.duration - SEEK_EPSILON_SECONDS;
}

function reduceTimelineFrame(
  state: VideoPlaybackOwnershipState,
  event: TimelineFrameEvent
): VideoPlaybackOwnershipResult {
  const { frame } = event;

  if (frame.phase === 'exiting' || frame.phase === 'exited') {
    if (state.outgoingLatched) return result(state);
    const playing = state.status === 'native-playback' || state.status === 'play-pending';
    return result(
      {
        ...state,
        status: playing ? 'native-paused' : state.status,
        activePlayRequestId: null,
        outgoingLatched: true,
        frameworkPausePending: playing,
      },
      playing ? [{ type: 'pause' }] : []
    );
  }

  if (!isScrubSource(frame.source)) return result(state);
  if (!canReclaimTerminalState(state, frame)) return result(state);

  const targetTime = mapVideoScrubProgress(frame.progress, event.duration, event.scrubRange);
  if (targetTime === null) return result(state);

  if (isNativeOwner(state.status)) {
    if (!shouldTakeOverNativeOwner(state, frame)) return result(state);
    const commands: VideoPlaybackOwnershipCommand[] = [];
    const shouldPause = state.status === 'native-playback' || state.status === 'play-pending';
    if (shouldPause) {
      commands.push({ type: 'pause' });
    }
    if (
      state.lastSeekTime === null ||
      Math.abs(state.lastSeekTime - targetTime) > SEEK_EPSILON_SECONDS
    ) {
      commands.push({ type: 'seek', time: targetTime });
    }
    return result(
      {
        ...state,
        status: 'framework-scrub',
        activePlayRequestId: null,
        lastSeekTime: targetTime,
        endpointLatched: false,
        outgoingLatched: false,
        frameworkPausePending: shouldPause,
      },
      commands
    );
  }

  const commands: VideoPlaybackOwnershipCommand[] = [];
  if (
    state.lastSeekTime === null ||
    Math.abs(state.lastSeekTime - targetTime) > SEEK_EPSILON_SECONDS
  ) {
    commands.push({ type: 'seek', time: targetTime });
  }

  if (shouldAutoPlay(event, state.endpointLatched)) {
    const requestId = state.nextPlayRequestId;
    commands.push({ type: 'play', requestId });
    return result(
      {
        ...state,
        status: 'play-pending',
        activePlayRequestId: requestId,
        nextPlayRequestId: requestId + 1,
        lastSeekTime: targetTime,
        endpointLatched: true,
        outgoingLatched: false,
      },
      commands
    );
  }

  const atEndpoint = Boolean(event.scrubRange && frame.progress >= 1 - PROGRESS_EPSILON);
  const leftEndpoint = frame.progress < 1 - TAKEOVER_HYSTERESIS;
  return result(
    {
      ...state,
      status: 'framework-scrub',
      activePlayRequestId: null,
      lastSeekTime: targetTime,
      endpointLatched: atEndpoint ? true : leftEndpoint ? false : state.endpointLatched,
      outgoingLatched: false,
    },
    commands
  );
}

export function reduceVideoPlaybackOwnership(
  state: VideoPlaybackOwnershipState,
  event: VideoPlaybackOwnershipEvent
): VideoPlaybackOwnershipResult {
  switch (event.type) {
    case 'timeline-frame':
      return reduceTimelineFrame(state, event);
    case 'media-play':
      if (event.requestId !== undefined && state.activePlayRequestId !== event.requestId) {
        return result({ ...state, frameworkPausePending: true }, [{ type: 'pause' }]);
      }
      return result({
        ...state,
        status: 'native-playback',
        activePlayRequestId: null,
        frameworkPausePending: false,
      });
    case 'media-pause':
      if (state.frameworkPausePending) {
        return result({ ...state, frameworkPausePending: false });
      }
      return result({
        ...state,
        status: state.status === 'ended' ? 'ended' : 'native-paused',
        activePlayRequestId: null,
      });
    case 'media-ended':
      return result({
        ...state,
        status: 'ended',
        activePlayRequestId: null,
        endpointLatched: true,
        frameworkPausePending: false,
      });
    case 'play-resolved':
      if (state.activePlayRequestId !== event.requestId) return result(state);
      return result({
        ...state,
        status: 'native-playback',
        activePlayRequestId: null,
        frameworkPausePending: false,
      });
    case 'play-rejected':
      if (state.activePlayRequestId !== event.requestId) return result(state);
      return result({
        ...state,
        status: 'play-rejected',
        activePlayRequestId: null,
        frameworkPausePending: false,
      });
    case 'activate':
      if (state.activationId === event.activationId) return result(state);
      return result(resetState(state, event.activationId));
    case 'reset':
      return result(resetState(state, event.activationId));
  }
}
