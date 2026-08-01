import { Animate, useAnimateTimeline } from 'cineview';
import { useEffect, useRef } from 'react';
import { formatTimecode } from '../../hooks/useTimecode';
import { useTemporalMotion } from './TemporalMotion';

type DragTimecodeProps = {
  /**
   * Frames the readout spans across the whole gesture. At the project's 25fps base,
   * 50 frames is exactly 00:00:02:00 — the "0 到 2" the readout is asked to travel.
   */
  spanFrames: number;
};

// Per-character lane schedule, rebuilt for the act-04 redesign budget (设计档 §4:
// 时间码 delay 0 / enter 1200, entering TOGETHER with the ring).
//
// The old numbers were CHAR_START_MS 2400 + a 180ms stride against a 3000ms budget —
// i.e. the last of 11 characters started at 4200 and ran to 7200, more than twice the
// act's ~3700ms tSelf. That schedule belonged to the pre-redesign timeline where this
// act's lanes were authored in the thousands.
//
// The 11 characters now cascade INSIDE the wrapper's 1200ms window rather than beyond
// it: 11 * 55 = 550ms of stride plus a 650ms per-character enter lands the last
// character exactly at 1200ms, so the whole readout is assembled when the wrapper's own
// lane completes. Char 0 at delay 0 also puts this run in the 0-300ms opening-response
// band alongside the ring.
const CHAR_ENTER_MS = 650;
const CHAR_START_MS = 0;
const CHAR_STRIDE_MS = 55;

// Exit uses one continuous framework timeline: count back to zero during the first 65%,
// then hold zero while the remaining 35% fades the readout. No second clock is introduced.
const EXIT_RESET_FRACTION = 0.65;

/**
 * Scene 04's headline timecode.
 *
 * ONE source of truth: the scene's own scrub progress. Enter walks the readout 0 -> 2s,
 * exit walks it 2s -> 0, and nothing else is allowed to write it.
 *
 * Two things were removed to get here, both reported as defects:
 *
 *  1. A FREE RUN (`runFrames`, a rAF accumulator at 40ms/frame) that kept the counter
 *     ticking once the scene settled. That made the number climb on its own — 「时间不要自己
 *     涨，而是拖拽的时候变化」. A timecode that advances without input is not continuous
 *     motion, it is a second clock competing with the gesture.
 *
 *  2. A SECOND SOURCE: the readout used to prefer `signedDragProgress` while a finger was
 *     down and fall back to `timeline.progress` otherwise. Those two disagree, so the
 *     handover was a step discontinuity — the reported 跳变. Concretely, at release
 *     `signed` snaps to 0 and the value jumped from `baseFrame + signed * dragSpan` to
 *     `baseFrame - (1 - progress) * enterSpan`. One source cannot disagree with itself.
 */
export function DragTimecode({ spanFrames }: DragTimecodeProps): JSX.Element {
  const timeline = useAnimateTimeline();
  const timing = useTemporalMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let lastValue = '';
    let lastOpacity = '';
    const write = (): void => {
      const raw = Math.max(0, Math.min(1, timeline.progress.get()));
      const currentPhase = timeline.phase.get();
      const exiting = currentPhase === 'exiting';
      // The reset completes before opacity is allowed to move. Both values are projections of
      // this lane's one exit progress, so re-grab/reverse cannot desynchronise them.
      const resetProgress = exiting ? Math.min(1, raw / EXIT_RESET_FRACTION) : raw;
      const scrub = exiting ? 1 - resetProgress : raw;
      const exitOpacity =
        raw <= EXIT_RESET_FRACTION
          ? 1
          : 1 - (raw - EXIT_RESET_FRACTION) / (1 - EXIT_RESET_FRACTION);
      const nextOpacity = currentPhase === 'exited' ? '0' : exiting ? exitOpacity.toFixed(3) : '1';
      if (nextOpacity !== lastOpacity) {
        lastOpacity = nextOpacity;
        element.style.opacity = nextOpacity;
      }
      const next = formatTimecode(Math.round(scrub * spanFrames));
      if (next === lastValue) return;
      lastValue = next;
      const characters = element.querySelectorAll<HTMLElement>('[data-timecode-char]');
      if (characters.length !== next.length) return;
      characters.forEach((character, index) => {
        if (character.textContent !== next[index]) character.textContent = next[index];
      });
      element.setAttribute('aria-label', next);
    };

    write();
    const unsubscribeProgress = timeline.progress.on('change', write);
    const unsubscribePhase = timeline.phase.on('change', write);
    return (): void => {
      unsubscribeProgress();
      unsubscribePhase();
    };
  }, [spanFrames, timeline.phase, timeline.progress]);

  // Starts at 0, not at a base frame: the readout's whole range is now 0 -> spanFrames.
  const initial = formatTimecode(0);

  return (
    <div
      ref={containerRef}
      className="s04-main-timecode"
      role="timer"
      aria-live="off"
      aria-label={initial}
    >
      {initial.split('').map((character, index) => (
        <Animate
          key={`${index}-${character}`}
          animateId={`s04-time-char-${index}`}
          enterAnimation={{
            initial: { opacity: 0, y: index % 2 === 0 ? 18 : -18, filter: 'blur(7px)' },
            animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          }}
          exitAnimation={{
            // The parent timecode timeline owns the ordered zero-then-fade exit. Characters
            // hold their landing state so they cannot disappear before the readout reaches 0.
            exit: { opacity: 1, y: 0, filter: 'blur(0px)' },
          }}
          // Long budget, overlapped rather than chained: the element clock advances ~100ms
          // per 1% of drag, so a real gesture spends 3000ms+ before act 4 lands. Chaining 11
          // lanes end to end (waitFor + positive delay) serialised 11 budgets and pushed the
          // tail past the visible window entirely.
          duration={{ enter: timing.duration(CHAR_ENTER_MS), exit: timing.duration(120) }}
          // Absolute start per character, replacing the chain (char 0 waited on `s04-label`,
          // every later char on its predecessor). The registry resolved a chained start to
          // delay + leader_start + leader_REGISTERED_duration, and no lane here staggers, so
          // the numbers were: char 0 = -3000 + 400 + 5000 = 2400, and each later char
          // = -2820 + prev + 3000 = prev + 180. That collapses to a plain 180ms stride, which
          // is the overlap the comment above describes — now stated directly instead of being
          // the residue of a budget minus a negative delay.
          timeline={{ delay: timing.delay(CHAR_START_MS + index * CHAR_STRIDE_MS) }}
        >
          <span data-timecode-char="">{character}</span>
        </Animate>
      ))}
    </div>
  );
}
