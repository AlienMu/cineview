import { Animate } from 'cineview';
import { formatTimecode } from './timecode';
import { ACT3_FIRST_SELECTION_START_MS } from './act3MediaTimeline';
import { useTemporalMotion } from './TemporalMotion';

const TIMECODE_ENTER_MS = 300;
const TIMECODE_EXIT_MS = 200;
const BREATH_SECONDS = 3.4;

/**
 * Geometry only. `Act3Media` is the single transport writer: it updates the inherited
 * `--s03-play` compositor offset and this component's readout from the same scrub/native time.
 * The two framework lanes here own only entrance, exit and the phase-gated idle breath.
 */
export function TimelinePlayhead(): import('react').JSX.Element {
  const timing = useTemporalMotion();

  return (
    <div className="s03-playhead" aria-hidden="true">
      <div className="s03-playhead__rail">
        <Animate
          animateId="s03-playhead-breath"
          enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
          duration={{ enter: timing.duration(1) }}
          timeline={{ delay: timing.delay(0) }}
          loopAnimation={
            timing.reduced
              ? undefined
              : {
                  animate: {
                    opacity: [1, 0.62, 1],
                    scale: [1, 1.05, 1],
                    transition: {
                      duration: timing.seconds(BREATH_SECONDS),
                      ease: 'easeInOut',
                      repeat: Infinity,
                    },
                  },
                }
          }
        >
          <span className="s03-playhead__beam">
            <span className="s03-playhead__line" />
            <span className="s03-playhead__head" />
          </span>
        </Animate>

        <Animate
          animateId="s03-timecode"
          enterAnimation={{
            initial: { opacity: 0, y: 6, filter: 'blur(4px)' },
            animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          }}
          exitAnimation={{ exit: { opacity: 0, y: 4 } }}
          duration={{
            enter: timing.duration(TIMECODE_ENTER_MS),
            exit: timing.duration(TIMECODE_EXIT_MS),
          }}
          timeline={{ delay: timing.delay(ACT3_FIRST_SELECTION_START_MS) }}
        >
          <span
            className="s03-playhead__readout"
            role="timer"
            aria-live="off"
            aria-hidden={undefined}
            data-s03-timecode=""
          >
            {formatTimecode(0)}
          </span>
        </Animate>
      </div>
    </div>
  );
}
