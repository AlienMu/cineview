export const ACT3_VIDEO_SRC = '/act3-edit.mp4';
export const ACT3_POSTER_SRC = '/act3-edit-poster.jpg';
export const ACT3_MEDIA_DURATION_SECONDS = 6;
export const ACT3_CLIP_DURATION_SECONDS = 2;
export const ACT3_CLIP_COUNT = ACT3_MEDIA_DURATION_SECONDS / ACT3_CLIP_DURATION_SECONDS;

export const ACT3_CLIP_DEMO_SELECT_LEAD_MS = 220;
export const ACT3_CLIP_SEGMENT_MS = ACT3_CLIP_DURATION_SECONDS * 1000;
export const ACT3_MEDIA_SCRUB_START_MS = 3200;
export const ACT3_MEDIA_SCRUB_DURATION_MS = ACT3_MEDIA_DURATION_SECONDS * 1000;

export const ACT3_FIRST_SELECTION_START_MS = ACT3_MEDIA_SCRUB_START_MS - ACT3_CLIP_SEGMENT_MS;

/**
 * 第三幕的**唯一节拍函数**：index 个 SEGMENT 之后的绝对时刻。
 *
 * 三类 lane 共用它，不各自算一遍（2026-08-08）：
 *   - V2 字幕 / playhead 的绝对锚点
 *   - V1 clip 的 stroke 起点 —— `clipSelectionStartMs(i)` 展开即
 *     `SCRUB_START + (i − 1) * SEGMENT`（因为 FIRST_SELECTION = SCRUB_START − SEGMENT）
 *   - seam 徽章 —— `clipSelectionStartMs(i + 1)` 即 clip i 的 lane 末端（lane 长恰一段）
 *
 * 原注释写「V1 clip sequencing is owned by Animate `waitFor`」，那已过期：
 * `temporalDragW0.contract.test.ts` 在整个 `/drag` 目录禁用 `waitFor`，V1 clip 现在
 * 也走这个函数。别再为某一类 lane 另写一个等价的算术函数 —— 那会静默分叉。
 */
export function clipSelectionStartMs(index: number): number {
  return ACT3_FIRST_SELECTION_START_MS + index * ACT3_CLIP_SEGMENT_MS;
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

/** Resolve the shared transport: playback runs continuously while clips 2/3 assemble on its cuts. */
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
