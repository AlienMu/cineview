import { Animate } from 'cineview';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { memo } from 'react';
import { useI18n } from '../../i18n';
import { useTemporalMotion } from './TemporalMotion';

type TickBarProps = {
  dragProgress: MotionValue<number>;
};

export const TickBar = memo(function TickBar({ dragProgress }: TickBarProps): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();
  const markerLeft = useTransform(dragProgress, [0, 1], ['0%', '100%']);

  return (
    <div className="s03-tickbar" aria-label={t('dragTemporal.s04.rulerLabel')}>
      <Animate
        animateId="s03-ticks"
        enterAnimation={{
          initial: { opacity: 0, scaleY: 0 },
          animate: {
            opacity: 1,
            scaleY: 1,
            transition: { duration: timing.seconds(0.3), ease: [0.16, 1, 0.3, 1] },
          },
        }}
        exitAnimation={{ exit: { opacity: 0, scale: 0.2 } }}
        duration={{ enter: timing.duration(300), exit: timing.duration(520) }}
        timeline={{ waitFor: 's03-progress-ring' }}
        stagger={{ each: timing.stagger(45) }}
      >
        <div className="s03-tickbar__ticks" aria-hidden="true">
          {Array.from({ length: 20 }, (_, index) => (
            <span key={index} className={index % 5 === 0 ? 'is-major' : undefined} />
          ))}
        </div>
      </Animate>
      <motion.span
        className="s03-tickbar__marker"
        style={{ left: markerLeft }}
        aria-hidden="true"
      />
    </div>
  );
});
