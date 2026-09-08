export const ACT3_VIDEO_SRC = '/act3-edit.mp4';
export const ACT3_POSTER_SRC = '/act3-edit-poster.jpg';
export const ACT3_MEDIA_DURATION_SECONDS = 10;
export const ACT3_CLIP_DURATION_SECONDS = 2;
export const ACT3_CLIP_COUNT = ACT3_MEDIA_DURATION_SECONDS / ACT3_CLIP_DURATION_SECONDS;

/**
 * V1 track's independent thumbnail frames, one per segment (2026-08-20, user reported "why do
 * all v1 frames look the same?" — old implementation shared a single ACT3_POSTER_SRC across
 * all five blocks). Each frame is extracted from **the midpoint of that segment** (1/3/5/7/9s,
 * ffmpeg extraction at scale 360), derived from ACT3_CLIP_COUNT: when segment count changes,
 * frame count follows automatically — don't maintain a second hardcoded list.
 * The preview monitor's own poster still uses ACT3_POSTER_SRC (the full hero frame near frame 0).
 */
export const ACT3_CLIP_POSTERS: readonly string[] = Array.from(
  { length: ACT3_CLIP_COUNT },
  (_, index) => `/act3-clip-poster-${index + 1}.jpg`
);

export const ACT3_CLIP_DEMO_SELECT_LEAD_MS = 220;
export const ACT3_CLIP_SEGMENT_MS = ACT3_CLIP_DURATION_SECONDS * 1000;
export const ACT3_MEDIA_SCRUB_START_MS = 3200;
export const ACT3_MEDIA_SCRUB_DURATION_MS = ACT3_MEDIA_DURATION_SECONDS * 1000;

export const ACT3_FIRST_SELECTION_START_MS = ACT3_MEDIA_SCRUB_START_MS - ACT3_CLIP_SEGMENT_MS;

/**
 * V1 assembly lead time (2026-08-20, user rework): the assembly stroke for clip k must complete
 * **before** playback reaches its segment k — "assemble first, meaning the animation completes
 * before playback arrives."
 *
 * Value derivation (constraint solving, not arbitrary): stroke length = exactly one SEGMENT, so
 * `stroke_k = [clipSelectionStartMs(k) − LEAD, clipSelectionStartMs(k) + SEGMENT − LEAD]`,
 * ending exactly LEAD ms before playback enters segment k. The two-phase design (all clips enter
 * first, then drag begins — user mandated) requires the first stroke's start to come after the
 * last block's entrance (600 + 4×300 + 500 = 2300) ⇒ 3200 − LEAD ≥ 2300 ⇒ LEAD ≤ 900.
 * Chosen value 800: first stroke starts at 2400 = the moment preview finishes appearing (picture
 * ready → editing begins), leaving 100ms breathing room after entrance; 800ms ≈ 40% of one
 * segment, "assemble first" is unambiguous.
 */
export const ACT3_CLIP_ASSEMBLY_LEAD_MS = 800;

/**
 * Act 3's **single timing function**: the absolute timestamp after index SEGMENTs.
 *
 * Playback-side anchors use this, rather than each computing independently (2026-08-08):
 *   - V2 subtitle absolute anchors (subtitles appear one full segment ahead of their content)
 *
 * The old comment "V1 clip sequencing is owned by Animate `after`" is now obsolete:
 * `temporalDragW0.contract.test.ts` disables `after` across the entire `/drag` directory.
 * Don't write a separate equivalent arithmetic function for a given lane type — that silently forks.
 *
 * V1 assembly side (stroke / selection / seam) no longer anchors here: since 2026-08-20 they
 * anchor at `clipAssemblyStartMs` (= this function − `ACT3_CLIP_ASSEMBLY_LEAD_MS`), meaning
 * "assemble ahead of time." That's a **derivation** (new fact shifted from the shared beat),
 * not a parallel second arithmetic system.
 */
export function clipSelectionStartMs(index: number): number {
  return ACT3_FIRST_SELECTION_START_MS + index * ACT3_CLIP_SEGMENT_MS;
}

/**
 * V1 clip k's assembly stroke start: LEAD ms ahead of `clipSelectionStartMs(k)`.
 *
 * Consumers: clip k's demo/selection lane start and seam k−1 badge settle time
 * (stroke length = exactly one SEGMENT ⇒ adjacent strokes connect end-to-end ⇒
 * stroke k's end = `clipAssemblyStartMs(k + 1)`, badge timing derivation form unchanged).
 */
export function clipAssemblyStartMs(index: number): number {
  return clipSelectionStartMs(index) - ACT3_CLIP_ASSEMBLY_LEAD_MS;
}

export const ACT3_MEDIA_CLOCK_MS = ACT3_MEDIA_SCRUB_START_MS + ACT3_MEDIA_SCRUB_DURATION_MS;

export type Act3MediaState = {
  mode: 'idle' | 'scrub' | 'complete';
  /** Preview subtitle segment; null until the delayed picture scrub begins. */
  mediaIndex: number | null;
  mediaTimeSeconds: number;
};

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Resolve the shared transport: playback runs continuously while clips 2–5 assemble ahead of its cuts. */
export function resolveAct3MediaState(elapsedMs: number): Act3MediaState {
  if (elapsedMs < ACT3_MEDIA_SCRUB_START_MS) {
    return { mode: 'idle', mediaIndex: null, mediaTimeSeconds: 0 };
  }
  if (elapsedMs >= ACT3_MEDIA_CLOCK_MS) {
    return {
      mode: 'complete',
      mediaIndex: null,
      mediaTimeSeconds: ACT3_MEDIA_DURATION_SECONDS,
    };
  }

  const scrubProgress = clamp01(
    (elapsedMs - ACT3_MEDIA_SCRUB_START_MS) / ACT3_MEDIA_SCRUB_DURATION_MS
  );
  const mediaTimeSeconds = scrubProgress * ACT3_MEDIA_DURATION_SECONDS;
  const mediaIndex = Math.min(
    ACT3_CLIP_COUNT - 1,
    Math.floor(mediaTimeSeconds / ACT3_CLIP_DURATION_SECONDS)
  );

  return {
    mode: 'scrub',
    mediaIndex,
    mediaTimeSeconds,
  };
}
