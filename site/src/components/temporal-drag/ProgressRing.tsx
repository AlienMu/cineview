import { Animate, useAnimateTimeline } from 'cineview';
import { useEffect, useRef } from 'react';
import { useTemporalMotion } from './TemporalMotion';

/**
 * Act 04 — the eclipse ring.
 *
 * ── Arc length: gesture, then settle. ONE input, not two. ────────────────────
 * The requirement is "跟手段由 dragProgress 驱动弧长；释放后由框架 settle 自动补满
 * 360°", and the sharp edge in it is that the fill-up is NOT a function of
 * `dragProgress`: at release the pointer value may be 0.30 and the arc still has to
 * reach a full circle.
 *
 * That is exactly what `timeline.progress` already is under the drag driver, so the
 * ring reads THAT and nothing else:
 *
 *   - while the finger is down, `useElementTrack`'s follow-finger effect pegs the
 *     scene's element clock to `mapDragPercentToElapsed(...)` = drag% x 10ms
 *     (`scale: 10`), and `resolveEnterLocalProgress` divides that by this lane's
 *     own (delay, enterDuration). So `timeline.progress` IS the gesture, rescaled.
 *   - at release, the same MotionValue keeps being written — now by the settle
 *     animation, which continues from the release elapsed to T at natural rate
 *     (`useElementTrack.ts`, `release.mode === 'settle'`) — so it walks on to 1
 *     on its own.
 *
 * The previous version read `dragProgress` (the raw pointer value) instead, and
 * `handleDragStart` resets that to 0 on every grab while `finishDrag` sets it to 0 at
 * release. Under the new spec that is precisely the wrong source: the arc would
 * COLLAPSE at release rather than fill up. So the pointer value is no longer wired
 * into the arc at all — this component now takes no `dragProgress` prop.
 *
 * See the report's settle verification section for the arithmetic that shows a 30%
 * release lands at local progress 0.25 and settles the remaining 0.75.
 */
function EclipseGraphic(): JSX.Element {
  const timeline = useAnimateTimeline();
  const timing = useTemporalMotion();
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const arc = arcRef.current;

    const write = (): void => {
      const raw = timeline.progress.get();
      const clamped = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      // EXIT MUST BE MIRRORED. Under the drag driver `progress` is a phase-local 0..1:
      // on exit it runs 0 -> 1 again (mode 'outgoing', localProgress =
      // renderElapsed / exitDuration). Read raw, the arc would blank to empty on the
      // FIRST exit frame and then re-fill as the act leaves — the opposite of the
      // eclipse un-winding. `1 - raw` starts exit at the full circle and unwinds it.
      // Same correction, same reason, as `DragTimecode`'s readout mirror.
      const value = timeline.phase.get() === 'exiting' ? 1 - clamped : clamped;
      // `pathLength="1"` normalises the circumference, so the dash offset is a plain
      // 1 - progress and needs no radius arithmetic here.
      if (arc) arc.style.strokeDashoffset = String(1 - value);
    };

    write();
    // Both values, not just progress: the mirror above reads `phase`, so a phase flip
    // that lands on the same progress number would otherwise leave the arc stale.
    const unsubscribeProgress = timeline.progress.on('change', write);
    const unsubscribePhase = timeline.phase.on('change', write);
    return (): void => {
      unsubscribeProgress();
      unsubscribePhase();
    };
  }, [timeline.phase, timeline.progress]);

  return (
    <div className="s04-eclipse" aria-hidden="true">
      <span className="s04-lens__knurl" />
      <span className="s04-lens__barrel" />
      <span className="s04-lens__inner-ring" />
      <span className="s04-eclipse__disc" />
      <Animate
        animateId="s04-eclipse-limb"
        enterAnimation={{
          initial: { opacity: 0, scale: 1 },
          animate: { opacity: 1, scale: 1.06 },
        }}
        exitAnimation={{ exit: { opacity: 0, scale: 1 } }}
        duration={{
          enter: timing.duration(RING_ENTER_MS * LIMB_PROGRESS_SPAN),
          exit: timing.duration(RING_EXIT_MS * LIMB_PROGRESS_SPAN),
        }}
        timeline={{ delay: timing.delay(RING_ENTER_MS * LIMB_ONSET) }}
      >
        <span className="s04-eclipse__limb" />
      </Animate>
      <svg className="s04-eclipse__arc-svg" viewBox="0 0 200 200">
        <circle
          ref={arcRef}
          className="s04-eclipse__arc"
          cx="100"
          cy="100"
          r="91"
          pathLength="1"
          strokeDasharray="1 1"
        />
      </svg>
    </div>
  );
}

/** Ring: delay 0, enter 1200 (act 04 lane budget). */
const RING_ENTER_MS = 1200;
const RING_EXIT_MS = 380;
const LIMB_ONSET = 0.72;
const LIMB_PROGRESS_SPAN = 1 - LIMB_ONSET;

export function ProgressRing(): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <Animate
      animateId="s04-progress-ring"
      enterAnimation={{
        initial: { opacity: 0, scale: 0.82 },
        animate: { opacity: 1, scale: 1 },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 0.84 } }}
      // Absolute delay 0: the ring and the timecode enter TOGETHER (设计档 §3.4
      // 「圆圈 + 时间码同时入场」), and 0 also puts this lane in the 0-300ms
      // opening-response band so the first pixel of finger travel moves something.
      duration={{ enter: timing.duration(RING_ENTER_MS), exit: timing.duration(RING_EXIT_MS) }}
      timeline={{ delay: timing.delay(0) }}
    >
      <div className="s04-eclipse-shell">
        <EclipseGraphic />
      </div>
    </Animate>
  );
}
