import { Animate, useAnimateTimeline } from 'cineview';
import { motion, useTransform } from 'framer-motion';
import { useTemporalMotion } from './TemporalMotion';

function ProgressRingPath(): JSX.Element {
  const timeline = useAnimateTimeline();
  const pathLength = useTransform(timeline.progress, [0, 1], [0, 1]);

  return (
    <svg className="s03-ring" viewBox="0 0 200 200" aria-hidden="true">
      <circle className="s03-ring__track" cx="100" cy="100" r="94" />
      <motion.circle
        className="s03-ring__progress"
        cx="100"
        cy="100"
        r="94"
        pathLength="1"
        style={{ pathLength }}
      />
    </svg>
  );
}

export function ProgressRing(): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <Animate
      animateId="s03-progress-ring"
      enterAnimation={{
        initial: { opacity: 0 },
        animate: {
          opacity: 1,
          transition: { duration: timing.seconds(2.2), ease: [0.16, 1, 0.3, 1] },
        },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 0.9 } }}
      duration={{ enter: timing.duration(2200), exit: timing.duration(460) }}
      timeline={{ waitFor: 's03-main-timecode', delay: timing.delay(100) }}
    >
      <ProgressRingPath />
    </Animate>
  );
}
