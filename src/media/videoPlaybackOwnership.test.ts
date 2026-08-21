import type { AnimateTimelineFrame } from '../types';
import {
  createVideoPlaybackOwnershipState,
  mapVideoScrubProgress,
  reduceVideoPlaybackOwnership,
  type VideoPlaybackOwnershipEvent,
  type VideoPlaybackOwnershipResult,
  type VideoPlaybackOwnershipState,
} from './videoPlaybackOwnership';

const gestureFrame = (progress: number): AnimateTimelineFrame => ({
  progress,
  signedProgress: progress,
  phase: progress >= 1 ? 'entered' : 'entering',
  source: 'gesture',
});

const continuationFrame = (progress: number): AnimateTimelineFrame => ({
  progress,
  signedProgress: progress,
  phase: progress >= 1 ? 'entered' : 'entering',
  source: 'continuation',
});

const scrollFrame = (progress: number): AnimateTimelineFrame => ({
  progress,
  signedProgress: progress,
  phase: progress >= 1 ? 'entered' : 'entering',
  source: 'scroll',
});

const visibilityFrame = (progress: number): AnimateTimelineFrame => ({
  progress,
  signedProgress: progress,
  phase: progress >= 1 ? 'entered' : 'entering',
  source: 'visibility',
});

function dispatch(
  state: VideoPlaybackOwnershipState,
  event: VideoPlaybackOwnershipEvent
): VideoPlaybackOwnershipResult {
  return reduceVideoPlaybackOwnership(state, event);
}

describe('videoPlaybackOwnership', () => {
  it('maps full, bounded, clamped, and reverse scrub ranges', () => {
    expect(mapVideoScrubProgress(0.25, 10)).toBe(2.5);
    expect(mapVideoScrubProgress(0.5, 10, [3, 9])).toBe(6);
    expect(mapVideoScrubProgress(0.25, 10, [6, 0])).toBe(4.5);
    expect(mapVideoScrubProgress(0.5, 10, [-5, 20])).toBe(5);
    expect(mapVideoScrubProgress(-1, 10, [3, 9])).toBe(3);
    expect(mapVideoScrubProgress(2, 10, [3, 9])).toBe(9);
    expect(mapVideoScrubProgress(0.5, Number.NaN, [3, 9])).toBeNull();
  });

  it('lets a gesture pause native playback and seek exactly once per target', () => {
    let state = createVideoPlaybackOwnershipState(1);
    state = dispatch(state, { type: 'media-play', activationId: 1 }).state;

    const takeover = dispatch(state, {
      type: 'timeline-frame',
      frame: gestureFrame(0.4),
      duration: 10,
    });
    expect(takeover.commands).toEqual([{ type: 'pause' }, { type: 'seek', time: 4 }]);
    expect(takeover.state.status).toBe('framework-scrub');

    const duplicate = dispatch(takeover.state, {
      type: 'timeline-frame',
      frame: gestureFrame(0.4),
      duration: 10,
    });
    expect(duplicate.commands).toEqual([]);
  });

  it('continues framework settle, but never steals from a native owner', () => {
    let state = createVideoPlaybackOwnershipState(1);
    const frameworkSettle = dispatch(state, {
      type: 'timeline-frame',
      frame: continuationFrame(0.6),
      duration: 10,
    });
    expect(frameworkSettle.commands).toEqual([{ type: 'seek', time: 6 }]);

    state = dispatch(frameworkSettle.state, { type: 'media-play', activationId: 1 }).state;
    const nativeSettle = dispatch(state, {
      type: 'timeline-frame',
      frame: continuationFrame(0.8),
      duration: 10,
    });
    expect(nativeSettle.commands).toEqual([]);
    expect(nativeSettle.state.status).toBe('native-playback');
  });

  it('hands an explicit partial range to native playback once at the endpoint', () => {
    const initial = createVideoPlaybackOwnershipState(1);
    const endpoint = dispatch(initial, {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [0, 6],
    });

    expect(endpoint.commands).toEqual([
      { type: 'seek', time: 6 },
      { type: 'play', requestId: 1 },
    ]);
    expect(endpoint.state.status).toBe('play-pending');

    const jitter = dispatch(endpoint.state, {
      type: 'timeline-frame',
      frame: gestureFrame(0.999),
      duration: 10,
      scrubRange: [0, 6],
    });
    expect(jitter.commands).toEqual([]);

    const rejected = dispatch(jitter.state, { type: 'play-rejected', requestId: 1 });
    expect(rejected.state.status).toBe('play-rejected');
    const noRetry = dispatch(rejected.state, {
      type: 'timeline-frame',
      frame: continuationFrame(1),
      duration: 10,
      scrubRange: [0, 6],
    });
    expect(noRetry.commands).toEqual([]);
  });

  it('does not auto-play the default full-duration scrub range', () => {
    const endpoint = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
    });
    expect(endpoint.commands).toEqual([{ type: 'seek', time: 10 }]);
    expect(endpoint.state.status).toBe('framework-scrub');
  });

  it('uses hysteresis before a reverse gesture reclaims an endpoint', () => {
    let state = createVideoPlaybackOwnershipState(1);
    state = dispatch(state, {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [0, 6],
    }).state;
    state = dispatch(state, { type: 'play-resolved', requestId: 1 }).state;

    const terminalJitter = dispatch(state, {
      type: 'timeline-frame',
      frame: gestureFrame(0.995),
      duration: 10,
      scrubRange: [0, 6],
    });
    expect(terminalJitter.commands).toEqual([]);

    const reverse = dispatch(terminalJitter.state, {
      type: 'timeline-frame',
      frame: gestureFrame(0.97),
      duration: 10,
      scrubRange: [0, 6],
    });
    expect(reverse.commands).toEqual([{ type: 'pause' }, { type: 'seek', time: 5.82 }]);
    expect(reverse.state.status).toBe('framework-scrub');
  });

  it('ignores a stale play resolution after gesture takeover invalidates its request', () => {
    let state = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [0, 6],
    }).state;
    state = dispatch(state, {
      type: 'timeline-frame',
      frame: gestureFrame(0.8),
      duration: 10,
      scrubRange: [0, 6],
    }).state;

    const stale = dispatch(state, { type: 'play-resolved', requestId: 1 });
    expect(stale.state.status).toBe('framework-scrub');
    expect(stale.commands).toEqual([]);
  });

  it('pauses once on outgoing frames and never maps exit progress to currentTime', () => {
    let state = createVideoPlaybackOwnershipState(1);
    state = dispatch(state, { type: 'media-play', activationId: 1 }).state;
    const outgoingFrame: AnimateTimelineFrame = {
      progress: 0.4,
      signedProgress: 0.4,
      phase: 'exiting',
      source: 'idle',
    };

    const leaving = dispatch(state, {
      type: 'timeline-frame',
      frame: outgoingFrame,
      duration: 10,
    });
    expect(leaving.commands).toEqual([{ type: 'pause' }]);
    expect(leaving.state.status).toBe('framework-scrub');

    const repeated = dispatch(leaving.state, {
      type: 'timeline-frame',
      frame: { ...outgoingFrame, progress: 0.8 },
      duration: 10,
    });
    expect(repeated.commands).toEqual([]);
    expect(repeated.state.lastSeekTime).toBeNull();
  });

  it('resets outgoing media to the scrub start exactly once at the idle handoff', () => {
    const idleFrame: AnimateTimelineFrame = {
      progress: 0,
      signedProgress: 0,
      phase: 'idle',
      source: 'idle',
    };
    const initialIdle = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: idleFrame,
      duration: 10,
      scrubRange: [2, 8],
    });
    expect(initialIdle.commands).toEqual([]);

    let state = dispatch(initialIdle.state, {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [2, 8],
    }).state;
    state = dispatch(state, {
      type: 'timeline-frame',
      frame: { ...idleFrame, progress: 1, signedProgress: 1, phase: 'exited' },
      duration: 10,
      scrubRange: [2, 8],
    }).state;

    const reset = dispatch(state, {
      type: 'timeline-frame',
      frame: idleFrame,
      duration: 10,
      scrubRange: [2, 8],
    });
    expect(reset.commands).toEqual([{ type: 'seek', time: 2 }]);
    expect(reset.state).toMatchObject({
      status: 'framework-scrub',
      lastSeekTime: 2,
      endpointLatched: false,
      outgoingLatched: false,
    });

    const repeated = dispatch(reset.state, {
      type: 'timeline-frame',
      frame: idleFrame,
      duration: 10,
      scrubRange: [2, 8],
    });
    expect(repeated.commands).toEqual([]);

    const pauseAcknowledged = dispatch(repeated.state, {
      type: 'media-pause',
      activationId: 1,
    });
    expect(pauseAcknowledged.state.status).toBe('framework-scrub');
  });

  it('holds ended media until a new activation and scrub frame reclaims it', () => {
    let state = createVideoPlaybackOwnershipState(1);
    state = dispatch(state, { type: 'media-ended', activationId: 1 }).state;
    const held = dispatch(state, {
      type: 'timeline-frame',
      frame: continuationFrame(0.5),
      duration: 10,
    });
    expect(held.commands).toEqual([]);
    expect(held.state.status).toBe('ended');

    const activated = dispatch(held.state, { type: 'activate', activationId: 2 });
    expect(activated.state.status).toBe('framework-scrub');
    const resumed = dispatch(activated.state, {
      type: 'timeline-frame',
      frame: { ...gestureFrame(0.2), source: 'programmatic' },
      duration: 10,
    });
    expect(resumed.commands).toEqual([{ type: 'seek', time: 2 }]);
  });

  it('does not let the pause event caused by framework takeover steal ownership back', () => {
    let state = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'media-play',
      activationId: 1,
    }).state;
    state = dispatch(state, {
      type: 'timeline-frame',
      frame: gestureFrame(0.4),
      duration: 10,
    }).state;

    const pauseEvent = dispatch(state, { type: 'media-pause', activationId: 1 });
    expect(pauseEvent.state.status).toBe('framework-scrub');
    expect(
      dispatch(pauseEvent.state, {
        type: 'timeline-frame',
        frame: continuationFrame(0.6),
        duration: 10,
      }).commands
    ).toEqual([{ type: 'seek', time: 6 }]);
  });

  it('does not let a duplicate scroll endpoint reclaim an automatic native handoff', () => {
    const scrollEndpoint: AnimateTimelineFrame = {
      progress: 1,
      signedProgress: 1,
      phase: 'entered',
      source: 'scroll',
    };
    let state = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: scrollEndpoint,
      duration: 10,
      scrubRange: [0, 6],
    }).state;
    state = dispatch(state, { type: 'play-resolved', requestId: 1 }).state;

    const duplicate = dispatch(state, {
      type: 'timeline-frame',
      frame: scrollEndpoint,
      duration: 10,
      scrubRange: [0, 6],
    });
    expect(duplicate.commands).toEqual([]);
    expect(duplicate.state.status).toBe('native-playback');
  });

  it.each(['play-rejected', 'ended'] as const)(
    'lets a reverse gesture reclaim %s media beyond endpoint hysteresis',
    (terminalStatus) => {
      let state = createVideoPlaybackOwnershipState(1);
      if (terminalStatus === 'play-rejected') {
        state = dispatch(state, {
          type: 'timeline-frame',
          frame: gestureFrame(1),
          duration: 10,
          scrubRange: [0, 6],
        }).state;
        state = dispatch(state, { type: 'play-rejected', requestId: 1 }).state;
      } else {
        state = dispatch(state, { type: 'media-ended', activationId: 1 }).state;
      }

      const takeover = dispatch(state, {
        type: 'timeline-frame',
        frame: gestureFrame(0.9),
        duration: 10,
        scrubRange: [0, 6],
      });
      expect(takeover.state.status).toBe('framework-scrub');
      expect(takeover.commands).toEqual([{ type: 'seek', time: 5.4 }]);
    }
  );

  it.each([
    ['scroll', scrollFrame],
    ['visibility', visibilityFrame],
  ] as const)('lets reverse %s reclaim ended media beyond endpoint hysteresis', (_, frame) => {
    let state = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: frame(1),
      duration: 10,
      scrubRange: [0, 6],
    }).state;
    state = dispatch(state, { type: 'play-resolved', requestId: 1 }).state;
    state = dispatch(state, { type: 'media-ended', activationId: 1 }).state;

    const endpointJitter = dispatch(state, {
      type: 'timeline-frame',
      frame: frame(0.99),
      duration: 10,
      scrubRange: [0, 6],
    });
    expect(endpointJitter.commands).toEqual([]);
    expect(endpointJitter.state.status).toBe('ended');

    const reverse = dispatch(endpointJitter.state, {
      type: 'timeline-frame',
      frame: frame(0.6),
      duration: 10,
      scrubRange: [0, 6],
    });
    expect(reverse.commands).toHaveLength(1);
    expect(reverse.commands[0]?.type).toBe('seek');
    if (reverse.commands[0]?.type === 'seek') {
      expect(reverse.commands[0].time).toBeCloseTo(3.6);
    }
    expect(reverse.state).toMatchObject({
      status: 'framework-scrub',
      activePlayRequestId: null,
      endpointLatched: false,
    });
  });

  it.each([
    ['scroll', scrollFrame],
    ['visibility', visibilityFrame],
  ] as const)(
    'lets reverse %s reclaim a rejected handoff and only retries after leaving the endpoint',
    (_, frame) => {
      let state = dispatch(createVideoPlaybackOwnershipState(1), {
        type: 'timeline-frame',
        frame: frame(1),
        duration: 10,
        scrubRange: [0, 6],
      }).state;
      state = dispatch(state, { type: 'play-rejected', requestId: 1 }).state;

      const endpointJitter = dispatch(state, {
        type: 'timeline-frame',
        frame: frame(0.99),
        duration: 10,
        scrubRange: [0, 6],
      });
      expect(endpointJitter.commands).toEqual([]);
      expect(endpointJitter.state.status).toBe('play-rejected');

      const reverse = dispatch(endpointJitter.state, {
        type: 'timeline-frame',
        frame: frame(0.6),
        duration: 10,
        scrubRange: [0, 6],
      });
      expect(reverse.commands).toHaveLength(1);
      expect(reverse.commands[0]?.type).toBe('seek');
      if (reverse.commands[0]?.type === 'seek') {
        expect(reverse.commands[0].time).toBeCloseTo(3.6);
      }
      expect(reverse.state).toMatchObject({
        status: 'framework-scrub',
        activePlayRequestId: null,
        endpointLatched: false,
      });

      const endpoint = dispatch(reverse.state, {
        type: 'timeline-frame',
        frame: frame(1),
        duration: 10,
        scrubRange: [0, 6],
      });
      expect(endpoint.commands).toEqual([
        { type: 'seek', time: 6 },
        { type: 'play', requestId: 2 },
      ]);
      expect(endpoint.state).toMatchObject({
        status: 'play-pending',
        activePlayRequestId: 2,
        endpointLatched: true,
      });
    }
  );

  it('rejects a stale tagged media-play event after gesture takeover', () => {
    let state = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [0, 6],
    }).state;
    state = dispatch(state, {
      type: 'timeline-frame',
      frame: gestureFrame(0.8),
      duration: 10,
      scrubRange: [0, 6],
    }).state;

    const stalePlay = dispatch(state, {
      type: 'media-play',
      requestId: 1,
      activationId: 1,
    });
    expect(stalePlay.state.status).toBe('framework-scrub');
    expect(stalePlay.commands).toEqual([{ type: 'pause' }]);
  });

  it('rejects an untagged late play after a settled framework handoff is reclaimed', () => {
    let state = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [0, 6],
    }).state;
    state = dispatch(state, { type: 'play-resolved', requestId: 1 }).state;

    const takeover = dispatch(state, {
      type: 'timeline-frame',
      frame: { ...gestureFrame(0.8), source: 'scroll' },
      duration: 10,
      scrubRange: [0, 6],
    });
    expect(takeover.state).toMatchObject({
      status: 'framework-scrub',
      frameworkPlayBlocked: true,
    });

    const delayedPlay = dispatch(takeover.state, {
      type: 'media-play',
      activationId: 1,
    });
    expect(delayedPlay.commands).toEqual([{ type: 'pause' }]);
    expect(delayedPlay.state.status).toBe('framework-scrub');
    expect(delayedPlay.state.frameworkPlayBlocked).toBe(true);
  });

  it('ignores a stale media-ended event from a previous activation', () => {
    const active = createVideoPlaybackOwnershipState(1);
    const nextActivation = dispatch(active, { type: 'reset', activationId: 2 }).state;

    const staleEnded = dispatch(nextActivation, { type: 'media-ended', activationId: 1 });

    expect(staleEnded.commands).toEqual([]);
    expect(staleEnded.state).toBe(nextActivation);
  });

  it('ignores a stale media-pause event from a previous activation', () => {
    const active = createVideoPlaybackOwnershipState(1);
    const nextActivation = dispatch(active, { type: 'reset', activationId: 2 }).state;

    const stalePause = dispatch(nextActivation, {
      type: 'media-pause',
      activationId: 1,
    });

    expect(stalePause.commands).toEqual([]);
    expect(stalePause.state).toBe(nextActivation);
  });

  it('ignores a stale media-play event from a previous activation', () => {
    const active = createVideoPlaybackOwnershipState(1);
    const nextActivation = dispatch(active, { type: 'reset', activationId: 2 }).state;

    const stalePlay = dispatch(nextActivation, {
      type: 'media-play',
      activationId: 1,
    });

    expect(stalePlay.commands).toEqual([]);
    expect(stalePlay.state).toBe(nextActivation);
    expect(dispatch(nextActivation, { type: 'media-play', activationId: 2 }).state.status).toBe(
      'native-playback'
    );
  });

  it('invalidates pending work when the media source changes', () => {
    let state = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [0, 6],
    }).state;
    expect(state.activePlayRequestId).toBe(1);

    state = dispatch(state, { type: 'reset', activationId: 1 }).state;
    expect(state.status).toBe('framework-scrub');
    expect(state.activePlayRequestId).toBeNull();
    expect(state.lastSeekTime).toBeNull();

    const stale = dispatch(state, { type: 'play-rejected', requestId: 1 });
    expect(stale.state.status).toBe('framework-scrub');
  });

  it('normalizes non-finite scrub inputs to deterministic range endpoints', () => {
    expect(mapVideoScrubProgress(0.5, 10, [Number.NaN, 8])).toBe(4);
    expect(mapVideoScrubProgress(0.5, 10, [2, Number.NaN])).toBe(6);
    expect(mapVideoScrubProgress(Number.NaN, 10, [4, 8])).toBe(4);
  });

  it('lets scroll reclaim native playback away from the latched endpoint', () => {
    let state = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [0, 6],
    }).state;
    state = dispatch(state, { type: 'play-resolved', requestId: 1 }).state;

    const takeover = dispatch(state, {
      type: 'timeline-frame',
      frame: { ...gestureFrame(0.4), source: 'scroll' },
      duration: 10,
      scrubRange: [0, 6],
    });

    expect(takeover.state.status).toBe('framework-scrub');
    expect(takeover.commands[0]).toEqual({ type: 'pause' });
    expect(takeover.commands[1]?.type).toBe('seek');
    expect(takeover.commands[1]).toMatchObject({ type: 'seek' });
    if (takeover.commands[1]?.type === 'seek') {
      expect(takeover.commands[1].time).toBeCloseTo(2.4);
    }
  });

  it('treats invalid duration, full-range endpoints, and terminal events deterministically', () => {
    const invalidDuration = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: gestureFrame(0.5),
      duration: 0,
      scrubRange: [0, 6],
    });
    expect(invalidDuration.commands).toEqual([]);

    const fullRangeEndpoint = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'timeline-frame',
      frame: gestureFrame(1),
      duration: 10,
      scrubRange: [0, 10],
    });
    expect(fullRangeEndpoint.commands).toEqual([{ type: 'seek', time: 10 }]);
    expect(fullRangeEndpoint.state.endpointLatched).toBe(true);

    const ended = dispatch(createVideoPlaybackOwnershipState(1), {
      type: 'media-ended',
      activationId: 1,
    }).state;
    expect(dispatch(ended, { type: 'media-pause', activationId: 1 }).state.status).toBe('ended');

    const active = dispatch(createVideoPlaybackOwnershipState(7), {
      type: 'timeline-frame',
      frame: gestureFrame(0.5),
      duration: 10,
    }).state;
    expect(dispatch(active, { type: 'activate', activationId: 7 }).state).toBe(active);
  });
});
