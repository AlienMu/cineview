import { useEffect, useRef } from 'react';
import { Animate, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';

/**
 * 时间码胶囊 -- Act 2 两镜的统一签名元素。
 *
 * 左上角小胶囊：REC 红点由框架 infinite lane 驱动，时间读数直接消费最近的
 * Animate timeline MotionValue，不把每帧进度镜像进 React。
 * 读数随本镜 center-lock 段内滚动进度递增，每镜独立从 0 重新计。
 */
interface TimecodeAxisProps {
  /** 本镜在 Act2 中的序号（1、2...），对应 data-scene-index */
  shotIndex: number;
  /** 本镜读数满格秒数（≈ 本镜滚动预算/1000），默认 9 */
  seconds?: number;
}

const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TimecodeAxis({ shotIndex, seconds = 9 }: TimecodeAxisProps): JSX.Element {
  const { t } = useI18n();
  const timeline = useAnimateTimeline();
  const capsuleRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let previousSecond = -1;
    const project = (progress: number): void => {
      const second = Math.round(Math.min(Math.max(progress, 0), 1) * seconds);
      if (second === previousSecond) return;
      previousSecond = second;
      const readout = `00:00:${String(second).padStart(2, '0')}`;
      if (readoutRef.current) readoutRef.current.textContent = readout;
      capsuleRef.current?.setAttribute('aria-label', `${t('cap.tc.rec')} ${readout}`);
    };
    project(timeline.progress.get());
    return timeline.progress.on('change', project);
  }, [seconds, t, timeline.progress]);

  const recLabel = t('cap.tc.rec');

  return (
    <div ref={capsuleRef} className="tc-capsule" aria-label={`${recLabel} 00:00:00`}>
      {PREFERS_REDUCED ? (
        <span className="tc-capsule__rec-dot" aria-hidden="true" />
      ) : (
        <Animate
          animateId={`tc-rec-${shotIndex}`}
          infiniteAnimation={{
            animate: {
              opacity: [1, 0.45, 1],
              scale: [1, 1.45, 1],
              transition: { duration: 1.6, ease: 'easeInOut', repeat: Infinity },
            },
          }}
        >
          <span className="tc-capsule__rec-dot" aria-hidden="true" />
        </Animate>
      )}
      <span className="tc-capsule__rec-label" aria-hidden="true">
        {recLabel}
      </span>
      <span ref={readoutRef} className="tc-capsule__readout" aria-hidden="true">
        00:00:00
      </span>
    </div>
  );
}
