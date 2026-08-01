import { Animate } from 'cineview';
import { memo } from 'react';
import { ApertureIris } from './aperture/ApertureIris';
import { DragTimecode } from './DragTimecode';
import { ProgressRing } from './ProgressRing';
import { TimeStreams } from './TimeStreams';
import { useTemporalMotion } from './TemporalMotion';

// 50 frames at the project's 25fps base is exactly 00:00:02:00 — the readout travels
// 0 -> 2s on enter and 2s -> 0 on exit, driven only by the scene's own progress.
const SPAN_FRAMES = 50;

/**
 * Act 04 — 日全食 (total eclipse).
 *
 * The act is one gesture-driven event: the finger pushes the moon's shadow across the
 * disc, and at totality the corona breaks out. Progress is expressed by the RING ONLY —
 * the 20-tick ruler that used to sit at the bottom (`TickBar`) is gone, because a ruler
 * plus a ring is the same information twice.
 *
 * ── Lane budget (设计档 §4, all ABSOLUTE delays) ──────────────────────────────
 *   ring                0 + 1200      (ProgressRing.tsx)
 *   timecode            0 + 1200      (wrapper below; characters cascade inside it)
 *   streams (rise)      100 + 1400    (TimeStreams.tsx)
 *   SMPTE label         240 + 500
 *   aperture iris       1300 + 900    (aperture/ApertureIris.tsx — after the ring closes)
 *
 * tSelf = max(delay + duration) = 1300 + 900 = 2200ms, which is the act's budgeted
 * tSelf exactly. Three lanes (ring 0, timecode 0, streams 100) open inside the
 * 0-300ms response band, so the first pixel of finger travel already moves the frame.
 *
 * The 1300 + 2400 row was the CORONA's. That effect fired 72 filaments outward from the
 * ring, read as a starburst on real hardware and was cut; the iris (方案 C) takes over the
 * identical slot but a shorter budget. Everything the iris draws moves INWARD, which is the
 * reading the corona failed to get.
 *
 * NO `waitFor` anywhere in this act. A chained start resolves to
 * `prev_start + prev_REGISTERED_duration + delay`, and the registered duration is the
 * stagger-inflated budget rather than the authored one, so the error compounds down the
 * chain (act 05 measured an authored 950ms gap running as 299ms). Every lane here states
 * its own absolute offset instead.
 *
 * After 2200ms the iris's eight lit edges keep catching a travelling specular (its canvas runs
 * that highlight on wall-clock elapsed, not on progress — the geometry itself is frozen once
 * the lane lands). That is this act's 防空等 coverage, inherited from the corona's wall-clock
 * drift: there is no frame where every lane has finished and nothing is moving.
 */
export const SceneFlux = memo(function SceneFlux(): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <div className="tp-scene__inner s04-scene">
      <main className="s04-stage">
        <TimeStreams />

        <section className="s04-center">
          <Animate
            animateId="s04-label"
            enterAnimation={{
              // NOT letterSpacing — the drag lane animates exactly ten properties
              // (useAnimateDrag.ts: opacity, x, y, scale, rotate, rotateX/Y, skewX/Y,
              // filter) and drops anything else silently. `y` carries the settle.
              initial: { opacity: 0, y: 10, filter: 'blur(5px)' },
              animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
            }}
            exitAnimation={{ exit: { opacity: 0, y: -10 } }}
            duration={{ enter: timing.duration(500), exit: timing.duration(300) }}
            timeline={{ delay: timing.delay(240) }}
          >
            <p className="s04-label">SMPTE TIME CODE</p>
          </Animate>

          <div className="s04-clock">
            <ProgressRing />
            {/* The act's back half. Its lane opens at 1300 — where the ring's 0+1200 ends —
                so the barrel only starts stopping down once the arc has closed the circle.
                Own lane, own file: see `aperture/ApertureIris.tsx`. */}
            <ApertureIris />
            <Animate
              animateId="s04-main-timecode"
              // Delay 0 and a 1200ms enter: the readout enters TOGETHER with the ring
              // (设计档 §3.4「圆圈 + 时间码同时入场」). The per-character lanes inside do
              // the visible assembly; this wrapper's job is the scale/blur settle around
              // them, so the two schedules complete on the same frame (char 10 ends at
              // 550 + 650 = 1200).
              enterAnimation={{
                initial: { opacity: 0, scale: 0.92, filter: 'blur(6px)' },
                animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
              }}
              // DragTimecode maps this lane's exit progress into reset-then-fade. Keep the
              // holder visually neutral so it cannot hide the digits before they reach zero.
              exitAnimation={{ exit: { opacity: 1, scale: 1, filter: 'blur(0px)' } }}
              duration={{ enter: timing.duration(1200), exit: timing.duration(400) }}
              timeline={{ delay: timing.delay(0) }}
              // A parked scene would otherwise show a frozen number: the digits only
              // change when progress changes. A slow breath keeps the readout alive
              // without touching the digits (those are owned by the rAF-free
              // MotionValue writer in DragTimecode).
              //
              // Keyframes START at the enter landing value (scale 1), not at an offset —
              // `[1, 1.012, 1]`, never `[0.988, 1, 0.988]`. Starting anywhere else makes
              // the handover frame jump.
              infiniteAnimation={
                timing.reduced
                  ? undefined
                  : {
                      animate: {
                        scale: [1, 1.012, 1],
                        transition: {
                          duration: timing.seconds(6),
                          ease: 'easeInOut',
                          repeat: Infinity,
                        },
                      },
                    }
              }
            >
              <DragTimecode spanFrames={SPAN_FRAMES} />
            </Animate>
          </div>
        </section>
      </main>
    </div>
  );
});
