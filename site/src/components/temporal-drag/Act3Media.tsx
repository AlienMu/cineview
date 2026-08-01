import type { AnimatePhase, AnimateTimeline } from 'cineview';
import { memo, useEffect, useRef } from 'react';
import { formatTimecode } from '../../hooks/useTimecode';
import {
  ACT3_MEDIA_CLOCK_MS,
  ACT3_MEDIA_DURATION_SECONDS,
  ACT3_POSTER_SRC,
  ACT3_VIDEO_SRC,
  resolveAct3MediaState,
} from './act3MediaTimeline';

interface Act3MediaProps {
  progress: AnimateTimeline['progress'];
  phase: AnimateTimeline['phase'];
  reduced: boolean;
}

const FRAMES_PER_SECOND = 25;
const SEEK_EPSILON_SECONDS = 1 / 48;

function clampMediaTime(seconds: number): number {
  return Math.max(0, Math.min(ACT3_MEDIA_DURATION_SECONDS, seconds));
}

export const Act3Media = memo(function Act3Media({
  progress,
  phase,
  reduced,
}: Act3MediaProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const stage = video?.closest<HTMLElement>('.s03-cut-stage');
    if (!video || !stage) return;

    let lastActive = '';
    let lastMediaActive = '';
    let lastTimecode = '';
    let lastMediaTime = 0;
    let pendingSeek = 0;
    let currentPhase = phase.get();

    const writeActive = (activeIndex: number | null): void => {
      const next = activeIndex === null ? 'none' : String(activeIndex);
      if (next === lastActive) return;
      lastActive = next;
      stage.dataset.activeSelection = next;
    };

    const writeMediaActive = (activeIndex: number | null): void => {
      const next = activeIndex === null ? 'none' : String(activeIndex);
      if (next === lastMediaActive) return;
      lastMediaActive = next;
      stage.dataset.activeMedia = next;
    };

    const writeTransport = (seconds: number): void => {
      const time = clampMediaTime(seconds);
      stage.style.setProperty(
        '--s03-play',
        `${((time / ACT3_MEDIA_DURATION_SECONDS) * 100).toFixed(3)}%`
      );
      stage.dataset.mediaTime = time.toFixed(3);
      const nextTimecode = formatTimecode(Math.round(time * FRAMES_PER_SECOND));
      if (nextTimecode !== lastTimecode) {
        const readout = stage.querySelector<HTMLElement>('[data-s03-timecode]');
        if (readout) {
          lastTimecode = nextTimecode;
          readout.textContent = nextTimecode;
        }
      }
    };

    const seek = (seconds: number, force = false): void => {
      const time = clampMediaTime(seconds);
      pendingSeek = time;
      if (video.readyState === 0) return;
      if (!force && Math.abs(video.currentTime - time) < SEEK_EPSILON_SECONDS) return;
      video.currentTime = time;
    };

    const writeFromTimeline = (): void => {
      if (currentPhase === 'idle' || currentPhase === 'exiting' || currentPhase === 'exited') {
        return;
      }
      if (reduced) {
        writeActive(null);
        writeMediaActive(null);
        lastMediaTime = 0;
        seek(0);
        writeTransport(0);
        stage.dataset.mediaMode = 'reduced';
        return;
      }

      const elapsedMs = Math.max(0, Math.min(1, progress.get())) * ACT3_MEDIA_CLOCK_MS;
      const state = resolveAct3MediaState(elapsedMs);
      // Element progress may recoil during a release bounce or re-grab. Re-seeking the native
      // video backward during the same activation produces a decoded-frame flash that reads as
      // a reset. The picture therefore advances monotonically; `exited` is the sole reset point.
      const stableMediaTime = Math.max(lastMediaTime, state.mediaTimeSeconds);
      lastMediaTime = stableMediaTime;
      writeActive(state.activeIndex);
      writeMediaActive(state.mediaIndex);
      seek(stableMediaTime);
      writeTransport(stableMediaTime);
      stage.dataset.mediaMode = state.mode;
    };

    const writePhase = (nextPhase: AnimatePhase): void => {
      currentPhase = nextPhase;
      if (nextPhase === 'exiting') {
        // Freeze the scrubbed frame while the preview lane owns blur + fade exit.
        return;
      }
      if (nextPhase === 'exited') {
        lastMediaTime = 0;
        writeActive(null);
        writeMediaActive(null);
        seek(0, true);
        writeTransport(0);
        stage.dataset.mediaMode = 'exited';
        return;
      }
      if (nextPhase === 'idle') {
        return;
      }
      writeFromTimeline();
    };

    const handleLoadedMetadata = (): void => {
      seek(pendingSeek, true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    writePhase(phase.get());
    const unsubscribeProgress = progress.on('change', writeFromTimeline);
    const unsubscribePhase = phase.on('change', writePhase);

    return () => {
      unsubscribeProgress();
      unsubscribePhase();
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [phase, progress, reduced]);

  return (
    <video
      ref={videoRef}
      src={ACT3_VIDEO_SRC}
      poster={ACT3_POSTER_SRC}
      preload="auto"
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      data-s03-preview-video=""
    />
  );
});
