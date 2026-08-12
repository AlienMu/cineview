/**
 * Act 03 A1 waveform canvas — the audio track, drawn.
 *
 * ── RULE 6 EXEMPTION, DECLARED ───────────────────────────────────────────────
 * AGENTS.md / CLAUDE.md rule 6 bans site components from building their own animation
 * drivers. Self-drawn canvas is the ONE exemption (DESIGN.md §0: a child may read a
 * MotionValue and run its own rAF, zero per-frame setState), and this is that case: a
 * waveform is a continuous curve whose every sample has a different height, which no
 * framework variant can express, and 256 subscribed `motion.span` bars would cost far more
 * per frame than one path.
 *
 * The exemption is CONDITIONAL. This canvas lives INSIDE a <Scene>, so it has a framework
 * phase and MUST be gated by it — task-flow §10 rule 2 states this explicitly for exactly
 * this component. The `tp-ambient` exemption (global chrome mounted outside every Scene,
 * with no phase to gate against) does not apply. The rAF is therefore driven by
 * `timeline.phase`: it stops on `exited` / `idle` and restarts on re-entry. See
 * `applyPhase` below — same contract as `clapperboard/ClapperboardCanvas.tsx` (act 02) and
 * `corona/CoronaCanvas.tsx` (act 04).
 *
 * ── What drives what ─────────────────────────────────────────────────────────
 *  - `timeline.progress` (a MotionValue, read not subscribed-to-React) is this lane's own
 *    enter progress. It does two things: reveals the waveform left-to-right (a track being
 *    written), and opens the filter — the 「拖拽控制滤波」 of 设计档 §3.3, expressed purely
 *    visually since the audio was cut.
 *  - Wall-clock elapsed drives the horizontal FLOW, which is why the track keeps moving
 *    after every act-03 lane has finished. That is this act's 防空等 coverage together with
 *    the playhead breath (§1.4).
 *
 * There is NO audio here and none is intended: no Web Audio, no `<audio>`, no analyser.
 */

import type { AnimatePhase } from 'cineview';
import type { MotionValue } from 'framer-motion';
import { memo, useEffect, useRef } from 'react';
import {
  buildWaveformField,
  waveformAmplitude,
  waveformFlowPosition,
  WAVEFORM_SAMPLES,
} from './waveformField';

interface WaveformCanvasProps {
  progress: MotionValue<number>;
  phase: MotionValue<AnimatePhase>;
}

// Act 03 is the amber act (`.tp-scene--03` maps --tp-sig to --tp-sig-amber). Kept as
// numeric channels rather than a colour string because alpha varies per column per frame:
// composing `rgba(r, g, b, a)` from constants avoids parsing a string hundreds of times a
// frame.
const AMBER: readonly [number, number, number] = [216, 162, 74];
const AMBER_HOT: readonly [number, number, number] = [244, 214, 158];

/** Drawn columns. Fewer than the 256 envelope samples: at ~330px of track width a 2px
 *  column pitch is already denser than the eye resolves, and each column is a fill call. */
const COLUMN_COUNT = 116;
/** How much of the envelope's wrap cycle is visible at once. 0.55 keeps the phrase-level
 *  swell legible; showing the whole cycle flattens it into texture. */
const VISIBLE_SPAN = 0.55;

export const WaveformCanvas = memo(function WaveformCanvas({
  progress,
  phase,
}: WaveformCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Built once per mount, never per frame.
    const field = buildWaveformField(WAVEFORM_SAMPLES);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let paused = phase.get() === 'exited' || phase.get() === 'idle';
    const startedAt = performance.now();

    const draw = (): void => {
      if (width <= 0 || height <= 0) return;
      const reveal = Math.max(0, Math.min(1, progress.get()));
      ctx.clearRect(0, 0, width, height);
      // Nothing to paint before the lane opens; the lane sits at 0 for its whole delay.
      if (reveal <= 0.001) return;

      const midY = height / 2;
      const halfHeight = midY * 0.86;
      const flow = waveformFlowPosition((performance.now() - startedAt) / 1000);
      // Filter opening: fully low-passed at the start of the lane, fully open by 85% of it.
      // The last 15% is deliberately flat so the settle does not end on a moving target.
      const openness = Math.min(1, reveal / 0.85);
      const columnWidth = width / COLUMN_COUNT;
      const barWidth = Math.max(1, columnWidth * 0.55);

      // Centre line: the track exists (as a hairline) across its whole width from the
      // first frame, and the bars fill in over it. Without it the reveal reads as the
      // track itself growing, not as material being written onto a track.
      ctx.fillStyle = `rgba(${AMBER[0]}, ${AMBER[1]}, ${AMBER[2]}, ${(0.2 * reveal).toFixed(4)})`;
      ctx.fillRect(0, midY - 0.5, width, 1);

      for (let column = 0; column < COLUMN_COUNT; column += 1) {
        const columnFraction = column / COLUMN_COUNT;
        // Left-to-right write-on. `columnReveal` is a short local ramp so the leading edge
        // is a soft front rather than a hard vertical cut.
        const columnReveal = Math.max(0, Math.min(1, (reveal - columnFraction) / 0.12));
        if (columnReveal <= 0.004) continue;

        const amplitude = waveformAmplitude(field, flow + columnFraction * VISIBLE_SPAN, openness);
        const barHeight = Math.max(1, amplitude * halfHeight * columnReveal);
        const x = column * columnWidth + (columnWidth - barWidth) / 2;

        // The tallest peaks take the hot tint, so the track has internal contrast instead
        // of reading as one flat block of amber.
        const channels = amplitude > 0.76 ? AMBER_HOT : AMBER;
        const alpha = (0.38 + amplitude * 0.5) * columnReveal;
        ctx.fillStyle = `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha.toFixed(4)})`;
        // Mirrored about the centre line, which is what makes it read as a waveform
        // rather than as a bar chart.
        ctx.fillRect(x, midY - barHeight, barWidth, barHeight * 2);
      }

      // Published for the acceptance lane (V1) so the track's state can be asserted from
      // the DOM instead of from a screenshot.
      canvas.dataset.reveal = reveal.toFixed(3);
      canvas.dataset.openness = openness.toFixed(3);
      canvas.dataset.paused = paused ? '1' : '0';
    };

    const tick = (): void => {
      if (paused) {
        rafRef.current = 0;
        return;
      }
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = (): void => {
      if (!paused && rafRef.current === 0) rafRef.current = requestAnimationFrame(tick);
    };

    // PHASE GATE (rule 6, task-flow §10 rule 2). `exited` / `idle` means act 03 is off
    // screen: stop the rAF outright rather than leaving 116 columns redrawing behind
    // whatever act the user is now looking at.
    const applyPhase = (nextPhase: AnimatePhase): void => {
      paused = nextPhase === 'exited' || nextPhase === 'idle';
      if (paused) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        // Leave nothing painted behind: a frozen waveform on a dead scene is worse than
        // an empty one.
        if (width > 0 && height > 0) ctx.clearRect(0, 0, width, height);
        canvas.dataset.paused = '1';
      } else {
        draw();
        start();
      }
    };

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!paused) draw();
    };

    resize();
    // ResizeObserver rather than window.resize: the canvas fills a grid cell of the
    // timeline bed, which can change size without the window changing (language toggle,
    // dynamic viewport bars).
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    applyPhase(phase.get());
    const unsubscribePhase = phase.on('change', applyPhase);

    return () => {
      observer.disconnect();
      unsubscribePhase();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [phase, progress]);

  return <canvas ref={canvasRef} className="s03-wave-canvas" aria-hidden="true" />;
});
