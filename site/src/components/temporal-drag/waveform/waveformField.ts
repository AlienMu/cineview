/**
 * Act 03 waveform geometry — the A1 track's audio envelope.
 *
 * GEOMETRY ONLY. Nothing here touches a canvas, a MotionValue or the DOM; the drawing
 * lives in `WaveformCanvas.tsx`. Same split as act 02's `particleField.ts` /
 * `ClapperboardCanvas.tsx` and act 04's `coronaField.ts` / `CoronaCanvas.tsx`, for the
 * reason in CLAUDE.md self-check 3: the canvas file stays small enough to read and the
 * geometry stays testable as pure functions.
 *
 * ── There is NO audio ────────────────────────────────────────────────────────
 * The act's audio was cut (design spec §3.3): no Web Audio, no `<audio>`, no decoding. This
 * module produces a purely visual envelope. The "filter" the A1 track expresses is drawn,
 * not heard: `openness` crossfades between a heavily smoothed envelope (reads as
 * low-passed — round, detail-free) and the detailed one (reads as open — every syllable
 * edge present). See `waveformAmplitude`.
 *
 * ── Why a canvas rather than N CSS bars ─────────────────────────────────────
 * A waveform is a continuous curve; discrete `motion.span` bars lose the smoothness that
 * makes the filter crossfade legible, and 40-60 separately-subscribed spans cost more per
 * frame than one canvas path.
 *
 * ── The wrap contract ───────────────────────────────────────────────────────
 * The envelope is sampled MODULO its length, so the flow (`waveformFlowPosition`) scrolls
 * forever with no seam and no array churn. Every generator below therefore has to be
 * periodic over `count` samples — that is why the harmonics use integer cycle counts and
 * the syllable bursts wrap their index.
 */

/** Envelope resolution. 256 samples across one wrap cycle: fine enough that the drawn
 *  curve is smooth at 390px wide, coarse enough that the whole field is one small array. */
export const WAVEFORM_SAMPLES = 256;

/** How many envelope wraps scroll past per second. 0.05 = one full cycle every 20s, i.e.
 *  a slow drift that reads as a tape running rather than as a UI animation. */
export const WAVEFORM_FLOW_PER_SECOND = 0.05;

/** Radius (in samples) of the moving average that produces the low-passed copy. 9 removes
 *  the syllable edges while keeping the phrase-level shape. */
const SMOOTHING_RADIUS = 9;

export interface WaveformField {
  /** Full-bandwidth amplitude per sample, 0..1. */
  readonly detail: readonly number[];
  /** Moving-averaged copy of `detail`, 0..1 — the low-passed reading. */
  readonly smooth: readonly number[];
}

/** mulberry32 — deterministic, allocation-free. Deliberately NOT Math.random: the
 *  waveform must be identical on every mount, or re-entering act 03 reshuffles the track
 *  and reads as a glitch rather than as the same clip. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build the envelope.
 *
 * Two ingredients, because either alone reads wrong:
 *  - integer-cycle harmonics give the phrase-level swell of a real mix. Alone they read
 *    as a sine, not as audio.
 *  - short syllable bursts (a fast attack, a slower decay) give the transient edges that
 *    make it read as recorded material. Alone they read as noise.
 */
export function buildWaveformField(
  count: number = WAVEFORM_SAMPLES,
  seed = 0x51e0a3
): WaveformField {
  const random = mulberry32(seed);
  const detail = new Array<number>(count).fill(0);

  // Phrase-level swell. Integer cycles only, so the array is periodic over `count`.
  const harmonics: readonly { cycles: number; weight: number; phase: number }[] = [
    { cycles: 1, weight: 0.34, phase: random() * Math.PI * 2 },
    { cycles: 2, weight: 0.2, phase: random() * Math.PI * 2 },
    { cycles: 3, weight: 0.13, phase: random() * Math.PI * 2 },
    { cycles: 7, weight: 0.07, phase: random() * Math.PI * 2 },
  ];

  for (let index = 0; index < count; index += 1) {
    const turn = (index / count) * Math.PI * 2;
    let value = 0.22;
    for (const harmonic of harmonics) {
      value += harmonic.weight * (0.5 + 0.5 * Math.sin(turn * harmonic.cycles + harmonic.phase));
    }
    detail[index] = value;
  }

  // Syllable bursts. One burst per ~14 samples, each with a 2-sample attack and a longer
  // decay; indices wrap so the periodicity survives.
  const burstCount = Math.max(4, Math.round(count / 14));
  for (let burst = 0; burst < burstCount; burst += 1) {
    const center = Math.floor(random() * count);
    const gain = 0.24 + random() * 0.5;
    const decay = 4 + Math.floor(random() * 9);
    for (let offset = -2; offset <= decay; offset += 1) {
      const shape = offset < 0 ? (offset + 2) / 2 : Math.pow(1 - offset / (decay + 1), 1.8);
      const target = (((center + offset) % count) + count) % count;
      detail[target] += gain * shape;
    }
  }

  // Normalise to 0..1 so the canvas can treat amplitude as a plain fraction of the half
  // height and never has to know how the envelope was built.
  let peak = 0;
  for (let index = 0; index < count; index += 1) peak = Math.max(peak, detail[index]);
  const scale = peak > 0 ? 1 / peak : 0;
  for (let index = 0; index < count; index += 1) detail[index] = detail[index] * scale;

  return { detail, smooth: buildSmoothed(detail, SMOOTHING_RADIUS) };
}

/** Wrap-aware moving average — the low-passed reading of the same material. */
function buildSmoothed(source: readonly number[], radius: number): readonly number[] {
  const count = source.length;
  const smooth = new Array<number>(count).fill(0);
  const window = radius * 2 + 1;
  for (let index = 0; index < count; index += 1) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      sum += source[(((index + offset) % count) + count) % count];
    }
    // Lifted slightly: a moving average loses peak height, and a low-passed track that is
    // also visibly SHORTER would read as "quieter" rather than as "filtered".
    smooth[index] = Math.min(1, (sum / window) * 1.28);
  }
  return smooth;
}

/**
 * Where the flow has scrolled to at `elapsedSeconds`, wrapped to 0..1.
 * Wall-clock driven, which is what keeps the track alive after every lane in the act has
 * finished (design spec §1.4: no frame may be motionless while the scene is parked).
 */
export function waveformFlowPosition(elapsedSeconds: number): number {
  const raw = elapsedSeconds * WAVEFORM_FLOW_PER_SECOND;
  return raw - Math.floor(raw);
}

/**
 * Amplitude at `position` (0..1, wrapped) with the filter `openness` (0..1).
 *
 * Linear interpolation between neighbouring samples, then a crossfade between the smoothed
 * and detailed readings. `openness` 0 = fully low-passed, 1 = full bandwidth.
 */
export function waveformAmplitude(
  field: WaveformField,
  position: number,
  openness: number
): number {
  const count = field.detail.length;
  if (count === 0) return 0;
  const wrapped = position - Math.floor(position);
  const exact = wrapped * count;
  const low = Math.floor(exact) % count;
  const high = (low + 1) % count;
  const fraction = exact - Math.floor(exact);

  const detail = field.detail[low] + (field.detail[high] - field.detail[low]) * fraction;
  const smooth = field.smooth[low] + (field.smooth[high] - field.smooth[low]) * fraction;
  const mix = openness < 0 ? 0 : openness > 1 ? 1 : openness;
  return smooth + (detail - smooth) * mix;
}
