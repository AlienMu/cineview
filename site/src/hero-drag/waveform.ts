// Ported from site/src/components/temporal-drag/waveform/WaveformCanvas.tsx for the 2.0 drag page: the React
// component is gone, the module scope and the effect body are v1's verbatim.
/**
 * Act 03 waveform: timeline progress reveals the bars and opens the visual filter;
 * elapsed time moves the field while it is visible. There is no audio processing.
 * Empty frames, completed transparent exits and inactive phases stop this local
 * draw loop. Progress changes restart it, including a reversed exit gesture.
 * Per-frame work reads MotionValues and writes Canvas pixels without React state.
 */

import { raf as requestAnimationFrame, cancel as cancelAnimationFrame } from './values';
import type { AnimatePhase, MotionValue } from './values';
import {
  buildWaveformField,
  waveformAmplitude,
  waveformFlowPosition,
  WAVEFORM_SAMPLES,
} from './geometry/waveformField';

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

/** v1's effect body, unchanged: draws `canvas` from the lane's progress and phase. Returns cleanup. */
export function mountWaveform(
  canvas: HTMLCanvasElement,
  progress: MotionValue<number>,
  phase: MotionValue<AnimatePhase>
): () => void {
  const raf = { current: 0 };
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  // Built once per mount, never per frame.
  const field = buildWaveformField(WAVEFORM_SAMPLES);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let paused = phase.get() === 'exited' || phase.get() === 'idle';
  let exiting = phase.get() === 'exiting';
  const startedAt = performance.now();

  const draw = (): boolean => {
    if (width <= 0 || height <= 0) return false;
    const reveal = Math.max(0, Math.min(1, progress.get()));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    // Nothing to paint before the lane opens; the lane sits at 0 for its whole delay.
    if (reveal <= 0.001 || (exiting && reveal >= 1)) return false;

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
    return true;
  };

  const tick = (): void => {
    raf.current = 0;
    if (paused || !draw()) return;
    raf.current = requestAnimationFrame(tick);
  };

  const start = (): void => {
    if (!paused && raf.current === 0) raf.current = requestAnimationFrame(tick);
  };

  // PHASE GATE (rule 6, task-flow §10 rule 2). `exited` / `idle` means act 03 is off
  // screen: stop the rAF outright rather than leaving 116 columns redrawing behind
  // whatever act the user is now looking at.
  const applyPhase = (nextPhase: AnimatePhase): void => {
    paused = nextPhase === 'exited' || nextPhase === 'idle';
    exiting = nextPhase === 'exiting';
    if (paused) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      // Leave nothing painted behind: a frozen waveform on a dead scene is worse than
      // an empty one.
      if (width > 0 && height > 0) ctx.clearRect(0, 0, width, height);
      canvas.dataset.paused = '1';
    } else if (draw()) {
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
    if (!paused && draw()) start();
  };

  resize();
  // ResizeObserver rather than window.resize: the canvas fills a grid cell of the
  // timeline bed, which can change size without the window changing (language toggle,
  // dynamic viewport bars).
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  applyPhase(phase.get());
  const unsubscribePhase = phase.on('change', applyPhase);
  // A reversed gesture can reveal content without changing the phase.
  const unsubscribeProgress = progress.on('change', start);

  return () => {
    observer.disconnect();
    unsubscribePhase();
    unsubscribeProgress();
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  };
}
