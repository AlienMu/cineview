import { Animate } from 'cineview';
import { memo } from 'react';
import { useI18n } from '../../i18n';
import { useTemporalMotion } from './TemporalMotion';

export const DragHint = memo(function DragHint(): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();

  return (
    <Animate
      animateId="drag-hint"
      enterAnimation="fade-in"
      exitAnimation={{ exit: { opacity: 0, scale: 0.6 } }}
      duration={{ enter: timing.duration(520), exit: timing.duration(240) }}
      infiniteAnimation={
        timing.reduced
          ? undefined
          : {
              animate: {
                y: [0, 6, 0],
                transition: { duration: timing.seconds(3), ease: 'easeInOut', repeat: Infinity },
              },
            }
      }
      timeline={{ waitFor: 's01-subtitle', delay: timing.delay(200) }}
    >
      <div className="s01-drag-hint" aria-label={t('dragTemporal.s01.dragHintLabel')}>
        <span>DRAG</span>
        <span aria-hidden="true">↓</span>
      </div>
    </Animate>
  );
});
