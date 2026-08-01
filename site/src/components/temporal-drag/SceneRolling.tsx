import { Animate } from 'cineview';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { DialTicks, DIAL_SWEEP_MS, readDialEpoch, type DialEpoch } from './DialTicks';
import { LangToggle } from '../LangToggle';
import { useI18n } from '../../i18n';
import { useTemporalMotion } from './TemporalMotion';

// SEQUENCE (act 1 — calibration dial, 2026-07-29 five-act redesign):
// The hand is the CAUSE of the ticks. Every lane is a framework <Animate> on an
// ABSOLUTE delay against this scene's element track — no waitFor anywhere in the
// act. The minute hand's fixed first rotation spans DIAL_SWEEP_MS and each tick's delay is
// the moment the hand crosses it (see tickSweepDelay), so a lit tick always has a
// visible cause. Two properties of that guarantee are load-bearing:
//   1. drag-mode interpolation is a single two-point lerp driven by one linear
//      localProgress (useAnimateDrag.resolvePropertyValue). Authored `ease` and
//      per-property `times` are ignored under drag, so the hand's angle is exactly
//      linear in elapsed ms — the same linear axis the tick delays are cut from.
//      Alignment is structural, not tuned.
//   2. because `times` cannot split one lane, the hand needs TWO nested lanes: an
//      outer opacity lane (880ms, per the budget table) and an inner rotation lane
//      (DIAL_SWEEP_MS). A single lane would either fade over three seconds or cut
//      the sweep to 880ms and break the tick causality.
const ROLL = {
  ring: 'dial-ring',
  number: 'dial-number',
  eyebrow: 's01-eyebrow',
  title: 's01-title',
  date: 's01-date',
  lang: 's01-lang',
  actions: 's01-actions',
} as const;

// Absolute enter offsets, all measured from the scene clock's zero. 0-300ms is the
// opening-response band: ring + both hands at 0, then number/eyebrow/title/lang and
// finally the buttons at 300, so the first perceptible finger movement always has
// something on screen resolving.
export const ACT1_ENTER_DELAY_MS = {
  ring: 0,
  hand: 0,
  number: 60,
  eyebrow: 80,
  title: 140,
  date: 180,
  lang: 200,
  actions: 300,
} as const;

export const ACT1_ENTER_MS = {
  ring: 420,
  handFade: 880,
  handSweep: DIAL_SWEEP_MS,
  minuteAdvance: 900,
  number: 460,
  eyebrow: 440,
  title: 560,
  date: 460,
  lang: 400,
  actions: 460,
} as const;

// Drag exit has no per-element delay lane: every element starts exiting together.
// Keep the budgets in one narrow band so the complete composition leaves as a unit.
// The previous 200-560ms spread cleared copy/buttons first and stranded the dial as
// a giant bare "01" — exactly the broken mid-drag frame reported by the user.
const EXIT_MS = {
  actions: 700,
  title: 720,
  eyebrow: 700,
  lang: 700,
  number: 720,
  ring: 720,
  ticks: 720,
} as const;

// Real-clock rates for the live-time lane. The hand keeps running once its sweep has
// landed, so the instrument reads as a working clock rather than a spent animation.
export const ACT1_LIVE_SPIN_SECONDS = { second: 60, minute: 3600 } as const;

function createMechanicalRotation(steps: number): { rotate: number[]; times: number[] } {
  const rotate: number[] = [];
  const times: number[] = [];

  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * 360;
    rotate.push(angle, angle);
    times.push(index / steps, (index + 0.92) / steps);
  }
  rotate.push(360);
  times.push(1);

  return { rotate, times };
}

// The live lane lives on its own nested layer, so its rotation composes with (rather
// than overwrites) the sweep lane's angle. Its keyframes therefore start at 0 — that
// layer's own enter landing point — satisfying the "infinite keyframes must start
// where enter ended" rule without having to know the wall-clock angle.
const SECOND_HAND_STEPS = createMechanicalRotation(60);
const MINUTE_HAND_STEPS = createMechanicalRotation(60);

export function createHandSweepContract(startAngle: number): {
  enterAnimation: {
    initial: { opacity: number; rotate: number };
    animate: { opacity: number; rotate: number };
  };
  exitAnimation: { exit: { opacity: number; rotate: number } };
} {
  return {
    enterAnimation: {
      initial: { opacity: 1, rotate: startAngle },
      animate: { opacity: 1, rotate: startAngle + 360 },
    },
    exitAnimation: { exit: { opacity: 1, rotate: startAngle } },
  };
}

export function createMinuteAdvanceContract(targetAngle: number): {
  enterAnimation: {
    initial: { opacity: number; rotate: number };
    animate: { opacity: number; rotate: number };
  };
  exitAnimation: { exit: { opacity: number; rotate: number } };
} {
  return {
    enterAnimation: {
      initial: { opacity: 1, rotate: 0 },
      animate: { opacity: 1, rotate: targetAngle },
    },
    exitAnimation: { exit: { opacity: 1, rotate: 0 } },
  };
}

/**
 * One hand, three framework-owned layers:
 *   1. outer  — opacity only (880ms). Fades the hand in while the sweep is already
 *               under way, which is what the 880ms budget line buys.
 *   2. middle — the second-hand calibration sweep from its sampled wall-clock angle
 *               through one full turn back to the same angle. Exit unwinds it.
 *   3. inner  — the framework infinite lane: real-rate live time, phase-gated by
 *               shouldRunInfinite so it cannot keep ticking after the act leaves.
 */
function RunningSecondHand({ startAngle }: { startAngle: number }): JSX.Element {
  const timing = useTemporalMotion();
  const sweep = createHandSweepContract(startAngle);
  return (
    <Animate
      animateId="s01-hand-second"
      enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      exitAnimation={{ exit: { opacity: 0 } }}
      duration={{
        enter: timing.duration(ACT1_ENTER_MS.handFade),
        exit: timing.duration(EXIT_MS.ring),
      }}
      timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.hand) }}
    >
      <span className="s01-hand-sweep s01-hand-sweep--second">
        <Animate
          animateId="s01-hand-second-sweep"
          enterAnimation={sweep.enterAnimation}
          // Reverse-drag reads animate -> initial, and a forward exit reads
          // animate -> this target. Both therefore rewind the turn instead of
          // continuing it: exit is the sweep played backwards, per the act spec.
          exitAnimation={sweep.exitAnimation}
          duration={{
            enter: timing.duration(ACT1_ENTER_MS.handSweep),
            exit: timing.duration(EXIT_MS.ring),
          }}
          timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.hand) }}
          infiniteAnimation={
            timing.reduced
              ? undefined
              : {
                  animate: {
                    rotate: SECOND_HAND_STEPS.rotate,
                    transition: {
                      duration: timing.seconds(ACT1_LIVE_SPIN_SECONDS.second),
                      ease: 'linear',
                      times: SECOND_HAND_STEPS.times,
                      repeat: Infinity,
                    },
                  },
                }
          }
        >
          <span className="s01-hand-pivot s01-hand-pivot--second">
            <span className="s01-hand s01-hand--second" />
          </span>
        </Animate>
      </span>
    </Animate>
  );
}

/**
 * The minute hand has two sequential rotation lanes. The first is the fixed 60-to-60
 * calibration lap that reveals the ticks; only after that lap lands does the second lane
 * advance to the sampled minute. Their transforms compose, so minute 59 approaches but never
 * crosses two complete turns. The live one-hour rotation begins from that settled position.
 */
function RunningMinuteHand({ targetAngle }: { targetAngle: number }): JSX.Element {
  const timing = useTemporalMotion();
  const sweep = createHandSweepContract(0);
  const advance = createMinuteAdvanceContract(targetAngle);

  return (
    <Animate
      animateId="s01-hand-minute"
      enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      exitAnimation={{ exit: { opacity: 0 } }}
      duration={{
        enter: timing.duration(ACT1_ENTER_MS.handFade),
        exit: timing.duration(EXIT_MS.ring),
      }}
      timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.hand) }}
    >
      <span className="s01-hand-sweep s01-hand-sweep--minute">
        <Animate
          animateId="s01-hand-minute-sweep"
          enterAnimation={sweep.enterAnimation}
          exitAnimation={sweep.exitAnimation}
          duration={{
            enter: timing.duration(ACT1_ENTER_MS.handSweep),
            exit: timing.duration(EXIT_MS.ring),
          }}
          timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.hand) }}
        >
          <span className="s01-hand-minute-offset">
            <Animate
              animateId="s01-hand-minute-advance"
              enterAnimation={advance.enterAnimation}
              exitAnimation={advance.exitAnimation}
              duration={{
                enter: timing.duration(ACT1_ENTER_MS.minuteAdvance),
                exit: timing.duration(EXIT_MS.ring),
              }}
              timeline={{ delay: timing.delay(DIAL_SWEEP_MS) }}
              infiniteAnimation={
                timing.reduced
                  ? undefined
                  : {
                      animate: {
                        rotate: MINUTE_HAND_STEPS.rotate,
                        transition: {
                          duration: timing.seconds(ACT1_LIVE_SPIN_SECONDS.minute),
                          ease: 'linear',
                          times: MINUTE_HAND_STEPS.times,
                          repeat: Infinity,
                        },
                      },
                    }
              }
            >
              <span className="s01-hand-pivot s01-hand-pivot--minute">
                <span className="s01-hand s01-hand--minute" />
              </span>
            </Animate>
          </span>
        </Animate>
      </span>
    </Animate>
  );
}

// The dial shell carries no lane of its own. It used to wrap everything in a 980ms
// opacity/scale/blur takeover, which both duplicated the ring lane and smeared the
// tick sweep behind a blur that was still resolving while ticks were lighting.
function DialShell({ children, label }: { children: ReactNode; label: string }): JSX.Element {
  return (
    <div className="s01-dial-shell">
      <div className="s01-dial" role="img" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function GatedInnerRing(): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.ring}
      enterAnimation={{
        initial: { opacity: 0, scale: 0.72 },
        animate: { opacity: 1, scale: 1 },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 0.72 } }}
      duration={{ enter: timing.duration(ACT1_ENTER_MS.ring), exit: timing.duration(EXIT_MS.ring) }}
      timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.ring) }}
    >
      <div className="s01-inner-ring" />
    </Animate>
  );
}

function GatedCenterNumber({
  hour,
  previousHour,
}: {
  hour: string;
  previousHour: string | null;
}): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.number}
      enterAnimation={{
        initial: { opacity: 0, scale: 0.76, filter: 'blur(10px)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 1.08, filter: 'blur(8px)' } }}
      duration={{
        enter: timing.duration(ACT1_ENTER_MS.number),
        exit: timing.duration(EXIT_MS.number),
      }}
      timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.number) }}
    >
      <span className="s01-center-number" data-hour-rollover={previousHour ? '' : undefined}>
        {previousHour ? (
          <span className="s01-center-number__value is-previous">{previousHour}</span>
        ) : null}
        <span className="s01-center-number__value is-current">{hour}</span>
      </span>
    </Animate>
  );
}

// Copy, language toggle and actions are parallel lanes on the same clock. Their small
// absolute offsets preserve editorial rhythm without making one group wait for the
// previous group to finish; by the first commit window the whole composition exists.
function GatedEyebrow({ text }: { text: string }): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.eyebrow}
      enterAnimation={{
        initial: { opacity: 0, x: '-24%', rotate: -2, filter: 'blur(5px)' },
        animate: { opacity: 1, x: '0%', rotate: 0, filter: 'blur(0px)' },
      }}
      exitAnimation={{ exit: { opacity: 0, x: '18%', rotate: 2, filter: 'blur(4px)' } }}
      duration={{
        enter: timing.duration(ACT1_ENTER_MS.eyebrow),
        exit: timing.duration(EXIT_MS.eyebrow),
      }}
      timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.eyebrow) }}
    >
      <p className="s01-eyebrow">{text}</p>
    </Animate>
  );
}

function GatedTitle(): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.title}
      enterAnimation={{
        initial: { opacity: 0, scale: 1.16, filter: 'blur(16px)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 0.86, filter: 'blur(12px)' } }}
      duration={{
        enter: timing.duration(ACT1_ENTER_MS.title),
        exit: timing.duration(EXIT_MS.title),
      }}
      timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.title) }}
    >
      <h1 className="s01-title">CineView</h1>
    </Animate>
  );
}

function GatedDate({ text }: { text: string }): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.date}
      enterAnimation={{
        initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
      }}
      exitAnimation={{ exit: { opacity: 0, y: -8, filter: 'blur(4px)' } }}
      duration={{
        enter: timing.duration(ACT1_ENTER_MS.date),
        exit: timing.duration(EXIT_MS.title),
      }}
      timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.date) }}
    >
      <p className="s01-date">{text}</p>
    </Animate>
  );
}

type LiveDialClock = {
  hour: string;
  dateLabel: string;
  previousHour: string | null;
};

function useLiveDialClock(epoch: DialEpoch): LiveDialClock {
  const [clock, setClock] = useState<LiveDialClock>({
    hour: epoch.hour,
    dateLabel: epoch.dateLabel,
    previousHour: null,
  });

  useEffect(() => {
    let timeout = 0;
    const update = (): void => {
      const next = readDialEpoch();
      setClock((current) => {
        if (current.hour === next.hour && current.dateLabel === next.dateLabel) return current;
        return {
          hour: next.hour,
          dateLabel: next.dateLabel,
          previousHour: current.hour === next.hour ? null : current.hour,
        };
      });
      const now = Date.now();
      timeout = window.setTimeout(update, 60_000 - (now % 60_000) + 20);
    };

    const now = Date.now();
    timeout = window.setTimeout(update, 60_000 - (now % 60_000) + 20);
    return (): void => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!clock.previousHour) return;
    const timeout = window.setTimeout(() => {
      setClock((current) => ({ ...current, previousHour: null }));
    }, 520);
    return (): void => window.clearTimeout(timeout);
  }, [clock.previousHour]);

  return clock;
}

// The language toggle now belongs to act 1 rather than the app shell: as page-level
// chrome it was the one element that ignored the drag timeline entirely, sitting at
// full opacity over every act.
function GatedLangToggle(): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <div className="s01-lang-slot">
      <Animate
        animateId={ROLL.lang}
        enterAnimation={{
          initial: { opacity: 0, y: '-40%', filter: 'blur(6px)' },
          animate: { opacity: 1, y: '0%', filter: 'blur(0px)' },
        }}
        exitAnimation={{ exit: { opacity: 0, y: '-30%', filter: 'blur(5px)' } }}
        duration={{
          enter: timing.duration(ACT1_ENTER_MS.lang),
          exit: timing.duration(EXIT_MS.lang),
        }}
        timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.lang) }}
      >
        <LangToggle variant="drag" />
      </Animate>
    </div>
  );
}

function GatedActions({
  actionsLabel,
  btnHome,
  btnDocs,
}: {
  actionsLabel: string;
  btnHome: string;
  btnDocs: string;
}): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.actions}
      enterAnimation={{
        initial: { opacity: 0, scale: 0.82, filter: 'blur(8px)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 1.08, filter: 'blur(7px)' } }}
      duration={{
        enter: timing.duration(ACT1_ENTER_MS.actions),
        exit: timing.duration(EXIT_MS.actions),
      }}
      timeline={{ delay: timing.delay(ACT1_ENTER_DELAY_MS.actions) }}
    >
      <div className="s01-actions-band">
        <nav className="s01-actions" aria-label={actionsLabel}>
          <a className="tp-btn tp-btn--primary" href="/docs">
            {btnDocs}
          </a>
          <a className="tp-btn tp-btn--ghost" href="/">
            {btnHome}
          </a>
        </nav>
      </div>
    </Animate>
  );
}

export const SceneRolling = memo(function SceneRolling(): JSX.Element {
  const { t } = useI18n();
  // Sampled once per mount. The hands and all 60 tick delays derive from this one
  // reading, so they cannot disagree about where "now" is.
  const [epoch] = useState<DialEpoch>(readDialEpoch);
  const clock = useLiveDialClock(epoch);

  return (
    <div className="tp-scene__inner s01-scene">
      <main className="s01-stage">
        <GatedLangToggle />

        <DialShell label={t('dragTemporal.s01.dialLabel')}>
          <DialTicks exitMs={EXIT_MS.ticks} />
          <GatedInnerRing />
          <GatedCenterNumber hour={clock.hour} previousHour={clock.previousHour} />
          <GatedDate text={clock.dateLabel} />
          <div className="s01-hands" aria-hidden="true">
            <RunningSecondHand startAngle={epoch.secondAngle} />
            <RunningMinuteHand targetAngle={epoch.minuteAngle} />
            <span className="s01-hands__pin" />
          </div>
        </DialShell>

        <section className="s01-title-area">
          <GatedEyebrow text={t('dragTemporal.s01.eyebrow')} />
          <GatedTitle />
        </section>

        <GatedActions
          actionsLabel={t('dragTemporal.s01.actionsLabel')}
          btnHome={t('dragTemporal.s01.btnHome')}
          btnDocs={t('dragTemporal.s01.btnDocs')}
        />
      </main>
    </div>
  );
});
