import { useEffect, useRef } from 'react';
import { Animate, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

/**
 * Timecode capsule -- unified signature element across Act 2 scenes.
 *
 * Top-left capsule: REC dot driven by framework infinite lane; timecode readout
 * consumes the nearest Animate timeline MotionValue directly without mirroring
 * per-frame progress into React.
 * Readout increments with scroll progress during this shot's center-lock segment;
 * each shot resets to 0 independently.
 */
interface TimecodeAxisProps {
  /** Shot index within Act2 (1, 2...), corresponds to data-scene-index */
  shotIndex: number;
  /** Full-scale duration in seconds for this shot's readout (≈ scroll budget/1000), defaults to 9 */
  seconds?: number;
}

export function TimecodeAxis({
  shotIndex,
  seconds = 9,
}: TimecodeAxisProps): import('react').JSX.Element {
  const { t } = useI18n();
  const timeline = useAnimateTimeline();
  const reduced = usePrefersReducedMotion();
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
      {reduced ? (
        <span className="tc-capsule__rec-dot" aria-hidden="true" />
      ) : (
        <Animate
          animateId={`tc-rec-${shotIndex}`}
          loopAnimation={{
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
