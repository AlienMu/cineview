import { Animate } from 'cineview';
import { memo, useMemo, type CSSProperties } from 'react';
import { useTemporalMotion } from './TemporalMotion';

type TickStyle = CSSProperties & { '--tick-angle': string };

type TickDescriptor = {
  index: number;
  major: boolean;
  forwardSector: boolean;
  backwardSector: boolean;
  label: string | null;
  angle: number;
  style: TickStyle;
};

function angularDistance(angle: number, center: number): number {
  const distance = Math.abs(angle - center);
  return Math.min(distance, 360 - distance);
}

function createTicks(): TickDescriptor[] {
  return Array.from({ length: 60 }, (_, index) => {
    // tickAngle: 0deg at 12 o'clock, clockwise. The CSS places each tick with
    // rotate(--tick-angle) translateY(-radius), so a single angle both seats the
    // tick on the shared ring radius AND rotates its bar to point at center — no
    // separate left/top polar math, and no second size base to drift out of sync.
    const tickAngle = index * 6;
    const major = index % 5 === 0;

    return {
      index,
      major,
      forwardSector: angularDistance(tickAngle, 90) <= 30,
      backwardSector: angularDistance(tickAngle, 270) <= 30,
      label: major ? String(index === 0 ? 60 : index).padStart(2, '0') : null,
      angle: tickAngle,
      style: {
        '--tick-angle': `${tickAngle}deg`,
      },
    };
  });
}

// 60 ticks split into 12 clock segments of 5 (each spans 30°). Every segment is a
// plain framework <Animate> — the SAME render path the title uses, which the probe
// proved replays on scene re-entry and unwinds on reverse-drag. There is NO
// timeline.progress read here: that signal is state.localProgress, which collapses
// to 0 on the outgoing/idle-release path even while the element visually holds at
// rest (opacity 1). Binding the reveal to per-segment <Animate> opacity/scale keeps
// the ticks on the proven drag-scrub source instead.
const SEGMENT_COUNT = 12;
const TICKS_PER_SEGMENT = 5;

function TickSpan({ tick }: { tick: TickDescriptor }): JSX.Element {
  return (
    <span
      className={`s01-tick${tick.major ? ' s01-tick--major' : ''}${
        tick.forwardSector ? ' is-forward-sector' : ''
      }${tick.backwardSector ? ' is-backward-sector' : ''}`}
      style={tick.style}
      data-tick-index={tick.index}
    >
      <i className="s01-tick__bar" />
      {tick.label ? <b className="s01-tick__label">{tick.label}</b> : null}
    </span>
  );
}

// The wrapping <Animate>'s motion.div fills the dial (CSS: inset:0) and scales from
// its center, so the 5 ticks inside grow outward onto the ring as the segment
// enters — a progressive "ticks expand onto the ring" reveal. Increasing delay per
// segment makes the reveal sweep clockwise from 12 o'clock as the drag advances,
// reversible + replayable because it IS the framework enter/exit scrub.
export const DIAL_TICKS_TAIL = `dial-ticks-${SEGMENT_COUNT - 1}`;

export const DialTicks = memo(function DialTicks(): JSX.Element {
  const timing = useTemporalMotion();
  const ticks = useMemo(createTicks, []);
  const segments = useMemo(() => {
    return Array.from({ length: SEGMENT_COUNT }, (_, seg) =>
      ticks.slice(seg * TICKS_PER_SEGMENT, seg * TICKS_PER_SEGMENT + TICKS_PER_SEGMENT)
    );
  }, [ticks]);

  return (
    // Kept as a plain, absolutely-positioned host (CSS .s01-dial__ticks) so the
    // commit-time calibration hook + layout measurement still find one node. The
    // reveal lives entirely on the per-segment <Animate> children below.
    <div className="s01-dial__ticks" aria-hidden="true">
      {segments.map((segment, seg) => (
        <Animate
          key={seg}
          animateId={`dial-ticks-${seg}`}
          enterAnimation={{
            initial: { opacity: 0, scale: 0.62 },
            animate: { opacity: 1, scale: 1, transition: { ease: [0.16, 1, 0.3, 1] } },
          }}
          exitAnimation={{ exit: { opacity: 0, scale: 0.4 } }}
          duration={{ enter: timing.duration(240), exit: timing.duration(220) }}
          timeline={{ delay: timing.delay(seg * 42) }}
        >
          <div className="s01-tick-segment">
            {segment.map((tick) => (
              <TickSpan key={tick.index} tick={tick} />
            ))}
          </div>
        </Animate>
      ))}
    </div>
  );
});
