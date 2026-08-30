export const ACT3_VIDEO_SRC = '/act3-edit.mp4';
export const ACT3_POSTER_SRC = '/act3-edit-poster.jpg';
export const ACT3_MEDIA_DURATION_SECONDS = 10;
export const ACT3_CLIP_DURATION_SECONDS = 2;
export const ACT3_CLIP_COUNT = ACT3_MEDIA_DURATION_SECONDS / ACT3_CLIP_DURATION_SECONDS;

/**
 * V1 轨道每段一块的独立缩略帧（2026-08-20，用户报「v1帧为什么都长一样？」——旧实现
 * 五块共用同一张 ACT3_POSTER_SRC）。每帧取自**该段中点**（1/3/5/7/9s，ffmpeg 抽帧
 * scale 360），由 ACT3_CLIP_COUNT 派生：段数变了帧数自动跟，别手写第二份清单。
 * 预览监视器自身的 poster 仍用 ACT3_POSTER_SRC（帧 0 附近的整片定妆帧）。
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
 * V1 拼接提前量（2026-08-20，用户返工）：clip k 的拼接 stroke 必须在播放抵达其
 * 第 k 段**之前**完成 ——「先拼接好，也就是先执行完毕动画」。
 *
 * 数值推导（约束求解，不是拍的）：stroke 长 = 恰一段 SEGMENT，故
 * `stroke_k = [clipSelectionStartMs(k) − LEAD, clipSelectionStartMs(k) + SEGMENT − LEAD]`，
 * 终点恰比播放进入第 k 段早 LEAD。两段式（先全部入场再拖拽，用户钦定）要求首个
 * stroke 起点晚于末块入场（600 + 4×300 + 500 = 2300）⇒ 3200 − LEAD ≥ 2300 ⇒
 * LEAD ≤ 900。取 800：首 stroke 起点 2400 = preview 显影完成时刻（画面就绪 →
 * 剪辑开始），且给入场留 100ms 呼吸；800ms ≈ 一段的 40%，「先拼好」无可争议。
 */
export const ACT3_CLIP_ASSEMBLY_LEAD_MS = 800;

/**
 * 第三幕的**唯一节拍函数**：index 个 SEGMENT 之后的绝对时刻。
 *
 * 播放侧锚点用它，不各自算一遍（2026-08-08）：
 *   - V2 字幕的绝对锚点（字幕本就领先自身内容一整段出现）
 *
 * 原注释写「V1 clip sequencing is owned by Animate `after`」，那已过期：
 * `temporalDragW0.contract.test.ts` 在整个 `/drag` 目录禁用 `after`。别再为某一类
 * lane 另写一个等价的算术函数 —— 那会静默分叉。
 *
 * V1 装配侧（stroke / selection / seam）不再锚在这里：2026-08-20 起它们锚在
 * `clipAssemblyStartMs`（= 本函数 − `ACT3_CLIP_ASSEMBLY_LEAD_MS`），即「提前拼好」。
 * 那是**派生**（新事实从共享节拍平移而来），不是并行的第二套算术。
 */
export function clipSelectionStartMs(index: number): number {
  return ACT3_FIRST_SELECTION_START_MS + index * ACT3_CLIP_SEGMENT_MS;
}

/**
 * V1 clip k 的装配 stroke 起点：比 `clipSelectionStartMs(k)` 提前 LEAD。
 *
 * 消费者：clip k 的 demo/selection lane 起点与 seam k−1 徽章的落定时刻
 * （stroke 长恰一段 SEGMENT ⇒ 相邻 stroke 首尾相接 ⇒ stroke k 的终点 =
 * `clipAssemblyStartMs(k + 1)`，徽章时序的推导形式不变）。
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
