import { useLayoutEffect, useMemo, useRef } from 'react';
import { AnimateVideo, Animate, Position, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import './DemoVideoScene.css';

/**
 * Demo · Scroll-driven video (Time subtitle version, 2026-07-14)
 *
 * center-lock takeover shot. After title fast entry, video and subtitle run in parallel, converging at same moment:
 *   - Video (demo-video): frame-by-frame scrub following scroll
 *   - Subtitle (demo-subtitle): cinematic serif, line-by-line Animate blur→sharp, per-character warm gradient
 *     Same timeline MotionValue projects unsupported background-image
 */

/** Main title splits at `|` into two parts: main phrase + emphasized question (italic, highlights theme). */
function VideoTitle({ text }: { text: string }): import('react').JSX.Element {
  const [head, tail] = text.split('|');
  // English head ending with letter/digit needs space (Perhaps it…); Chinese head ending with「，」does not.
  const needSpace = /[A-Za-z0-9]$/.test(head ?? '');
  return (
    <h2 className="demo-video__title">
      <span className="demo-video__title-head">{head}</span>
      {/* ⚠️ em's children must be **single string** (conditional space merged into tail), cannot use
          `{needSpace ? ' ' : ''}` + `{tail}` two adjacent text expressions — adjacent text participates
          in fiber reconcile when switching zh/en (''↔' '), which once triggered React 18's
          insertBefore NotFoundError (2026-08-19 user device report, first-screen runtime language switch
          crashed VideoTitle <Text> placement). Single string stays 1 text fiber,
          language switch only updates text, no placement/delete. */}
      {tail ? <em className="demo-video__title-tail">{(needSpace ? ' ' : '') + tail}</em> : null}
    </h2>
  );
}

/**
 * Get warm color [r,g,b] along sentence position t(0→1). Gradient: amber gold → warm orange → rose terracotta (hue 40→14),
 * medium saturation → adjacent positions smoothly connect, forming warm gradient flowing through entire sentence.
 */
function warmAt(t: number): [number, number, number] {
  const tc = Math.min(1, Math.max(0, t));
  /* 2026-08-14(audit act4-1): start hue 40→36(gold→apricot) — after first-screen LUT[0] changed to milky peach
   * (#fcede4, hue≈24), hue 40 start was too "golden" on gradient 0.55-0.7 segment (terracotta orange, hue≈28 base);
   * 36 narrows hue difference between per-character gradient start and this act's background color, mid-range still reaches 14 rose terracotta (unchanged). */
  const hue = 36 - tc * 22; // 36(apricot) → 14(terracotta)
  const sat = 46 + Math.sin(tc * Math.PI) * 10; // Mid-range slightly more saturated
  const light = 50 - tc * 5;
  const s = sat / 100;
  const l = light / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r: number;
  let g2: number;
  let b: number;
  if (hp < 1) [r, g2, b] = [c, x, 0];
  else if (hp < 2) [r, g2, b] = [x, c, 0];
  else [r, g2, b] = [0, c, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g2 + m) * 255), Math.round((b + m) * 255)];
}

/** Fixed parameters per character (computed once on render, read-only per frame thereafter). */
interface CharMeta {
  start: number; // Stagger starting point (progress axis)
  w1: [number, number, number]; // Fixed warm color at gradient left edge
  w2: [number, number, number]; // Fixed warm color at gradient right edge
}

interface LineMeta {
  chars: Array<{ char: string; index: number }>;
  revealStart: number;
  revealEnd: number;
}

const INK: [number, number, number] = [26, 23, 19]; // Ink color starting point (not pure black)
const SUBTITLE_DURATION_MS = 4000;
const SUBTITLE_BLUR = 'blur(0.555556vw)'; // 8 design px at the 1440px site canvas.
/* 2026-08-14(audit act4-2): exit final frame 0.5556vw→0.42vw — exit is "defocus and recede" not
 * "focus failure", 6px@1440 makes exit read faster as "dim down" rather than "blur again"; entry blur
 * stays 0.5556vw unchanged (focus emergence is entry protagonist). Window boundaries 0.72/0.80/0.94/1.00
 * (2026-08-04 D2 ruling) untouched, only adjust final frame depth. */
const SUBTITLE_BLUR_EXIT = 'blur(0.42vw)';

/* ── Convergence window (D2, 2026-08-04) ────────────────────────────────
 * Video, title, subtitle share same 4000ms axis (= AnimateVideo's frame scrub span).
 * blur cannot occupy its own time segment — it must use `times` compressed onto this axis, otherwise squeezes out scrub span.
 *   Entry: axis front 12%   defocus + fade-in + scale 1.04→1 (focus emergence)
 *   Tail: axis back 12%     refocus loss + compress to 0.85 (handed to act 5 blackout to swallow, not hard cut) */
const VIDEO_ENTER_END = 0.12;
const VIDEO_BLUR_IN = 'blur(0.9vw)';
const VIDEO_BLUR_TAIL = 'blur(0.5vw)';

/* ── Exit order: inside-out, background leaves **last** (user feedback: text disappeared but background remains) ───
 * Original implementation had video/scrim converge at `opacity: 0.85` (comment wrote "hand to act 5 blackout to swallow"), while title and
 * subtitle both converge to 0 ⇒ final axis frame shows only half-bright video with no text, reads as "background didn't disappear".
 * Relying on next act's blackout to cover means outsourcing this act's exit responsibility: any single frame gap between acts
 * and this lingering backdrop shows through.
 *
 * Entry order is video/scrim → title → subtitle line-by-line; per CLAUDE.md rule 6 item 4,
 * exit must be its **reverse**: subtitle line-by-line → title → video/scrim. Thus three-tier tail windows staggered:
 *   Subtitle  0.86 → 0.94 (last line leaves first, see lineFadeStart)
 *   Title     0.90 → 0.96
 *   Video/scrim 0.94 → 1.00  ← last, and must truly reach 0
 * Three segments intentionally overlap to avoid reading as three separate "snaps"; but **end points strictly increase**,
 * guaranteeing no frame shows "text all gone, backdrop still bright". */
/* ⚠️ These three values are likewise empirically determined. Title lane nested inside `demo-title`, its 4000ms axis actual
 * landing point doesn't coincide with subtitle (see lineFadeStart comment's measured data): original 0.90→0.96 writing
 * actually reaches zero at f≈0.820, earlier than subtitle (f≈0.850). Pushing endpoint to 1.0
 * makes title truly "last departing text", converging with background at same moment. */
const TITLE_OUT_START = 0.94;
const TITLE_OUT_END = 1;
const BG_OUT_START = 0.94;

/** Line-by-line reverse fade-out: last line leaves first. Returns axis position where this line starts fading.
 *  Fixes CLAUDE.md rule 6 item 4 — entry uses after/times for cascade, exit must have reverse choreography,
 *  otherwise entry line-by-line ordered, exit four lines disappear simultaneously ("bundled rollback"), timing asymmetric.
 *
 *  ⚠️ Window values are **empirically determined, not derived from constants**. Though four lanes share 4000ms and same after,
 *  measurements (scripts/_tail.mjs dense sampling along act tail 0.70→1.00) show title's `demo-title-out` already
 *  reaches zero at f≈0.820, while subtitle four lines reach f≈0.850 — title finishes first, order is wrong.
 *  So subtitle must move forward overall, leaving "last text element" position for title.
 *  Take 0.72–0.80: last line starts 0.72, first line starts 0.80, all earlier than title's measured zero point. */
const SUBTITLE_OUT_FIRST = 0.8;
const SUBTITLE_OUT_SPREAD = 0.08;

function lineFadeStart(lineIndex: number, lineCount: number): number {
  if (lineCount <= 1) return SUBTITLE_OUT_FIRST;
  const reversed = (lineCount - 1 - lineIndex) / (lineCount - 1);
  return SUBTITLE_OUT_FIRST - SUBTITLE_OUT_SPREAD + reversed * SUBTITLE_OUT_SPREAD;
}

function buildSubtitleModel(text: string): { chars: CharMeta[]; lines: LineMeta[] } {
  const lines = text.split('\n');
  const total = Math.max(1, text.replace(/\n/g, '').length);
  const chars: CharMeta[] = [];
  let globalIndex = 0;
  const lineMetas = lines.map((line) => {
    const lineChars = Array.from(line);
    const firstIndex = globalIndex;
    const renderedChars = lineChars.map((char) => {
      const index = globalIndex;
      const t = index / total;
      chars.push({
        start: t * 0.6,
        w1: warmAt(t - 0.14),
        w2: warmAt(t + 0.14),
      });
      globalIndex += 1;
      return { char, index };
    });
    const lastIndex = Math.max(firstIndex, globalIndex - 1);
    return {
      chars: renderedChars,
      revealStart: (firstIndex / total) * 0.6,
      revealEnd: (lastIndex / total) * 0.6 + 0.22,
    };
  });
  return { chars, lines: lineMetas };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Blur/opacity are supported properties and therefore belong to the four line-level
 * Animate lanes. Only the per-character gradient remains an imperative projection.
 */
function TimeSubtitle({ text }: { text: string }): import('react').JSX.Element {
  const { progress } = useAnimateTimeline();
  const model = useMemo(() => buildSubtitleModel(text), [text]);
  const charRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useLayoutEffect(() => {
    const settled = new Array(model.chars.length).fill(false);
    const paint = (value: number): void => {
      const p = clamp01(value);
      for (let i = 0; i < model.chars.length; i++) {
        const m = model.chars[i];
        const colorLocal = clamp01((p - m.start - 0.22) / 0.22);
        const done = colorLocal >= 1;
        if (done && settled[i]) continue;
        const element = charRefs.current[i];
        if (element) {
          const c1 = mix(INK, m.w1, colorLocal);
          const c2 = mix(INK, m.w2, colorLocal);
          element.style.backgroundImage = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
        }
        settled[i] = done;
      }
    };

    paint(progress.get());
    return progress.on('change', paint);
  }, [model, progress]);

  return (
    <div className="demo-video__subtitle" role="group" aria-label={text.replace(/\n/g, ' ')}>
      {model.lines.map((line, lineIndex) => {
        // Reverse exit: last line starts fading earliest, first line last. fadeStart must be > revealEnd,
        // times stay monotonically increasing.
        const fadeStart = Math.max(
          line.revealEnd + 0.01,
          lineFadeStart(lineIndex, model.lines.length)
        );
        return (
          <Animate
            key={lineIndex}
            animateId={`demo-subtitle-line-${lineIndex}`}
            enterAnimation={{
              initial: { opacity: 0, filter: SUBTITLE_BLUR },
              animate: {
                opacity: [0, 0, 1, 1, 0],
                filter: [
                  SUBTITLE_BLUR,
                  SUBTITLE_BLUR,
                  'blur(0vw)',
                  'blur(0vw)',
                  SUBTITLE_BLUR_EXIT,
                ],
                transition: {
                  opacity: { times: [0, line.revealStart, line.revealEnd, fadeStart, 1] },
                  filter: { times: [0, line.revealStart, line.revealEnd, fadeStart, 1] },
                },
              },
            }}
            duration={{ enter: SUBTITLE_DURATION_MS }}
            timeline={{ after: 'demo-title', delay: 0 }}
          >
            <span className="demo-video__subtitle-line" aria-hidden="true">
              {line.chars.map(({ char, index }) => (
                <span
                  key={index}
                  ref={(element) => {
                    charRefs.current[index] = element;
                  }}
                  className="demo-video__subtitle-char"
                >
                  {char === ' ' ? ' ' : char}
                </span>
              ))}
            </span>
          </Animate>
        );
      })}
    </div>
  );
}

/** Mix from ink color to warm color by t(0→1), return rgb() string. */
function mix(from: [number, number, number], to: [number, number, number], t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r},${g},${b})`;
}

export function DemoVideoScene(): import('react').JSX.Element {
  const { t, lang } = useI18n();

  return (
    <div className="demo-video" data-lang={lang}>
      {/* Base layer: fullscreen video + 4 vignette layers. Video after title → title enters then scrubs. */}
      <div className="demo-video__stage">
        {/* enterAnimation only affects AnimateVideo's wrapper visual state; frame scrubbing still driven by internal
            enterProgress, both share the same duration.enter axis without encroaching on each other. */}
        <AnimateVideo
          src="/video.mp4"
          preload={false}
          aria-label={t('demoVideo.slate')}
          animateId="demo-video"
          enterAnimation={{
            /* Exit must truly reach opacity 0 (was 0.85), and start point later than title's exit endpoint
               ⇒ background is the last layer to leave. See exit order explanation at BG_OUT_START. */
            initial: { opacity: 0, filter: VIDEO_BLUR_IN, scale: 1.04 },
            animate: {
              opacity: [0, 1, 1, 0],
              filter: [VIDEO_BLUR_IN, 'blur(0vw)', 'blur(0vw)', VIDEO_BLUR_TAIL],
              scale: [1.04, 1, 1, 1.02],
              transition: {
                opacity: { times: [0, VIDEO_ENTER_END, BG_OUT_START, 1] },
                filter: { times: [0, VIDEO_ENTER_END, BG_OUT_START, 1] },
                scale: { times: [0, VIDEO_ENTER_END, BG_OUT_START, 1] },
              },
            },
          }}
          duration={{ enter: 4000 }}
          timeline={{ after: 'demo-title', delay: 0 }}
          /* 2026-08-14 frame drop fix (task-flow N2, solution A "away from release, toward preload"):
           * Decoded frames retained after playback empirically drop frames when scrubbing back to act three (_rv-video-residency.mjs:
           * retains 10 long frames / unloads 0 long frames). releaseOnLeave makes residency follow zone approach
           * band for release/preload — releases beyond 1.5 viewport when leaving, preloads within 1 viewport on return (blob memory, zero network). */
          releaseOnLeave
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Scrim fades in/exits at same moment as video: it's not a video descendant, cannot access video lane's
            opacity, must have its own lane, otherwise warm white seams appear at top/bottom before video enters. */}
        <Animate
          animateId="demo-scrim"
          enterAnimation={{
            /* Reaches 0 at same axis moment as video: scrim is warm white gauze overlaying video's top/bottom edges,
               if it stays at 0.85 while video reaches 0, it would remain alone as a hanging gauze on empty stage. */
            initial: { opacity: 0 },
            animate: {
              opacity: [0, 1, 1, 0],
              transition: { opacity: { times: [0, VIDEO_ENTER_END, BG_OUT_START, 1] } },
            },
          }}
          duration={{ enter: SUBTITLE_DURATION_MS }}
          timeline={{ after: 'demo-title', delay: 0 }}
        >
          <div className="demo-video__scrim" />
        </Animate>

        {/* ⚠️ Do NOT place exit blackout layer here (tried and reverted 2026-08-08, documented to avoid retrying).
            Act tail has ~900px milky white blank screen (ISSUE-B, measured whole-screen brightness 235 from f=0.84 to f=1.00),
            but **any layer placed inside this Scene cannot fill it** — that 900px is precisely this act's sticky shell
            scrolling up out of viewport, layers move with shell: measured layer rect moves from `0..900` to `-900..0`,
            at f=1.0 entirely above viewport, even opacity=1 cannot cover screen.
            (Bonus second trap: giving inner div CSS `opacity: 0` multiplies with lane's opacity written on **wrapper element**
            ⇒ always 0, never appears. `.demo-video__scrim` also carries the same
            `opacity: 0`, worth separately verifying it actually appears.)
            Correct bridging location is at **page level** (darken ribbon tail segment), see `design/global.css`
            ISSUE-B comment. */}
      </div>

      {/* Top: main title fast entry (positioned at start), fades out last on exit.
          Two lanes division:
            demo-title      — 640ms fast entry axis (other lanes hang after via 'after', cannot change)
            demo-title-out  — 4000ms convergence axis (same axis as video/subtitle), only handles reverse exit.
          Title is screen frame, so fades out **after** four subtitle lines (0.95), forming inside-out convergence. */}
      <Position at={{ anchor: 'center-x', y: 200 }} className="demo-video__title-position">
        <Animate
          animateId="demo-title"
          enterAnimation={{
            initial: { y: '62%', opacity: 0 },
            animate: { y: 0, opacity: 1 },
          }}
          duration={{ enter: 640 }}
          timeline={{ delay: 0 }}
        >
          <Animate
            animateId="demo-title-out"
            enterAnimation={{
              /* Title exits 0.90→0.96, earlier than background (0.94→1.00) ⇒ convergence from inside out.
                 Was 0.95→1.00, ending at same moment as background, read as "text and backdrop hard cut together". */
              initial: { opacity: 1 },
              animate: {
                opacity: [1, 1, 0],
                filter: ['blur(0vw)', 'blur(0vw)', SUBTITLE_BLUR_EXIT],
                transition: {
                  opacity: { times: [0, TITLE_OUT_START, TITLE_OUT_END] },
                  filter: { times: [0, TITLE_OUT_START, TITLE_OUT_END] },
                },
              },
            }}
            duration={{ enter: SUBTITLE_DURATION_MS }}
            timeline={{ after: 'demo-title', delay: 0 }}
          >
            <div className="demo-video__titleblock">
              <VideoTitle text={t('demoVideo.title')} />
            </div>
          </Animate>
        </Animate>
      </Position>

      {/* Screen center: time subtitle (new protagonist), after title → runs parallel with video, line-by-line reveal + per-character warm gradient */}
      <Position at={{ anchor: 'center' }}>
        <Animate
          animateId="demo-subtitle"
          enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
          duration={{ enter: SUBTITLE_DURATION_MS }}
          timeline={{ after: 'demo-title', delay: 0 }}
        >
          <TimeSubtitle text={t('demoVideo.intro')} />
        </Animate>
      </Position>
    </div>
  );
}
