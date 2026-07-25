import { Animate } from 'cineview';
import { memo, type RefObject } from 'react';
import { useTemporalMotion } from './TemporalMotion';

type TimecodeDisplayProps = {
  value: string;
  animateId: string;
  waitFor?: string;
  delay?: number;
  each?: number;
  displayRef?: RefObject<HTMLDivElement>;
  className?: string;
};

export const TimecodeDisplay = memo(function TimecodeDisplay({
  value,
  animateId,
  waitFor,
  delay = 0,
  each = 40,
  displayRef,
  className = '',
}: TimecodeDisplayProps): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <div ref={displayRef} className={`tp-timecode ${className}`.trim()} aria-label={value}>
      <Animate
        animateId={animateId}
        enterAnimation={{
          initial: { opacity: 0, y: '35%' },
          animate: {
            opacity: 1,
            y: 0,
            transition: { duration: timing.seconds(0.28), ease: [0.16, 1, 0.3, 1] },
          },
        }}
        exitAnimation={{ exit: { opacity: 0, y: '-45%' } }}
        duration={{ enter: timing.duration(280), exit: timing.duration(320) }}
        timeline={{ waitFor, delay: timing.delay(delay) }}
        stagger={{ each: timing.stagger(each) }}
      >
        <span className="tp-timecode__characters">
          {value.split('').map((character, index) => (
            <span key={`${index}-${character}`} data-timecode-char="">
              {character}
            </span>
          ))}
        </span>
      </Animate>
    </div>
  );
});
