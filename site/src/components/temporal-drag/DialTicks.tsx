import { Animate } from 'cineview';
import { memo, useMemo, type CSSProperties } from 'react';
import { useTemporalMotion } from './TemporalMotion';

/**
 * The sweep budget. The minute hand's calibration lane runs for exactly this long (see
 * SceneRolling), so a tick's delay IS the moment the hand crosses it. Keeping one
 * constant for both is the whole mechanism: if the hand and the ticks were given
 * separate budgets they would desynchronise and the dial would light up with no
 * visible cause — the "bright arc with nothing driving it" failure this act exists
 * to avoid (task-flow 2026-07-29 §8.1).
 */
export const DIAL_SWEEP_MS = 3000;
const TICK_ENTER_MS = 240;
const TICK_COUNT = 60;
const DEGREES_PER_TICK = 360 / TICK_COUNT;

export type DialEpoch = {
  /** Second-hand angle at mount: 0deg at 12 o'clock, clockwise. */
  secondAngle: number;
  /** Minute-hand angle at mount, including the fractional advance from seconds. */
  minuteAngle: number;
  /** Zero-padded 24-hour clock value. */
  hour: string;
  /** English-only calendar label, independent of the site's selected language. */
  dateLabel: string;
};

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function ordinalSuffix(day: number): string {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return 'th';
  if (day % 10 === 1) return 'st';
  if (day % 10 === 2) return 'nd';
  if (day % 10 === 3) return 'rd';
  return 'th';
}

export function formatEnglishDate(date: Date): string {
  const day = date.getDate();
  return `${ENGLISH_MONTHS[date.getMonth()]} ${day}${ordinalSuffix(day)}`;
}

/**
 * Read one wall-clock snapshot for the hands, hour and English date. Tick reveal is
 * intentionally independent: it follows the minute hand's fixed 60-to-60 first lap.
 */
export function readDialEpoch(now = new Date()): DialEpoch {
  const seconds = now.getSeconds();
  return {
    secondAngle: seconds * DEGREES_PER_TICK,
    minuteAngle: now.getMinutes() * DEGREES_PER_TICK + seconds * (DEGREES_PER_TICK / 60),
    hour: String(now.getHours()).padStart(2, '0'),
    dateLabel: formatEnglishDate(now),
  };
}

/**
 * Absolute delay for tick N, measured from the scene clock's zero.
 *
 * The minute hand always begins at 60/top and completes one calibration revolution
 * before it advances to the current minute. Ticks therefore use the fixed zero-angle
 * lap: tick N opens at N/60 of the sweep, on an exact 50ms grid.
 */
export function tickSweepDelay(index: number): number {
  return (DIAL_SWEEP_MS * index) / TICK_COUNT;
}

type TickStyle = CSSProperties & { '--tick-angle': string };

export type TickDescriptor = {
  index: number;
  animateId: string;
  className: string;
  label: string | null;
  style: TickStyle;
  duration: { enter: number; exit: number };
  timeline: { delay: number };
};

// Shared by all 60 lanes: identical variants, hoisted so the 60 <Animate> calls
// pass one stable object identity each instead of allocating 120 literals per
// render. A tick is invisible until the hand reaches it, so the sweep DRAWS the
// dial rather than dimming a ring that was already fully present.
const TICK_ENTER = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { ease: [0.16, 1, 0.3, 1] } },
} as const;

// Exit is the enter played backwards. Drag exit has no per-element delay lane
// (resolvePropertyValue's 'outgoing' branch reads the render position, not
// calculatedDelay), so all 60 unwind together — which is what we want: a staggered
// exit would strand a partial arc on screen, the exact artifact from §8.1.
const TICK_EXIT = { exit: { opacity: 0 } } as const;

export function createTicks(
  enterMs: number,
  exitMs: number,
  scaleDelay: (milliseconds: number) => number
): TickDescriptor[] {
  return Array.from({ length: TICK_COUNT }, (_, index) => {
    // tickAngle: 0deg at 12 o'clock, clockwise. The CSS places each tick with
    // rotate(--tick-angle) translateY(-radius), so a single angle both seats the
    // tick on the shared ring radius AND rotates its bar to point at center — no
    // separate left/top polar math, and no second size base to drift out of sync.
    const tickAngle = index * DEGREES_PER_TICK;
    const major = index % 5 === 0;

    return {
      index,
      animateId: `s01-tick-${index}`,
      className: `s01-tick${major ? ' s01-tick--major' : ''}`,
      label: major ? String(index === 0 ? 60 : index).padStart(2, '0') : null,
      style: { '--tick-angle': `${tickAngle}deg` },
      duration: { enter: enterMs, exit: exitMs },
      timeline: { delay: scaleDelay(tickSweepDelay(index)) },
    };
  });
}

/**
 * 60 independent framework lanes, one per tick, each on an absolute delay — no
 * `waitFor`, no `stagger`. `waitFor` would mean "start after the previous lane
 * finishes", which for a sweep is the wrong relation entirely (the first tick would
 * wait out the hand's whole revolution). Absolute delays let the ticks and the hand
 * share one clock and stay co-located by construction.
 */
export const DialTicks = memo(function DialTicks({ exitMs }: { exitMs: number }): JSX.Element {
  const timing = useTemporalMotion();
  const ticks = useMemo(
    () => createTicks(timing.duration(TICK_ENTER_MS), timing.duration(exitMs), timing.delay),
    [exitMs, timing]
  );

  return (
    <div className="s01-dial__ticks" aria-hidden="true">
      {ticks.map((tick) => (
        <Animate
          key={tick.animateId}
          animateId={tick.animateId}
          enterAnimation={TICK_ENTER}
          exitAnimation={TICK_EXIT}
          duration={tick.duration}
          timeline={tick.timeline}
        >
          <span className={tick.className} style={tick.style} data-tick-index={tick.index}>
            <i className="s01-tick__bar" />
            {tick.label ? <b className="s01-tick__label">{tick.label}</b> : null}
          </span>
        </Animate>
      ))}
    </div>
  );
});
