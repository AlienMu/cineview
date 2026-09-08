import { Animate } from 'cineview';
import { memo } from 'react';
import { useTemporalMotion } from './TemporalMotion';

const TIMECODES = Array.from({ length: 20 }, (_, index) => {
  const seconds = 1 + Math.floor(index / 12);
  const frames = (index * 3) % 25;
  return `00:00:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
});

// Scroll speed per column (seconds for one full -50% travel). The list is doubled
// below so translateY(-50%) lands exactly on the seam and the loop is invisible.
const SPEED_SECONDS: Record<'left' | 'center' | 'right', number> = {
  left: 24,
  center: 14,
  right: 8,
};

// Rise lane (Design spec §4 act4: delay 100, enter 1400). 100ms puts it inside the
// 0-300ms opening-response band alongside the ring and the timecode.
const RISE_START_MS = 100;
const RISE_ENTER_MS = 1400;

/**
 * One background column: a rise, and a scroll, on TWO SEPARATE DOM LAYERS.
 *
 * Both animations drive `y`, so they cannot share a node — the second writer would
 * simply overwrite the first. The requirement "outer layer enterAnimation does
 * translation, inner layer loopAnimation does scrolling. Two `y` values on different
 * DOM layers, mutually independent" is therefore structural, not stylistic:
 *
 *   <Animate s04-stream-rise-*>      enterAnimation: y 12% -> 0      (rises from below)
 *     <Animate s04-stream-*>         loopAnimation: y 0% -> -50% (scrolls forever)
 *       <div .s04-stream>            the doubled timecode list
 *
 * The framework renders an extra anonymous motion.div inside EACH <Animate> host, and
 * those shrink-wrap to height 0 — which resolves a percentage `y` to 0px and produces
 * an animation that runs while moving nothing. `.s04-streams .cineview-animate` already
 * carries `position: absolute; inset: 0` for the inner lane; the CSS change order in the
 * report extends it to cover the new outer holder for the same reason.
 *
 * The scroll stays on the framework's infinite lane (never a CSS `animation: … infinite`)
 * so `shouldRunInfinite` freezes it when act 04 leaves its phase. See rule 6.
 */
function StreamColumn({
  position,
}: {
  position: 'left' | 'center' | 'right';
}): import('react').JSX.Element {
  const timing = useTemporalMotion();
  const items = [...TIMECODES, ...TIMECODES];

  const content = (
    <div className={`s04-stream s04-stream--${position}`} aria-hidden="true">
      {items.map((timecode, index) => (
        <span key={`${position}-${index}`}>{timecode}</span>
      ))}
    </div>
  );

  if (timing.reduced) return content;

  const scrolling = (
    <Animate
      animateId={`s04-stream-${position}`}
      loopAnimation={{
        animate: {
          // Keyframes START at the enter lane's landing point (y 0). §1.5 rule 2: an
          // infinite lane that opens somewhere else jumps on the handover frame.
          y: ['0%', '-50%'],
          transition: {
            duration: timing.seconds(SPEED_SECONDS[position]),
            ease: 'linear',
            repeat: Infinity,
          },
        },
      }}
    >
      {content}
    </Animate>
  );

  return (
    <Animate
      animateId={`s04-stream-rise-${position}`}
      // Rises from below. `y` in percent resolves against the holder's own box, which
      // the CSS change order gives `inset: 0` — so 12% is 12% of the stage height.
      //
      // NO per-property `times` here, deliberately. Design spec §1.5 rule 1 asks for the fade
      // to finish in the first 10% while the travel runs full length, but the DRAG lane
      // cannot express that: `resolvePropertyValue` lerps `initial` -> `animate` by a
      // single `localProgress` per property (useAnimateDrag.ts) and never reads
      // `transition`, so a `times` array here would be silently dropped — an authored
      // no-op that reads as implemented. Instead the travel is kept SHORT (12%) so the
      // shared curve cannot produce the "text drifting up while semi-transparent" look that rule is
      // guarding against. Flagged in the report as a framework limitation, not fixed here.
      enterAnimation={{
        initial: { opacity: 0, y: '12%' },
        animate: { opacity: 1, y: '0%' },
      }}
      exitAnimation={{ exit: { opacity: 0, y: '-8%' } }}
      duration={{ enter: timing.duration(RISE_ENTER_MS), exit: timing.duration(620) }}
      timeline={{ delay: timing.delay(RISE_START_MS) }}
    >
      {scrolling}
    </Animate>
  );
}

export const TimeStreams = memo(function TimeStreams(): import('react').JSX.Element {
  return (
    <div className="s04-streams" aria-hidden="true">
      <StreamColumn position="left" />
      <StreamColumn position="center" />
      <StreamColumn position="right" />
    </div>
  );
});
