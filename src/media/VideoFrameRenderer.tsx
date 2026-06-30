/**
 * VideoFrameRenderer — dumb「progress → currentTime」scrub 渲染器。零控件、静音、
 * 内联播放。progress 变 → currentTime = progress * duration。无抽帧(video 原生连续)。
 *
 * 优先用预加载缓存的 objectURL(整段 blob,保证可 seek);未就绪则直接用 src(浏览器
 * 自行 buffer)。SSR 下不 seek。
 *
 * ⚠ scrub 平滑度取决于视频编码的「关键帧(I 帧)密度」。H.264 的 P/B 帧是相对前帧的差分,
 * seek 到任意帧须从最近的 I 帧起逐帧解码到目标帧。若视频关键帧稀疏(常见默认每 ~250 帧一个),
 * 每次 scrub 都要长距离解码 → 解码线程吃满 → 掉帧(尤其往回 seek)。这是编码问题,非本组件可解:
 * 用于 scrub 的视频应重编码为「全关键帧」(每帧皆 I 帧,如 `ffmpeg -i in.mp4 -g 1 out.mp4`),
 * 代价是文件变大,换来任意帧可直接解码。开发环境下,本组件测得 seek 延迟持续偏高时会 console.warn。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useCineViewContext } from '../context/CineViewContext';
import { convertStyle } from '../utils/styleConvert';
import {
  getVideoObjectUrl,
  isMediaPreloaded,
  preloadMedia,
  subscribeToPreloadedMedia,
} from '../hooks/mediaPreloadCache';

// 开发期 scrub 性能守卫:seek 延迟(设 currentTime → 'seeked' 事件)的中位数超此阈值,
// 说明视频关键帧过稀(每次 seek 长距离解码),持续会掉帧。16.7ms 是 60fps 单帧预算,
// 取 50ms(约 3 帧)为「明显跟不上」的保守判据,降低偶发抖动误报。
const SLOW_SCRUB_SEEK_MS = 50;
// 需累计足够样本才判定(避免冷启动首个 seek 的解码器初始化开销造成误报)。
const SCRUB_SAMPLE_MIN = 6;
// 每个 src 只警告一次(跨组件重挂载去重),不刷屏。
const scrubWarnedSrcs = new Set<string>();

export interface VideoFrameRendererProps {
  src: string;
  /** 0..1 擦除进度,由外层 Animate render-prop 馈送。 */
  progress: number;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  'aria-label'?: string;
}

export function VideoFrameRenderer({
  src,
  progress,
  width,
  height,
  style,
  'aria-label': ariaLabel,
}: VideoFrameRendererProps): JSX.Element {
  const context = useCineViewContext();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(() => getVideoObjectUrl(src) ?? null);
  // 开发期 seek 延迟采样(dev-only,跨 progress 变化累计)。累计到 SCRUB_SAMPLE_MIN 后取中位数判定。
  const seekSamplesRef = useRef<number[]>([]);

  const resolvedWidth = useMemo(
    () => (typeof width === 'number' ? (context?.convert(width) ?? width) : width),
    [context, width]
  );
  const resolvedHeight = useMemo(
    () => (typeof height === 'number' ? (context?.convert(height) ?? height) : height),
    [context, height]
  );
  const resolvedStyle = useMemo(() => convertStyle(style, context ?? null), [context, style]);

  // 订阅就绪 + 触发 blob 预加载。就绪后换用 objectURL(整段可 seek)。
  useEffect(() => {
    if (typeof window === 'undefined' || !src) {
      return;
    }
    const existing = getVideoObjectUrl(src);
    if (existing) {
      setObjectUrl(existing);
      return;
    }
    let active = true;
    const unsub = subscribeToPreloadedMedia((readyUrl) => {
      if (readyUrl === src && active) {
        setObjectUrl(getVideoObjectUrl(src) ?? null);
      }
    });
    if (!isMediaPreloaded(src)) {
      void preloadMedia(src, 'video').catch(() => undefined);
    }
    return () => {
      active = false;
      unsub();
    };
  }, [src]);

  // progress → currentTime。等元数据就绪(duration 有效)后才 seek。
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof window === 'undefined') {
      return;
    }
    const seek = (): void => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
      // 开发期:测本次 seek 的解码延迟(设 currentTime → 'seeked')。中位数持续偏高 →
      // 视频关键帧过稀,警告一次。生产不测、不挂监听(零开销)。
      if (process.env.NODE_ENV === 'development' && !scrubWarnedSrcs.has(src)) {
        const startedAt = performance.now();
        video.addEventListener(
          'seeked',
          () => {
            const samples = seekSamplesRef.current;
            samples.push(performance.now() - startedAt);
            if (samples.length < SCRUB_SAMPLE_MIN || scrubWarnedSrcs.has(src)) {
              return;
            }
            const sorted = [...samples].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            if (median > SLOW_SCRUB_SEEK_MS) {
              scrubWarnedSrcs.add(src);
              console.warn(
                `[CineView Warning] AnimateVideo scrub seek is slow (median ${median.toFixed(0)}ms/seek for "${src}").\n\n` +
                  `Cause: the video has sparse keyframes, so each scroll frame must decode a long run of frames from the nearest keyframe.\n` +
                  `Fix: re-encode the scrub video as all-keyframe (every frame an I-frame), e.g.\n` +
                  `  ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4\n` +
                  `This makes any frame directly decodable (larger file, smooth scrub).`
              );
            }
          },
          { once: true }
        );
      }
      video.currentTime = clamped * duration;
    };
    if (video.readyState >= 1 /* HAVE_METADATA */) {
      seek();
      return;
    }
    video.addEventListener('loadedmetadata', seek, { once: true });
    return () => {
      video.removeEventListener('loadedmetadata', seek);
    };
  }, [progress, objectUrl, src]);

  return (
    <video
      ref={videoRef}
      src={objectUrl ?? src}
      muted
      playsInline
      preload="auto"
      aria-label={ariaLabel}
      width={resolvedWidth}
      height={resolvedHeight}
      style={resolvedStyle}
    />
  );
}
