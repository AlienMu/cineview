import { Animate } from 'cineview';
import type { ReactNode } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './Scene5Cinema.css';

/**
 * Phone mockup: 332×720 design baseline (19.5:9), CSS `max-height:75vh` proportional clamp.
 *
 * Breathing box-shadow (3s) and radial glow (5s) follow CLAUDE.md rule 6 via loopAnimation
 * (forbids CSS `animation: … infinite`): infinite-only lane gated by scene runtimeState,
 * automatically stops on scene exit. Lane loops write CSS variables (--phone-breathe / --glow-pulse,
 * reusing film-pan `--film-perf-phase` pattern), shadow/glow consumed via calc() in CSS — variables
 * land on Animate's wrapper motion element and inherit to the actual rounded element, avoiding
 * square-corner shadows. 3s/5s asynchronous periods (LCM 15s) ensure the two beats never stack in sync.
 */
export function PhoneMockup({ children }: { children: ReactNode }): import('react').JSX.Element {
  const reduced = usePrefersReducedMotion();
  const frame = (
    <div className="phone-mockup__frame">
      <span className="phone-mockup__notch" aria-hidden="true" />
      <div className="phone-mockup__screen">{children}</div>
    </div>
  );
  const glow = <div className="phone-mockup__glow" aria-hidden="true" />;

  return (
    <div className="phone-mockup">
      {reduced ? (
        glow
      ) : (
        <Animate
          animateId="cinema-phone-glow"
          loopAnimation={{
            animate: {
              '--glow-pulse': [0, 1, 0],
              transition: { duration: 5, ease: 'easeInOut', repeat: Infinity },
            },
          }}
        >
          {glow}
        </Animate>
      )}
      {reduced ? (
        frame
      ) : (
        <Animate
          animateId="cinema-phone-breathe"
          loopAnimation={{
            animate: {
              '--phone-breathe': [0, 1, 0],
              transition: { duration: 3, ease: 'easeInOut', repeat: Infinity },
            },
          }}
        >
          {frame}
        </Animate>
      )}
    </div>
  );
}
