import { AnimateVideo, type AnimateTimeline, type AnimateTimelineFrame } from 'cineview';
import { memo, useEffect, useRef } from 'react';
import { formatTimecode } from './timecode';
import {
  ACT3_MEDIA_CLOCK_MS,
  ACT3_MEDIA_DURATION_SECONDS,
  ACT3_MEDIA_SCRUB_DURATION_MS,
  ACT3_MEDIA_SCRUB_START_MS,
  ACT3_POSTER_SRC,
  ACT3_VIDEO_SRC,
  resolveAct3MediaState,
} from './act3MediaTimeline';
import { useTemporalMotion } from './TemporalMotion';

interface Act3MediaProps {
  frame: AnimateTimeline['frame'];
}

const FRAMES_PER_SECOND = 25;

/**
 * Act 3's transport UI projection. AnimateVideo is the sole currentTime writer; this
 * component only derives selection, subtitle, playhead and timecode output from the
 * enclosing scene clock.
 */
export const Act3Media = memo(function Act3Media({ frame }: Act3MediaProps): JSX.Element {
  const timing = useTemporalMotion();
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = anchorRef.current?.closest<HTMLElement>('.s03-cut-stage');
    if (!stage) return;

    let lastMediaActive = '';
    let lastTimecode = '';
    let lastMediaTime = 0;
    let awaitingReentryStart = false;

    const writeMediaActive = (activeIndex: number | null): void => {
      const next = activeIndex === null ? 'none' : String(activeIndex);
      if (next === lastMediaActive) return;
      lastMediaActive = next;
      stage.dataset.activeMedia = next;
    };

    const writeTransport = (seconds: number): void => {
      const time = Math.max(0, Math.min(ACT3_MEDIA_DURATION_SECONDS, seconds));
      stage.style.setProperty(
        '--s03-play',
        `${((time / ACT3_MEDIA_DURATION_SECONDS) * 100).toFixed(3)}%`
      );
      stage.dataset.mediaTime = time.toFixed(3);
      const nextTimecode = formatTimecode(Math.round(time * FRAMES_PER_SECOND));
      if (nextTimecode === lastTimecode) return;
      const readout = stage.querySelector<HTMLElement>('[data-s03-timecode]');
      if (!readout) return;
      lastTimecode = nextTimecode;
      readout.textContent = nextTimecode;
    };

    const resetProjection = (mode: 'idle' | 'exited'): void => {
      lastMediaTime = 0;
      writeMediaActive(null);
      writeTransport(0);
      stage.dataset.mediaMode = mode;
    };

    const writeFrame = (nextFrame: AnimateTimelineFrame): void => {
      if (nextFrame.phase === 'exiting') {
        awaitingReentryStart = true;
        return;
      }
      if (nextFrame.phase === 'idle' || nextFrame.phase === 'exited') {
        resetProjection(nextFrame.phase);
        return;
      }
      // Drag re-entry can publish the old terminal frame before its incoming frame. Keep the
      // already-reset transport at zero until the atomic snapshot leaves that terminal seed.
      if (awaitingReentryStart) {
        if (nextFrame.progress >= 1 - 0.001) {
          resetProjection('idle');
          return;
        }
        awaitingReentryStart = false;
      }
      if (timing.reduced) {
        resetProjection('idle');
        stage.dataset.mediaMode = 'reduced';
        return;
      }

      const elapsedMs = Math.max(0, Math.min(1, nextFrame.progress)) * ACT3_MEDIA_CLOCK_MS;
      const state = resolveAct3MediaState(elapsedMs);
      // A release bounce may recoil the scene clock. The transport overlays hold their
      // furthest completed beat until the scene exits, matching the decoded picture.
      const stableMediaTime = Math.max(lastMediaTime, state.mediaTimeSeconds);
      lastMediaTime = stableMediaTime;
      writeMediaActive(state.mediaIndex);
      writeTransport(stableMediaTime);
      stage.dataset.mediaMode = state.mode;
    };

    writeFrame(frame.get());
    return frame.on('change', writeFrame);
  }, [frame, timing.reduced]);

  return (
    <>
      <span ref={anchorRef} hidden />
      {timing.reduced ? (
        <video
          src={ACT3_VIDEO_SRC}
          poster={ACT3_POSTER_SRC}
          preload="metadata"
          muted
          playsInline
          aria-hidden="true"
          tabIndex={-1}
        />
      ) : (
        <AnimateVideo
          src={ACT3_VIDEO_SRC}
          poster={ACT3_POSTER_SRC}
          animateId="s03-preview-media"
          duration={{ enter: timing.duration(ACT3_MEDIA_SCRUB_DURATION_MS) }}
          timeline={{ delay: timing.delay(ACT3_MEDIA_SCRUB_START_MS) }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </>
  );
});
