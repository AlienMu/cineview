import { Animate, useAnimateTimeline } from 'cineview';
import { memo } from 'react';
import { BOARD_ENTER_MS, ClapperboardCanvas } from './clapperboard/ClapperboardCanvas';
import { ACT2_BOARD_GATE_MS, SlateLightRig } from './SlateLightRig';
import { useTemporalMotion } from './TemporalMotion';
import { useI18n } from '../../i18n';

// Scene 02 — 场记板 (Slate / ACTION 高潮). The clapperboard is a canvas particle
// field that converges as the drag scrubs the enter progress and scatters on
// reverse/bounce. Per v3 §0 the framework does NOT wrap the canvas: a plain child
// reads useAnimateTimeline().progress (a MotionValue) and the canvas drives its own
// rAF from it — zero per-frame setState.
function ClapperStage(): JSX.Element {
  const timeline = useAnimateTimeline();
  return <ClapperboardCanvas progress={timeline.progress} phase={timeline.phase} />;
}

// The board starts when the set layer is halfway visible. The rig owns that derived instant
// (`set delay + 50% of set duration`) and this lane consumes it, so the two cannot drift when
// either light timing changes. The long beam/pool/haze/bokeh ramps continue underneath the
// board and countdown; starting at halfway creates overlap without presenting an unlit slate.

// Enter budget. IMPORTED, not declared here: the canvas owns it.
//
// It used to be a local `const BOARD_ENTER_MS = 2400` while ClapperboardCanvas expressed every
// beat as a FRACTION of it, which put the authored duration of each beat in one file and its
// denominator in another. That is the mechanism behind 倒计时太快: cutting this number 8000 -> 2400
// for the `scale: 10` clock silently re-priced the countdown from 720ms/numeral to 216ms without
// touching, or contradicting, anything in the canvas. Now the canvas authors its segments in ms
// and exports the total they sum to, and this lane consumes it — so the arithmetic can only be
// stated in one place.
const BOARD_EXIT_MS = 900;

export const SceneSlate = memo(function SceneSlate(): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();

  return (
    <div className="tp-scene__inner s02-scene">
      {/* The light rig lives at SCENE level, not inside <main>, so the beam can wash the
          whole frame instead of being clipped at the stage's top edge — a hard horizontal
          cut-off there made the frame read as two stacked layers (user report:
          内容明显分层). That was the original "聚光要打进黑场" requirement. */}
      <SlateLightRig />

      <main className="s02-stage">
        {/* The board begins at the set layer's 50% point (ACT2_BOARD_GATE_MS). The wrapper
            carries a real framework drag enter; the
            canvas reads the same timeline progress and runs the staged sequence inside it:
            particles assembling into the OPEN board, the 3·2·1 countdown re-formed from the
            value column, then the clap, then the ACTION word.

            Budget arithmetic: the element clock advances 10ms per 1% of drag (framework default
            `scale: 10`), so a 30-45% gesture has spent 300-450ms of element time by release and
            the settle plays out the remainder at real time. */}
        <Animate
          animateId="s02-clapper"
          enterAnimation={{
            initial: { opacity: 0, scale: 0.94, y: '4%' },
            animate: { opacity: 1, scale: 1, y: '0%' },
          }}
          exitAnimation={{ exit: { opacity: 0, scale: 1.04 } }}
          duration={{
            enter: timing.duration(BOARD_ENTER_MS),
            exit: timing.duration(BOARD_EXIT_MS),
          }}
          timeline={{ delay: timing.delay(ACT2_BOARD_GATE_MS) }}
          // Continuous life for the board, on the FRAMEWORK's infinite lane rather than a
          // CSS `animation: … infinite` (which would keep running through exit and past
          // unmount, the thing the project bans). Reported as 持续动画没按框架要求开发: the
          // board only ever had enter+exit, so once the sequence landed the slate was a
          // dead plate — every moving pixel belonged to the light rig or the canvas.
          //
          // Deliberately tiny (±0.6% scale, ±0.35% drift over 9s): a slate on a stand
          // breathes with the room, it does not sway. Anything larger fights the canvas
          // particles, which sit inside this same box and would smear with it.
          infiniteAnimation={
            timing.reduced
              ? undefined
              : {
                  animate: {
                    scale: [1, 1.006, 1],
                    y: ['0%', '-0.35%', '0%'],
                    transition: {
                      duration: timing.seconds(9),
                      ease: 'easeInOut',
                      repeat: Infinity,
                    },
                  },
                }
          }
        >
          <div
            className="s02-clapper"
            aria-label={`${t('dragTemporal.s02.clapperLabel')} — ${t('dragTemporal.s02.actionWord')}`}
          >
            <ClapperStage />
          </div>
        </Animate>
      </main>
    </div>
  );
});
