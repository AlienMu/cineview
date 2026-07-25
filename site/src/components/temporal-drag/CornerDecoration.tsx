import { Animate, Position } from 'cineview';
import { memo } from 'react';
import { useTemporalMotion } from './TemporalMotion';

type CornerPosition = 'tl' | 'tr' | 'bl' | 'br';

type CornerDecorationProps = {
  position: CornerPosition;
};

const CORNER_COORDS: Record<CornerPosition, { x: number; y: number }> = {
  tl: { x: 22, y: 74 },
  tr: { x: 306, y: 74 },
  bl: { x: 22, y: 724 },
  br: { x: 326, y: 716 },
};

// The corner marks are the final decorative beat, settling just after the ~1.5s
// power-on sweep. Driven by a plain scene-clock delay (not a waitFor) since the
// Act-1 body elements are pointer-gate motion values, not Animate wrappers.
const CORNER_START_MS = 1900;

export const CornerDecoration = memo(function CornerDecoration({
  position,
}: CornerDecorationProps): JSX.Element {
  const timing = useTemporalMotion();
  const coords = CORNER_COORDS[position];
  const animateId = `s01-corner-${position}`;

  return (
    <Position at={coords} className={`s01-corner s01-corner--${position}`}>
      {position === 'tl' || position === 'br' ? (
        <div className="s01-corner__sprockets">
          {Array.from({ length: position === 'tl' ? 3 : 4 }, (_, index) => (
            <Animate
              key={index}
              animateId={`${animateId}-${index}`}
              enterAnimation="fade-in"
              exitAnimation={{ exit: { opacity: 0 } }}
              duration={{ enter: timing.duration(260), exit: timing.duration(220) }}
              timeline={{
                delay: timing.delay(
                  CORNER_START_MS +
                    (position === 'tl' ? 0 : 100) +
                    index * (position === 'tl' ? 80 : 100)
                ),
              }}
            >
              <span className="tp-sprocket" aria-hidden="true" />
            </Animate>
          ))}
        </div>
      ) : (
        <Animate
          animateId={animateId}
          enterAnimation="fade-in"
          exitAnimation={{ exit: { opacity: 0, y: position === 'tr' ? -12 : 12 } }}
          duration={{ enter: timing.duration(420), exit: timing.duration(240) }}
          timeline={{
            delay: timing.delay(CORNER_START_MS + (position === 'tr' ? 220 : 260)),
          }}
        >
          <p className="s01-corner__copy">
            {position === 'tr' ? (
              <>
                SCENE 01
                <br />
                TAKE 01
              </>
            ) : (
              <>
                DIRECTOR&apos;S CUT
                <br />
                CineView
              </>
            )}
          </p>
        </Animate>
      )}
    </Position>
  );
});
