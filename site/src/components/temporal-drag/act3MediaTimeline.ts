export const ACT3_VIDEO_SRC = '/act3-edit.mp4';
export const ACT3_POSTER_SRC = '/act3-edit-poster.jpg';
export const ACT3_MEDIA_DURATION_SECONDS = 6;
export const ACT3_CLIP_DURATION_SECONDS = 2;
export const ACT3_CLIP_COUNT = ACT3_MEDIA_DURATION_SECONDS / ACT3_CLIP_DURATION_SECONDS;

export const ACT3_CLIP_DEMO_START_MS = 2100;
export const ACT3_CLIP_DEMO_DRAG_MS = 1100;
export const ACT3_CLIP_DEMO_STRIDE_MS = ACT3_CLIP_DEMO_DRAG_MS;
export const ACT3_CLIP_DEMO_SELECT_LEAD_MS = 220;
// The first V1 stroke lands before the picture starts moving. Each following stroke then
// assembles its block during the preceding two-second range, so the edit is closed before
// the playhead crosses its cut.
export const ACT3_MEDIA_SCRUB_START_MS = ACT3_CLIP_DEMO_START_MS + ACT3_CLIP_DEMO_DRAG_MS;

export const ACT3_FIRST_SELECTION_START_MS =
  ACT3_CLIP_DEMO_START_MS - ACT3_CLIP_DEMO_SELECT_LEAD_MS;
export const ACT3_MEDIA_CLOCK_MS =
  ACT3_MEDIA_SCRUB_START_MS + ACT3_CLIP_COUNT * ACT3_CLIP_DEMO_DRAG_MS;

export type Act3MediaState = {
  mode: 'idle' | 'scrub' | 'complete';
  /** V1 selection highlight; it intentionally leads the picture. */
  activeIndex: number | null;
  /** Preview subtitle segment; null until the delayed picture scrub begins. */
  mediaIndex: number | null;
  mediaTimeSeconds: number;
};

export function clipDragStartMs(index: number): number {
  return ACT3_CLIP_DEMO_START_MS + index * ACT3_CLIP_DEMO_STRIDE_MS;
}

export function clipSelectionStartMs(index: number): number {
  return clipDragStartMs(index) - ACT3_CLIP_DEMO_SELECT_LEAD_MS;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Resolve the one authored transport: three contiguous drag strokes scrub the full clip. */
export function resolveAct3MediaState(elapsedMs: number): Act3MediaState {
  if (elapsedMs < ACT3_FIRST_SELECTION_START_MS) {
    return { mode: 'idle', activeIndex: null, mediaIndex: null, mediaTimeSeconds: 0 };
  }
  if (elapsedMs >= ACT3_MEDIA_CLOCK_MS) {
    return {
      mode: 'complete',
      activeIndex: null,
      mediaIndex: null,
      mediaTimeSeconds: ACT3_MEDIA_DURATION_SECONDS,
    };
  }

  const activeIndex = Math.min(
    ACT3_CLIP_COUNT - 1,
    Math.max(0, Math.floor((elapsedMs - ACT3_FIRST_SELECTION_START_MS) / ACT3_CLIP_DEMO_STRIDE_MS))
  );
  if (elapsedMs < ACT3_MEDIA_SCRUB_START_MS) {
    return { mode: 'idle', activeIndex, mediaIndex: null, mediaTimeSeconds: 0 };
  }

  const scrubProgress = clamp01(
    (elapsedMs - ACT3_MEDIA_SCRUB_START_MS) / (ACT3_CLIP_COUNT * ACT3_CLIP_DEMO_DRAG_MS)
  );
  const mediaTimeSeconds = scrubProgress * ACT3_MEDIA_DURATION_SECONDS;
  const mediaIndex = Math.min(
    ACT3_CLIP_COUNT - 1,
    Math.floor(mediaTimeSeconds / ACT3_CLIP_DURATION_SECONDS)
  );

  return {
    mode: 'scrub',
    activeIndex,
    mediaIndex,
    mediaTimeSeconds,
  };
}
