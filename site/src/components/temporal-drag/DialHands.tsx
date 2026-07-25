import { Animate } from 'cineview';
import { memo } from 'react';
import { useTemporalMotion } from './TemporalMotion';

export const DialHands = memo(function DialHands(): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <div className="s01-hands" aria-hidden="true">
      <Animate
        animateId="hand-second"
        enterAnimation={{
          initial: { opacity: 0, rotate: -28 },
          animate: {
            opacity: 1,
            rotate: 48,
            transition: { duration: timing.seconds(0.8), ease: [0.16, 1, 0.3, 1] },
          },
        }}
        exitAnimation={{ exit: { opacity: 0, rotate: 96 } }}
        duration={{ enter: timing.duration(800), exit: timing.duration(520) }}
        timeline={{ waitFor: 'scene-number-01' }}
      >
        <span className="s01-hand s01-hand--second" />
      </Animate>
      <Animate
        animateId="hand-minute"
        enterAnimation={{
          initial: { opacity: 0, rotate: -72 },
          animate: {
            opacity: 1,
            rotate: -24,
            transition: { duration: timing.seconds(0.8), ease: [0.16, 1, 0.3, 1] },
          },
        }}
        exitAnimation={{ exit: { opacity: 0, rotate: 30 } }}
        duration={{ enter: timing.duration(800), exit: timing.duration(480) }}
        timeline={{ waitFor: 'scene-number-01', delay: timing.delay(120) }}
      >
        <span className="s01-hand s01-hand--minute" />
      </Animate>
      <span className="s01-hands__pin" />
    </div>
  );
});
