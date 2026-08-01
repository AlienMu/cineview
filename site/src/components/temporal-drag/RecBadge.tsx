import { Animate } from 'cineview';
import { memo } from 'react';
import { useTemporalMotion } from './TemporalMotion';

type RecBadgeProps = {
  isRecording?: boolean;
};

// The recording dot pulses continuously. That pulse MUST ride the framework's
// infinite lane (<Animate infiniteAnimation>), not a CSS `animation: … infinite`:
// the framework gates it via shouldRunInfinite, so the pulse stops the moment the
// HUD leaves its phase. A raw CSS loop keeps beating through exit — the same class
// of bug as the scene-01 hand that kept ticking after everything else faded.
// See rule 6 in AGENTS.md / CLAUDE.md: never re-implement a framework lane.
export const RecBadge = memo(function RecBadge({ isRecording = true }: RecBadgeProps): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <span
      className={`tp-rec${isRecording ? ' is-recording' : ''}`}
      aria-label={isRecording ? 'Recording' : 'Stopped'}
    >
      {isRecording && !timing.reduced ? (
        <Animate
          animateId="tp-rec-dot"
          infiniteAnimation={{
            animate: {
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.15, 1],
              transition: {
                duration: timing.seconds(1.8),
                ease: 'easeInOut',
                repeat: Infinity,
              },
            },
          }}
        >
          <i className="tp-rec-dot" aria-hidden="true" />
        </Animate>
      ) : (
        <i className="tp-rec-dot" aria-hidden="true" />
      )}
      <span>REC</span>
    </span>
  );
});
