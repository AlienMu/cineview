// v1's per-frame writers for the 2.0 drag page, each fed by the lane's timeline (values.ts):
// DragTimecode (scene 4 readout, walks back to 0 over the first 65% of its exit), ProgressRing (the
// arc's dash, mirrored on exit), Act3Media (selection, playhead, readout from the scene-3 clock).
import { laneValues } from './values';
import { formatTimecode } from '../components/temporal-drag/timecode';
import {
  ACT3_MEDIA_CLOCK_MS,
  ACT3_MEDIA_DURATION_SECONDS,
  resolveAct3MediaState,
} from '../components/temporal-drag/act3MediaTimeline';

const lane = (id: string): Element | null =>
  document.querySelector(`[data-cineview-animate-id="${id}"]`);
const EXIT_RESET_FRACTION = 0.65;
// Scene 4's budget: iris 1300 + 900 ms at 25 fps (SceneFlux: SPAN_FRAMES).
const SPAN_FRAMES = Math.round(((1300 + 900) / 1000) * 25);

export function timecode(): void {
  const host = lane('s04-main-timecode');
  const box =
    host?.querySelector<HTMLElement>('.s04-main-timecode') ??
    host?.closest<HTMLElement>('.s04-main-timecode');
  const chars = document.querySelectorAll<HTMLElement>('[data-timecode-char]');
  if (!host || !chars.length) return;
  const { progress, phase } = laneValues(host);
  let last = '';
  const write = (): void => {
    const raw = Math.max(0, Math.min(1, progress.get()));
    const exiting = phase.get() === 'exiting';
    const scrub = exiting ? 1 - Math.min(1, raw / EXIT_RESET_FRACTION) : raw;
    const next = formatTimecode(Math.round(scrub * SPAN_FRAMES));
    if (next === last || chars.length !== next.length) return;
    last = next;
    chars.forEach((c, i) => {
      if (c.textContent !== next[i]) c.textContent = next[i]!;
    });
    box?.setAttribute('aria-label', next);
  };
  write();
  progress.on('change', write);
  phase.on('change', write);
}

export function ring(): void {
  const host = lane('s04-progress-ring');
  const arc = document.querySelector<SVGCircleElement>('.s04-eclipse__arc');
  if (!host || !arc) return;
  const { progress, phase } = laneValues(host);
  const write = (): void => {
    const raw = Math.max(0, Math.min(1, progress.get()));
    const value = phase.get() === 'exiting' ? 1 - raw : raw;
    arc.style.strokeDashoffset = String(1 - value);
  };
  write();
  progress.on('change', write);
  phase.on('change', write);
}

export function media(reduced: boolean): void {
  const host = lane('s03-media-clock');
  const stage = document.querySelector<HTMLElement>('.s03-cut-stage');
  if (!host || !stage) return;
  const { progress, phase } = laneValues(host);
  let lastActive = '';
  let lastCode = '';
  let lastTime = 0;
  let awaitingReentry = false;
  const active = (i: number | null): void => {
    const next = i === null ? 'none' : String(i);
    if (next === lastActive) return;
    lastActive = next;
    stage.dataset.activeMedia = next;
  };
  // Written only when they change: each write restyles the stage's subtree (a settled scene was
  // paying ~120 style writes a second for values that stood still).
  let lastPlay = '';
  let lastMode = '';
  const mode = (m: string): void => {
    if (m === lastMode) return;
    lastMode = m;
    stage.dataset.mediaMode = m;
  };
  const transport = (seconds: number): void => {
    const time = Math.max(0, Math.min(ACT3_MEDIA_DURATION_SECONDS, seconds));
    const play = `${((time / ACT3_MEDIA_DURATION_SECONDS) * 100).toFixed(3)}%`;
    if (play !== lastPlay) {
      lastPlay = play;
      stage.style.setProperty('--s03-play', play);
      stage.dataset.mediaTime = time.toFixed(3);
    }
    const code = formatTimecode(Math.round(time * 25));
    if (code === lastCode) return;
    const readout = stage.querySelector<HTMLElement>('[data-s03-timecode]');
    if (!readout) return;
    lastCode = code;
    readout.textContent = code;
  };
  const reset = (m: string): void => {
    lastTime = 0;
    active(null);
    transport(0);
    mode(m);
  };
  const write = (): void => {
    const ph = phase.get();
    if (ph === 'exiting') {
      awaitingReentry = true;
      return;
    }
    if (ph === 'idle' || ph === 'exited') return reset(ph);
    if (awaitingReentry) {
      if (progress.get() >= 1 - 0.001) return reset('idle');
      awaitingReentry = false;
    }
    if (reduced) {
      reset('idle');
      mode('reduced');
      return;
    }
    const state = resolveAct3MediaState(
      Math.max(0, Math.min(1, progress.get())) * ACT3_MEDIA_CLOCK_MS
    );
    const t = Math.max(lastTime, state.mediaTimeSeconds);
    lastTime = t;
    active(state.mediaIndex);
    transport(t);
    mode(state.mode);
  };
  write();
  progress.on('change', write);
  phase.on('change', write);
}
