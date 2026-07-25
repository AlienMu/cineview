/**
 * AnimateVideo — 视频帧擦除组件。薄封装 <Animate>,用 render-prop 的 enterProgress
 * 驱动 VideoFrameRenderer 的 currentTime scrub(video 原生连续,无需抽帧)。Animate
 * 仍是唯一 progress owner,本组件只是一个新的进度消费者。
 *
 * 驱动跟随 CineView mode 自动;scrub 跨度 = duration.enter。视觉「入场」用中性恒等变体
 * (initial===animate,建立时间轴但不叠加淡入/位移——scrub 本身即动画)。静音、内联、无控件。
 */
import { Animate } from './Animate';
import { useAnimateTimeline } from './animateTimeline';
import type { CSSProperties } from 'react';
import { VideoFrameRenderer } from '../../media/VideoFrameRenderer';

const NEUTRAL_ENTER = { initial: { opacity: 1 }, animate: { opacity: 1 } };

export interface AnimateVideoProps {
  /**
   * 视频资源地址(建议静音 scrub 用途)。
   *
   * ⚠ 用于 scrub 的视频应重编码为「全关键帧」(每帧皆 I 帧)。H.264 的 P/B 帧是相对
   * 前帧的差分,seek 到任意帧须从最近的关键帧起逐帧解码;普通视频关键帧稀疏(常见默认
   * 每 ~250 帧一个)时,每次滚动 scrub 都要长距离解码 → 解码线程吃满 → 掉帧(往回 seek
   * 尤甚)。重编码命令:`ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4`
   * (代价是文件变大,换来任意帧可直接解码、scrub 顺滑)。开发环境下,若测得 seek 延迟
   * 持续偏高,VideoFrameRenderer 会 console.warn 提示。
   */
  src: string;
  'aria-label'?: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  /** 是否由组件自行预加载整段视频。后场景可设为 false，并由 Scene.assets 后台队列接管。 */
  preload?: boolean;
  /** 组件唯一标识(zone 内排序 / waitFor 目标)。 */
  animateId?: string;
  /** scrub 跨度控制:enterProgress 0→1 映射到视频 0→duration.enter 段。 */
  duration?: {
    enter?: number;
  };
  /** 时间轴排序:delay / waitFor。 */
  timeline?: {
    delay?: number;
    waitFor?: string;
  };
  /** 可见性:重入重播 + 进入/离开视口边距门控。 */
  visibility?: {
    replayOnReenter?: boolean;
    enterMargin?: number;
    exitMargin?: number;
  };
}

type AnimateVideoContentProps = Pick<
  AnimateVideoProps,
  'src' | 'aria-label' | 'width' | 'height' | 'style' | 'preload'
>;

function AnimateVideoContent({
  src,
  'aria-label': ariaLabel,
  width,
  height,
  style,
  preload,
}: AnimateVideoContentProps): JSX.Element {
  const timeline = useAnimateTimeline();

  return (
    <VideoFrameRenderer
      src={src}
      progress={timeline.progress}
      aria-label={ariaLabel}
      width={width}
      height={height}
      style={style}
      preload={preload}
    />
  );
}

export function AnimateVideo({
  src,
  'aria-label': ariaLabel,
  width,
  height,
  style,
  preload,
  animateId,
  duration,
  timeline,
  visibility,
}: AnimateVideoProps): JSX.Element {
  return (
    <Animate
      animateId={animateId}
      enterAnimation={NEUTRAL_ENTER}
      duration={{ enter: duration?.enter }}
      timeline={timeline}
      visibility={visibility}
    >
      <AnimateVideoContent
        src={src}
        aria-label={ariaLabel}
        width={width}
        height={height}
        style={style}
        preload={preload}
      />
    </Animate>
  );
}

AnimateVideo.displayName = 'AnimateVideo';
