import { Animate, useAnimateTimeline } from 'cineview';
import { memo } from 'react';
import { useI18n } from '../../i18n';
import { Act3Media } from './Act3Media';
import { TimelinePlayhead } from './TimelinePlayhead';
import { useTemporalMotion, type TemporalMotionTiming } from './TemporalMotion';
import {
  ACT3_CLIP_DEMO_SELECT_LEAD_MS,
  ACT3_CLIP_POSTERS,
  ACT3_CLIP_SEGMENT_MS,
  ACT3_FIRST_SELECTION_START_MS,
  ACT3_MEDIA_CLOCK_MS,
  clipAssemblyStartMs,
  clipSelectionStartMs,
} from './act3MediaTimeline';
import { WaveformCanvas } from './waveform/WaveformCanvas';

// ── Act 03 · 剪辑台 (the cutting room) ──────────────────────────────────────
//
// REWRITTEN, not adjusted. What stood here was five taped-up CODE STRIPS (`STRIPS`), each
// with three chained lanes — 15 lanes whose cascade resolved through `after`, of which 6
// never reached the screen at all. The strips, their geometry, their five i18n label keys
// and the standalone 「调度」 title lane are all gone. 「调度」 survives as a word on the V2
// subtitle track instead of as a static headline (设计档 §3.3).
//
// The act is now one object: an edit bay. A preview monitor at the top, a timeline bed
// under it, three tracks in the bed, one playhead across them.
//
//   V1  video track   — clip blocks with frames from the shared preview media
//   A1  audio track   — a drawn waveform. PURELY VISUAL: the act's audio was cut, so there
//                       is no Web Audio, no <audio>, no analyser anywhere in this subtree.
//                       The 「拖拽控制滤波」 requirement is expressed as a drawn filter
//                       opening (WaveformCanvas / waveformField).
//   V2  subtitle track — 剪辑 / 调度 / 控制, rendered LEGIBLY (返工:「v2 把模糊去掉」). They
//                       were blurred past reading per 设计档 §3.3「模糊不可辨风格」; the blur
//                       is gone and the words stand as words.
//
// ── Lane budget (every lane uses an absolute anchor; no `after` anywhere) ──────────────
//   preview frame     0    + 2400
//   ruler             120  + 400
//   V1 track base     200  + 400
//   V1 clip x5        600 / 900 / 1200 / 1500 / 1800   + 500 each
//   A1 track base     1500 + 400
//   A1 waveform       1800 + 800
//   V2 track base     900  + 400
//   V2 x5             1200 / 3200 / 5200 / 7200 / 9200
//   clip selection x4 2400 / 4400 / 6400 / 8400        + 2000 each
//   clip 1            parked at the assembled left edge (no drag lane)
//   clip sequence x4  2400 / 4400 / 6400 / 8400        + 2000 each (220 hold + 1780 drag)
//   clip seams x4     4400 / 6400 / 8400 / 10400       + 240 each  (= the lane end of the clip they mark)
//   media scrub       3200 + 10000 (1ms scene time = 1ms source time)
//   media clock       0 + 13200
//
// tSelf is 13200ms, owned by `s03-media-clock`; its progress is the only transport input.
// Both clip strokes anchor absolutely via `clipAssemblyStartMs` (2026-08-08: the W0 contract
// bans `after` in this directory, so the clip2→clip3 edge is arithmetic, not a registry edge;
// 2026-08-20: the anchor moved one LEAD earlier so every stitch COMPLETES before the playback
// reaches the segment it prepares, not exactly on its arrival — 见 act3MediaTimeline.ts 的
// LEAD 推导). Each lane holds selected for 220ms, then lands 800ms before the 2s / 4s / 6s /
// 8s edit it prepares.
// Every exit budget below is <= the act's 720ms transitionDuration (TemporalDragExperience
// .tsx: `modes.drag.transitionDuration`), so no lane is still leaving when the slide ends.
//
// Three lanes open inside the 0-300ms response band (preview 0, ruler 120, V1 base 200), so
// the first pixel of finger travel already moves the frame.
//
// ── PROPERTY WHITELIST (verified in source, not assumed) ────────────────────
// The drag driver animates EXACTLY ten properties and silently drops everything else:
// opacity, x, y, scale, rotate, rotateX, rotateY, skewX, skewY, filter
// (`AnimatableProperty` in src/components/Animate/animateInterpolation.ts:17-27; the ten
// call sites that consume it are useAnimateDrag.ts:711-720). `scaleX` / `scaleY` are NOT on
// it — an authored `scaleX` never reaches the DOM, because the style object handed to
// `motion.div` is built key-by-key from that union rather than spread from the variant
// (useAnimateDrag.ts:767-779). The three track bases below therefore use a uniform `scale`
// with a CSS `transform-origin: left center` to read as a lane widening rightward; act 04's
// ruler carries the identical fix and the identical note (temporal-drag.css:1154).
//
// The playhead lane is the ONE place where that substitution is not available, because a
// scale there multiplies the very offset the lane's own progress writes. It uses `y` instead,
// and the measurement that rules out `scale` is recorded at that lane.
//
// `after` is not used in this file at all — `temporalDragW0.contract.test.ts` bans it across
// the whole `/drag` directory (AST-level). Note the ban is a directory-wide contract, NOT a
// claim that a chain here would drift: the clip sequence has no stagger, so its registered
// duration equals its authored duration and a chain WOULD have been exact. Every lane states
// its own absolute offset so they can overlap deliberately.
//
const PREVIEW_START_MS = 0;
const PREVIEW_ENTER_MS = 2400;
const RULER_START_MS = 120;
const RULER_ENTER_MS = 400;
const TRACK_ENTER_MS = 400;
const V1_TRACK_START_MS = 200;
const A1_TRACK_START_MS = 1500;
const V2_TRACK_START_MS = ACT3_FIRST_SELECTION_START_MS - 300;
const CLIP_START_MS = 600;
const CLIP_STRIDE_MS = 300;
const CLIP_ENTER_MS = 500;
// Stroke for a subtitle block: it is nudged under the cut it belongs to rather than carried
// across the bed, so the travel is short.
const SUBTITLE_DRAG_TRAVEL_PX = 24;
const WAVE_START_MS = 1800;
const WAVE_ENTER_MS = 800;
const SUBTITLE_ENTER_MS = 500;
const PLAYHEAD_START_MS = ACT3_FIRST_SELECTION_START_MS;
const PLAYHEAD_ENTER_MS = 300;

// ── Exit: a reverse cascade, not a packed rollback ─────────────────────────
// An enter cascade built from delays gets no exit-side counterpart for free. The outgoing
// lane ignores per-lane delay entirely — exit localProgress is
// clamp(renderProgress * transitionDuration / exitDuration) — so if every lane shared one
// exit budget the whole bay would vanish on a single frame («打包回滚») after having
// assembled in sequence. Budget LENGTH is the only ordering handle: shorter leaves sooner.
//
// Enter order is preview → ruler → V1 → clips → A1 → wave → V2 → subtitles → playhead →
// timecode, so exit must run in reverse: the timecode goes first and the preview frame last.
// The budgets below ascend in exactly that reverse order, and all of them stay under the
// 720ms transitionDuration so every lane completes its exit inside the slide.
//
// The timecode's own exit budget (200ms — the shortest in the act, so it leaves first) is
// NOT declared here: that lane is authored in `TimelinePlayhead.tsx`, next to the readout it
// governs, and a second copy of the number here would be a silent divergence waiting to
// happen. It is the head of this same ascending sequence: 200 < 240 < 280 < ... < 660.
const PLAYHEAD_EXIT_MS = 240;
const SUBTITLE_EXIT_MS = 280;
const SUBTITLE_EXIT_STRIDE_MS = 30;
const V2_TRACK_EXIT_MS = 370;
const WAVE_EXIT_MS = 410;
const A1_TRACK_EXIT_MS = 440;
const CLIP_EXIT_MS = 470;
const CLIP_EXIT_STRIDE_MS = 30;
const V1_TRACK_EXIT_MS = 560;
const RULER_EXIT_MS = 600;
const PREVIEW_EXIT_MS = 660;

/**
 * One V1 clip block.
 *
 * `left` / `width` are authored as fractions of the track's inner width so a clip's position
 * never depends on flex/grid measurement. `poster` uses the shared media frame.
 */
export interface S03ClipSpec {
  readonly id: string;
  /** Left edge as a fraction of the track's inner width. */
  readonly left: number;
  /** Width as a fraction of the track's inner width. */
  readonly width: number;
  /** Shared preview frame for this clip range. */
  readonly poster: string;
}

// Five clips, equal widths, evenly spaced (2026-08-18: 10s 源 → 5 × 2s)。
// 等宽 0.18 + 间距 0.01，5 块占 0→0.92，末尾 0.08 留给 playhead 落位。
// 2026-08-19 修「v1 帧太窄」：0.15→0.18（等距 0.02→0.01 收窄间距），单帧在
// 390px 窄轨上约 70px → 82px，poster 缩略图不再被挤成细条。
// 2026-08-20 修「v1帧为什么都长一样？」：poster 不再五块共用 ACT3_POSTER_SRC，
// 每块用自己那一段的中点抽帧（ACT3_CLIP_POSTERS 按段数派生）。
const V1_CLIPS: readonly S03ClipSpec[] = [
  { id: 's03-v1-clip-1', left: 0.0, width: 0.18 },
  { id: 's03-v1-clip-2', left: 0.19, width: 0.18 },
  { id: 's03-v1-clip-3', left: 0.38, width: 0.18 },
  { id: 's03-v1-clip-4', left: 0.57, width: 0.18 },
  { id: 's03-v1-clip-5', left: 0.76, width: 0.18 },
].map((spec, index) => ({ ...spec, poster: ACT3_CLIP_POSTERS[index] }));

// V2 subtitle blocks, aligned under the V1 cuts they belong to (a subtitle belongs to a
// shot). Slightly inset from each clip so the two rows do not read as one grid。
// 2026-08-19：随 V1 加宽，字幕宽度 0.12→0.15，仍内缩 0.015 留视觉缝。
// sub4/sub5 文案为占位，待补（复用 sub1-3 既有，4/5 新增占位 key）。
const V2_SUBTITLES: readonly {
  readonly id: string;
  readonly left: number;
  readonly width: number;
  readonly key: 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5';
}[] = [
  { id: 's03-v2-sub-1', left: 0.015, width: 0.15, key: 'sub1' },
  { id: 's03-v2-sub-2', left: 0.205, width: 0.15, key: 'sub2' },
  { id: 's03-v2-sub-3', left: 0.395, width: 0.15, key: 'sub3' },
  { id: 's03-v2-sub-4', left: 0.585, width: 0.15, key: 'sub4' },
  { id: 's03-v2-sub-5', left: 0.775, width: 0.15, key: 'sub5' },
];

const RULER_MARKS = [
  '00:00:00:00',
  '00:00:02:00',
  '00:00:04:00',
  '00:00:06:00',
  '00:00:08:00',
] as const;

// ── Stage 2: the assembly. AN ENTRANCE, NOT A LOOP ─────────────────────────
//
// Latest sequence: all five clips enter first; clip 1 is already parked at the far-left edge.
// The stitches then begin (first stroke at 2400, the frame the preview's reveal completes)
// and each clip is dragged into its seam BEFORE the playback reaches the cut it prepares —
// the stitch for segment k lands 800ms ahead of the playhead's arrival (2026-08-20 返工:
// 「先拼接好，也就是先执行完毕动画」; the derivation of the 800 is in
// `act3MediaTimeline.ts` next to `ACT3_CLIP_ASSEMBLY_LEAD_MS`).
//
// What stood here was ONE clip (the middle one) sliding left and back on an
// `loopAnimation`, forever. Three things about that were wrong, and they are separate:
//
//  1. It LOOPED. A cutting-room assembly happens once — you close the gaps and they stay
//     closed. A cycle that pushes a block into its neighbour and then pulls it back out is
//     not an edit, it is a fidget, and it competes for attention for as long as the act is on
//     screen. These are now plain enter lanes: they run once, land, and hold.
//  2. Clip 1 used to perform a redundant first stroke. It now has no demo lane; clips 2–5
//     provide the four meaningful leftward edits while the picture continues.
//  3. The end state was still GAPPED. The old cycle returned to its start, so the track never
//     reached the assembled state the whole demonstration is about. It now ends with the five
//     blocks lapped together, which is the point being made.
//
// ── NON-BLOCKING, by construction ──────────────────────────────────────────
// Clip 3's stroke does follow clip 2's, but that edge is now plain ARITHMETIC, not a registry
// dependency: both anchor absolutely via `clipAssemblyStartMs`, one SEGMENT apart
// (2026-08-08 — the W0 contract bans `after` here). Neither lane uses stagger, so the
// effective duration is exactly the authored 2000ms, which is what makes the arithmetic exact.

/**
 * How far the blocks lap each other once assembled, as a fraction of the track.
 *
 * 3% is a deliberate middle: wide enough that the overlap is unmistakably an overlap at
 * 390px (≈10px of track), narrow enough that neither block is meaningfully hidden behind its
 * neighbour. It is also the width of each seam badge, because the badge marks exactly the
 * shared band — one constant, so the two cannot disagree.
 */
const CLIP_OVERLAP_FRACTION = 0.03;

/** Where the assembled run starts. 0 = flush with the track's left edge, which is where a
 *  closed-up sequence belongs; the old gapped layout began at 0.02. */
const CLIP_ASSEMBLY_LEFT = 0;

/**
 * The assembled left edge of every clip, derived by walking the track left to right: each
 * block butts against the previous one and then laps back over it by `CLIP_OVERLAP_FRACTION`.
 *
 * DERIVED, never transcribed. The authored `left` values in `V1_CLIPS` are the SEPARATED
 * layout; these are the assembled one, and the push distance below is the difference. Writing
 * both by hand is the archived act-02 defect (an authored duration in one file, its fractions
 * in another, drifting silently) — here it would mean a block that visibly fails to meet its
 * neighbour because two numbers were edited apart.
 */
const CLIP_ASSEMBLED_LEFT: readonly number[] = V1_CLIPS.reduce<number[]>((acc, _spec, index) => {
  if (index === 0) return [CLIP_ASSEMBLY_LEFT];
  const previous = V1_CLIPS[index - 1];
  acc.push(acc[index - 1] + previous.width - CLIP_OVERLAP_FRACTION);
  return acc;
}, []);

/**
 * The overlap bands, one per adjacent pair — where a seam badge goes.
 *
 * `left` is the later block's assembled edge and `width` is the lap itself, so the band is
 * exactly the region the two blocks share. Derived from the same array the pushes are, so a
 * badge cannot end up floating over a gap.
 */
const CLIP_SEAMS: readonly {
  readonly id: string;
  readonly left: number;
  readonly index: number;
}[] = V1_CLIPS.slice(1).map((_, offset) => ({
  id: `s03-clip-seam-${offset + 1}`,
  left: CLIP_ASSEMBLED_LEFT[offset + 1],
  index: offset + 1,
}));

/**
 * How far clip `index` travels, as a percentage of ITS OWN box.
 *
 * Percent and not px: `x` in percent resolves against the animated element, and the slot is
 * sized by `--s03-slot-width` as a fraction of the track. So a push of `d` track-fractions on
 * a block `w` track-fractions wide is `d / w` of its own width. Negative = leftward.
 */
function clipPushPercent(index: number): number {
  const spec = V1_CLIPS[index];
  const distance = spec.left - CLIP_ASSEMBLED_LEFT[index];
  return -(distance / spec.width) * 100;
}

/** A seam badge's own fade-in. Short and deliberately shorter than a stroke: the badge is a
 *  consequence of the lap closing, so it should land just after the block stops rather than
 *  ease in alongside it. */
const CLIP_SEAM_ENTER_MS = 240;

/** The seam badges' exit budget. Shortest in the act along with the timecode's 200: a badge is
 *  the last thing to appear and the first to go, and budget LENGTH is the only exit-ordering
 *  handle the drag lane gives (the outgoing lane ignores per-lane delay entirely). */
const SEAM_EXIT_MS = 220;

/**
 * The stage-2 lane props for one clip: ONE leftward stroke, run once, held at the end.
 *
 * ── Why this is an enter lane and not an `loopAnimation` ────────────────
 * It used to be the latter, and that was the reported defect («不是持续动画，而是入场动画»). The
 * structural difference matters beyond the loop count: an `<Animate>` that declares
 * `loopAnimation` renders an EXTRA anonymous motion.div (Animate.tsx's drag branch), which
 * is what forced the `.s03-clip-slot .cineview-animate > *` rule after clip 2 measured 2.0px
 * tall against its neighbours' 40.2px. With the loop gone that wrapper is gone too, so this
 * lane is one node and the block's box is its slot's box.
 *
 * ── `x` in PERCENT, and the reason it cannot be px ──────────────────────────
 * The slot is sized by `--s03-slot-width`, a fraction of the track, so its pixel width is
 * whatever the viewport gives it. A px stroke would lap correctly at one width only. `x` in
 * percent resolves against the ANIMATED ELEMENT, so `clipPushPercent` converts the
 * track-fraction distance into a fraction of the block's own width and the overlap holds at
 * every viewport.
 *
 * `opacity: 1` on both ends, explicitly. Omitting it does NOT mean «no opacity animation»:
 * `getDefaultValue` supplies 0 → 1 across the lane's whole budget (animateInterpolation.ts:90),
 * which would re-fade the block over its stroke and multiply against the fade lane below.
 */
/**
 * 每个 clip 的 stroke 起点 —— **绝对延迟，不用 `after`**（2026-08-08 修）。
 *
 * 换掉 `after` 的理由只有一条：`temporalDragW0.contract.test.ts:94-112` 在整个
 * `/drag` 目录**以 AST 级断言禁用 `after` 属性赋值**，`SceneSync` 是最后一处违例。
 *
 * ⚠️ 不要把「registry 会累积误差」当成这里的依据 —— 那条机制在本文件**不适用**：
 * 累积误差来自 leader 的 registered duration 被 stagger 膨胀，而这两条 lane 都不用
 * stagger（见下方 NON-BLOCKING 段），链是精确的。同幕 `SceneFlux.tsx:39` /
 * `DialTicks.tsx:135` 弃用 `after` 各有自己的理由（前者链上有 stagger，后者是
 * sweep 语义根本不该串行），不能直接搬到这里。
 *
 * 时间轴锚 `clipAssemblyStartMs`（2026-08-20 从 `clipSelectionStartMs` 平移 LEAD）：
 * stroke 长恰为一段 SEGMENT，故 stroke 终点 = 播放进入第 index 段的时刻 − LEAD ——
 * 拼接在播放抵达**之前**完成。不要绕过它去写 `clipSelectionStartMs(index) − 800`
 * 之类的展开 —— 那正是 `CLIP_ASSEMBLED_LEFT` 注释警告的「同一事实两处各写、日后
 * 静默分叉」。selection 覆盖层共用本函数，与它标注的 stroke 天然同起点同跨度。
 */
function clipSequenceTimeline(timing: TemporalMotionTiming, index: number): { delay: number } {
  return { delay: timing.delay(clipAssemblyStartMs(index)) };
}

function clipDemoLaneProps(
  timing: TemporalMotionTiming,
  index: number
): {
  enterAnimation: {
    initial: { opacity: number; x: string };
    animate: {
      opacity: number;
      x: string[];
      transition: { x: { times: number[] } };
    };
  };
  duration: { enter: number };
  // 无 `after?: string`：本目录契约禁用它（W0），留着是零消费的死字段，
  // 且真写进去会被那条 AST 断言打红。
  timeline: { delay: number };
} {
  // reduced-motion: no stroke at all. The block is authored at its SEPARATED position, so
  // pinning x at 0 leaves the gapped layout — which is the honest still frame for this act
  // (a timeline with three cuts on it), not a broken half-state.
  const push = timing.reduced ? 0 : clipPushPercent(index);
  const pushed = `${push.toFixed(3)}%`;

  return {
    // The lane owns both beats: hold at x=0 for the selected lead, then perform the drag.
    // Clip 3 starts one SEGMENT later by arithmetic (see clipSequenceTimeline), so this lane's
    // `duration.enter` being exactly one SEGMENT is what keeps the two abutting.
    enterAnimation: {
      initial: { opacity: 1, x: '0%' },
      animate: {
        opacity: 1,
        x: ['0%', '0%', pushed],
        transition: {
          x: { times: [0, ACT3_CLIP_DEMO_SELECT_LEAD_MS / ACT3_CLIP_SEGMENT_MS, 1] },
        },
      },
    },
    duration: { enter: timing.duration(ACT3_CLIP_SEGMENT_MS) },
    timeline: clipSequenceTimeline(timing, index),
  };
}

/**
 * One transition badge, over the band where two assembled blocks lap.
 *
 * 用户原话:「拖到重叠位置，然后在重叠交界处出现新的元素。」The overlap is now a PERMANENT end
 * state rather than a moment in a cycle, so the badge is an enter lane that lands and holds —
 * it no longer needs to know how to disappear again. That is what removes the whole
 * host-times-wrapper opacity trap this component used to carry: with no `loopAnimation`
 * there is no second node multiplying against the host, so the lane's own opacity IS the
 * badge's opacity and the CSS pre-start `opacity: 0` hack is no longer load-bearing either.
 *
 * The badge lands on the frame its clip stops: its delay is `clipAssemblyStartMs(index + 1)`,
 * which IS that clip's lane end (a demo lane runs exactly one SEGMENT, and consecutive demo
 * lanes abut — see `clipSequenceTimeline`). «visible» and «overlapping» are therefore the
 * same frame, derived from the shared beat function rather than from a registry dependency
 * or a transcribed constant.
 *
 * It sits in the TRACK, not in a clip slot, because it belongs to the boundary between two
 * blocks rather than to either one.
 */
function ClipSeam({ seam }: { seam: (typeof CLIP_SEAMS)[number] }): JSX.Element | null {
  const timing = useTemporalMotion();
  // reduced-motion: the blocks never travel, so there is no lap for a badge to mark. Rendering
  // one anyway would put a transition marker over a gap.
  if (timing.reduced) return null;

  return (
    <div
      className="s03-seam"
      style={{
        ['--s03-slot-left' as string]: `${(seam.left * 100).toFixed(3)}%`,
        // The band IS the lap — same constant the assembly walk uses, so a badge cannot be
        // wider or narrower than the overlap it marks.
        ['--s03-slot-width' as string]: `${(CLIP_OVERLAP_FRACTION * 100).toFixed(3)}%`,
      }}
      aria-hidden="true"
    >
      <Animate
        animateId={seam.id}
        // Blooms in as the lap closes: `scale` from 0.7 so the marker arrives with the block
        // rather than fading up on a static band. A plain initial → animate pair is sufficient.
        enterAnimation={{ initial: { opacity: 0, scale: 0.7 }, animate: { opacity: 1, scale: 1 } }}
        exitAnimation={{ exit: { opacity: 0 } }}
        duration={{
          enter: timing.duration(CLIP_SEAM_ENTER_MS),
          exit: timing.duration(SEAM_EXIT_MS),
        }}
        /* 绝对延迟，不用 `after`（2026-08-08 修，理由见 clipSequenceTimeline 注释）。
           徽章要「在方块停下之后落定」= 它对应的那条 demo lane 演完的时刻。
           demo lane 的 `duration.enter` 恰为一段 SEGMENT，故终点 = 下一个 clip 的
           assembly 起点，即 `clipAssemblyStartMs(seam.index + 1)` —— 直接用它，
           不再手写 `+ SEGMENT`，也不跟随 LEAD 平移（终点由首尾相接性质自动带出）。 */
        timeline={{ delay: timing.delay(clipAssemblyStartMs(seam.index + 1)) }}
      >
        <span className="s03-seam__band">
          <span className="s03-seam__mark">⧗</span>
        </span>
      </Animate>
    </div>
  );
}

/** The waveform canvas reads this lane's own progress (reveal + filter opening) and its
 *  phase (the mandatory rAF gate — the canvas is inside a <Scene>, so the `tp-ambient`
 *  chrome exemption does not apply). See `WaveformCanvas.tsx`'s file header. */
function WaveformStage(): JSX.Element {
  const timeline = useAnimateTimeline();
  return <WaveformCanvas progress={timeline.progress} phase={timeline.phase} />;
}

function V1Clip({ spec, index }: { spec: S03ClipSpec; index: number }): JSX.Element {
  const timing = useTemporalMotion();
  const clipBody = (
    <Animate
      // INNER lane: the fast fade, 10% of the entrance budget, so the block is solid before
      // any edit stroke begins. The group entrance owns appearance; this lane owns the fill.
      animateId={`${spec.id}-fade`}
      enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      duration={{ enter: timing.duration(CLIP_ENTER_MS * 0.1) }}
      timeline={{ delay: timing.delay(CLIP_START_MS + index * CLIP_STRIDE_MS) }}
    >
      <div className="s03-clip" data-s03-clip-index={index}>
        <div className="s03-clip__surface" data-s03-clip-surface="">
          <img className="s03-clip__poster" src={spec.poster} alt="" aria-hidden="true" />
        </div>
        <span className="s03-clip__sprockets" aria-hidden="true" />
        {index > 0 ? (
          <Animate
            animateId={`${spec.id}-selection`}
            enterAnimation={{
              initial: { opacity: 0 },
              animate: {
                opacity: [0, 1, 1, 0],
                transition: { times: [0, 0.04, 0.995, 1] },
              },
            }}
            duration={{ enter: timing.duration(ACT3_CLIP_SEGMENT_MS) }}
            timeline={clipSequenceTimeline(timing, index)}
          >
            <span className="s03-clip__select" aria-hidden="true">
              <span className="s03-clip__handle s03-clip__handle--left" />
              <span className="s03-clip__handle s03-clip__handle--right" />
            </span>
          </Animate>
        ) : null}
      </div>
    </Animate>
  );

  return (
    <div
      className="s03-clip-slot"
      style={{
        ['--s03-slot-left' as string]: `${(spec.left * 100).toFixed(3)}%`,
        ['--s03-slot-width' as string]: `${(spec.width * 100).toFixed(3)}%`,
      }}
    >
      <Animate
        // ── STAGE 1 of 2: the clip APPEARS. It does not travel.
        //
        // 返工 (verbatim): 「我要的是先入场展示出来 clip。然后模拟拖拽的概念动画」— two
        // stages, not one. The earlier version fused them: the block was pulled in from the
        // left as its entrance, so you never got to see the cut before a hand was already
        // moving it. Now the block lands in its authored slot first (this lane: fade + a
        // small scale settle, NO x), and the drag demonstration is a separate lane that only
        // starts after every clip has been shown — see `act3MediaTimeline.ts`.
        //
        // `scale` rather than `y`: a cut being revealed on a timeline resolves onto its own
        // footprint. `scaleX` is not one of the drag driver's ten properties and is dropped
        // silently, so this is the uniform `scale` with a left-edge origin (see the
        // `.s03-clip-slot` rule) — it reads as the block's width being laid down.
        animateId={spec.id}
        enterAnimation={{
          initial: { opacity: 0, scale: 0.9 },
          animate: { opacity: 1, scale: 1 },
        }}
        exitAnimation={{ exit: { opacity: 0, x: -10 } }}
        duration={{
          enter: timing.duration(CLIP_ENTER_MS),
          // Ascending with index so clip 5 (the last to arrive) is the first of the five to
          // leave — the reverse cascade described at the top of the file.
          exit: timing.duration(CLIP_EXIT_MS + (V1_CLIPS.length - 1 - index) * CLIP_EXIT_STRIDE_MS),
        }}
        timeline={{ delay: timing.delay(CLIP_START_MS + index * CLIP_STRIDE_MS) }}
      >
        {index === 0 ? (
          clipBody
        ) : (
          <Animate
            // Stage 2: only clips 2–5 demonstrate a drag. Clip 1 is already at left: 0.
            animateId={`${spec.id}-demo`}
            {...clipDemoLaneProps(timing, index)}
          >
            {clipBody}
          </Animate>
        )}
      </Animate>
    </div>
  );
}

function V2Subtitle({
  spec,
  index,
}: {
  spec: (typeof V2_SUBTITLES)[number];
  index: number;
}): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();
  const start = clipSelectionStartMs(index);

  return (
    <div
      className="s03-clip-slot"
      style={{
        ['--s03-slot-left' as string]: `${(spec.left * 100).toFixed(3)}%`,
        ['--s03-slot-width' as string]: `${(spec.width * 100).toFixed(3)}%`,
      }}
    >
      <Animate
        // ── OUTER lane: the full-length travel. `opacity: 1` on BOTH ends, deliberately.
        //
        // 设计档 §1.5 rule 1 asks for «淡入前 10% 完成，位移走满全程» and states it as
        // per-property keyframes (`opacity: [0, 1], times: [0, 0.1]`). That form cannot work
        // on the drag lane, and this is verified rather than assumed: the lane resolves every
        // property through `lerpTransformValue(initial, animate, p)` with a single scalar p
        // (useAnimateDrag.ts:311-353) and never reads `transition`, so handed an array it
        // string-matches "0,1" and returns "0,1" — which `parseNumericValue` reads as 0. The
        // subtitle would be permanently invisible. (Act 05 measured exactly this and left the
        // finding in SceneCut.tsx.)
        //
        // So the decoupling is expressed with the two budgets the framework does have: this
        // outer lane owns the travel, the inner lane owns a 10%-length fade. Effective opacity
        // is the product of the two, which reproduces the intended ratio. Omitting `opacity`
        // here would NOT mean "no opacity animation": getDefaultValue supplies 0 → 1 across
        // the full budget, silently re-coupling the fade to the travel.
        //
        // TRAVEL AXIS: `x`, not `y` (返工: 「模拟人工拖拽」). A subtitle block belongs to the
        // shot above it and is placed the same way — dragged along its lane, pulled in from
        // the left, so both rows read as one hand working down the bed rather than two
        // unrelated entrances. Shorter stroke than a V1 clip: see the constant.
        animateId={spec.id}
        enterAnimation={{
          initial: { opacity: 1, x: -SUBTITLE_DRAG_TRAVEL_PX },
          animate: { opacity: 1, x: 0 },
        }}
        exitAnimation={{ exit: { opacity: 0, x: -10 } }}
        duration={{
          enter: timing.duration(SUBTITLE_ENTER_MS),
          exit: timing.duration(
            SUBTITLE_EXIT_MS + (V2_SUBTITLES.length - 1 - index) * SUBTITLE_EXIT_STRIDE_MS
          ),
        }}
        timeline={{ delay: timing.delay(start) }}
      >
        <Animate
          // INNER lane: the fast fade, 10% of the outer budget. No `exitAnimation` — with an
          // empty exit target the drag lane holds the element at its animate value through
          // `outgoing` (useAnimateDrag.ts:340-343), so the outer lane owns the single
          // fade-out and the two cannot multiply into a premature vanish.
          animateId={`${spec.id}-fade`}
          enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
          duration={{ enter: timing.duration(SUBTITLE_ENTER_MS * 0.1) }}
          timeline={{ delay: timing.delay(start) }}
        >
          <div className="s03-subtitle" data-s03-subtitle-index={index}>
            {/* 返工:「v2 把模糊去掉」— the word is now legible. It used to carry a static
                `filter: blur(2.4px)` on this span, authored to 设计档 §3.3「模糊不可辨风格」,
                which made the subtitles read as smears rather than as words on a
                track. Nothing replaces it: the block's own border and fill already say
                「这是一条字幕」, so the blur was only ever costing legibility. */}
            <span className="s03-subtitle__word">{t(`dragTemporal.s03.${spec.key}`)}</span>
          </div>
        </Animate>
      </Animate>
    </div>
  );
}

function SceneSyncStage(): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();
  const mediaTimeline = useAnimateTimeline();

  return (
    <main className="s03-cut-stage" data-active-media="none">
      {/* ── Preview monitor. Widescreen, ~2.4:1, top of the frame under a black band. ── */}
      <Animate
        animateId="s03-preview"
        enterAnimation={{
          initial: { opacity: 0, scale: 1.08, filter: 'blur(30px)' },
          animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
        }}
        exitAnimation={{ exit: { opacity: 0, scale: 1.02, filter: 'blur(24px)' } }}
        duration={{
          enter: timing.duration(PREVIEW_ENTER_MS),
          exit: timing.duration(PREVIEW_EXIT_MS),
        }}
        // The full-plate blur remains visible long enough to read as an entrance, then resolves
        // before the 3200ms media scrub begins. Playback therefore cannot precede the reveal.
        timeline={{ delay: timing.delay(PREVIEW_START_MS) }}
      >
        <section className="s03-preview" aria-label={t('dragTemporal.s03.previewLabel')}>
          {/* AnimateVideo is the sole currentTime owner; Act3Media only projects transport UI. */}
          <div className="s03-preview__surface" data-s03-preview-surface="">
            <Act3Media frame={mediaTimeline.frame} />
            <div className="s03-preview__subtitles" aria-hidden="true">
              {V2_SUBTITLES.map((spec, index) => (
                <span key={spec.id} data-s03-preview-subtitle={index}>
                  {t(`dragTemporal.s03.${spec.key}`)}
                </span>
              ))}
            </div>
          </div>
          <span className="s03-preview__bar s03-preview__bar--top" aria-hidden="true" />
          <span className="s03-preview__bar s03-preview__bar--bottom" aria-hidden="true" />
          <span className="s03-preview__tag" aria-hidden="true">
            PGM
          </span>
        </section>
      </Animate>

      {/* ── Timeline bed: ruler, three tracks, playhead. No title band. ───────── */}
      <section className="s03-bed" aria-label={t('dragTemporal.s03.timelineLabel')}>
        <Animate
          animateId="s03-ruler"
          enterAnimation={{ initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 } }}
          exitAnimation={{ exit: { opacity: 0, y: -6 } }}
          duration={{
            enter: timing.duration(RULER_ENTER_MS),
            exit: timing.duration(RULER_EXIT_MS),
          }}
          timeline={{ delay: timing.delay(RULER_START_MS) }}
        >
          <div className="s03-ruler" aria-hidden="true">
            {RULER_MARKS.map((mark) => (
              <span key={mark} className="s03-ruler__mark">
                {mark}
              </span>
            ))}
          </div>
        </Animate>

        <div className="s03-tracks">
          {/* ── V1 · video ───────────────────────────────────────────────────── */}
          <Animate
            animateId="s03-track-v1"
            // The track BASE (label + empty lane) arrives before its contents, which is
            // why 200ms is in the opening band and the clips only start at 600.
            //
            // Uniform `scale`, not `scaleX`. `scaleX` is not one of the driver's ten
            // properties (see the whitelist note at the top of the file) and would be
            // dropped without warning, leaving a pure fade. The "lane widening rightward"
            // reading comes from a CSS `transform-origin: left center` on the animated
            // holder — CSS variant list item TRACK-ORIGIN in the report's change order.
            enterAnimation={{
              initial: { opacity: 0, scale: 0.92 },
              animate: { opacity: 1, scale: 1 },
            }}
            exitAnimation={{ exit: { opacity: 0 } }}
            duration={{
              enter: timing.duration(TRACK_ENTER_MS),
              exit: timing.duration(V1_TRACK_EXIT_MS),
            }}
            timeline={{ delay: timing.delay(V1_TRACK_START_MS) }}
          >
            <div className="s03-track-row">
              <span className="s03-track-row__label">V1</span>
              <div className="s03-track">
                {V1_CLIPS.map((spec, index) => (
                  <V1Clip key={spec.id} spec={spec} index={index} />
                ))}
                {/* Last in the track, so a badge paints OVER the two blocks it marks. One
                      per adjacent pair (four, for five clips), each appearing as its own lap
                      closes — see `CLIP_SEAMS`, which derives both from the assembly walk. */}
                {CLIP_SEAMS.map((seam) => (
                  <ClipSeam key={seam.id} seam={seam} />
                ))}
              </div>
            </div>
          </Animate>

          {/* ── A1 · audio (drawn only — there is no audio in this act) ──────── */}
          <Animate
            animateId="s03-track-a1"
            // Uniform `scale` + CSS left origin, for the reason given on the V1 base.
            enterAnimation={{
              initial: { opacity: 0, scale: 0.92 },
              animate: { opacity: 1, scale: 1 },
            }}
            exitAnimation={{ exit: { opacity: 0 } }}
            duration={{
              enter: timing.duration(TRACK_ENTER_MS),
              exit: timing.duration(A1_TRACK_EXIT_MS),
            }}
            timeline={{ delay: timing.delay(A1_TRACK_START_MS) }}
          >
            <div className="s03-track-row">
              <span className="s03-track-row__label">A1</span>
              <div className="s03-track s03-track--audio">
                <Animate
                  animateId="s03-waveform"
                  // Opacity only. The canvas draws its own reveal and its own filter
                  // opening from this lane's progress, so a transform here would fight the
                  // drawing rather than add to it.
                  enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
                  exitAnimation={{ exit: { opacity: 0 } }}
                  duration={{
                    enter: timing.duration(WAVE_ENTER_MS),
                    exit: timing.duration(WAVE_EXIT_MS),
                  }}
                  timeline={{ delay: timing.delay(WAVE_START_MS) }}
                >
                  <WaveformStage />
                </Animate>
              </div>
            </div>
          </Animate>

          {/* ── V2 · subtitles ──────────────────────────────────────────────── */}
          <Animate
            animateId="s03-track-v2"
            // Uniform `scale` + CSS left origin, for the reason given on the V1 base.
            enterAnimation={{
              initial: { opacity: 0, scale: 0.92 },
              animate: { opacity: 1, scale: 1 },
            }}
            exitAnimation={{ exit: { opacity: 0 } }}
            duration={{
              enter: timing.duration(TRACK_ENTER_MS),
              exit: timing.duration(V2_TRACK_EXIT_MS),
            }}
            timeline={{ delay: timing.delay(V2_TRACK_START_MS) }}
          >
            <div className="s03-track-row">
              <span className="s03-track-row__label">V2</span>
              <div className="s03-track">
                {V2_SUBTITLES.map((spec, index) => (
                  <V2Subtitle key={spec.id} spec={spec} index={index} />
                ))}
              </div>
            </div>
          </Animate>
        </div>

        {/* ── Playhead. Last lane in, first out. ──────────────────────────────
              Its own lane rather than a child of a track, because it crosses all three:
              the element it moves spans the whole track stack. Position and readout are
              written from this lane's progress by a MotionValue subscription (no state, no
              rAF) — see TimelinePlayhead.tsx. */}
        <Animate
          animateId="s03-playhead"
          // ── NO `scale` ON THIS LANE, AND THE REASON IS MEASURED ──────────────
          // W5 authored `scaleY: 0.6 -> 1` here. `scaleY` is not one of the driver's ten
          // properties, so it was dropped silently — but substituting the uniform `scale`
          // used on the track bases is WRONG here, unlike there, and by a quantified
          // amount. This lane wraps the host element that carries `--s03-play`, the
          // custom property whose value IS the head's horizontal position
          // (TimelinePlayhead.tsx writes it from this same lane's progress). A scale about
          // the left origin multiplies that offset, so the head renders at
          // `scale(p) * fraction(p)` instead of `fraction(p)`:
          //
          //   p     0.0    0.2    0.4    0.6    0.8    1.0
          //   want  6.0%  14.8%  23.6%  32.4%  41.2%  50.0%
          //   get   3.6%  10.1%  17.9%  27.2%  37.9%  50.0%
          //
          // Worst error 5.66% of bed width at p=0.4 — 18.7px on a 330px track. It
          // converges only at p=1, so a static frame at rest shows nothing wrong; it is
          // the travel that is wrong. (Same class of error as the archived ACTION finding:
          // 0% measured on a still frame, 5.08% under a multi-frame probe.)
          //
          // `y` and `opacity` are both whitelisted and neither touches the horizontal
          // axis, so the head drops onto the timeline without its position being scaled.
          // The vertical line-grow W5 was reaching for is a CSS concern; it is filed as a
          // change request for C1 rather than faked with a property that has side effects.
          enterAnimation={{
            initial: { opacity: 0, y: -10 },
            animate: { opacity: 1, y: 0 },
          }}
          exitAnimation={{ exit: { opacity: 0 } }}
          duration={{
            enter: timing.duration(PLAYHEAD_ENTER_MS),
            exit: timing.duration(PLAYHEAD_EXIT_MS),
          }}
          timeline={{ delay: timing.delay(PLAYHEAD_START_MS) }}
        >
          <TimelinePlayhead />
        </Animate>
      </section>
    </main>
  );
}

export const SceneSync = memo(function SceneSync(): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <div className="tp-scene__inner s03-scene">
      <Animate
        animateId="s03-media-clock"
        enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
        exitAnimation={{ exit: { opacity: 1 } }}
        duration={{ enter: timing.duration(ACT3_MEDIA_CLOCK_MS), exit: timing.duration(720) }}
        timeline={{ delay: timing.delay(0) }}
      >
        <SceneSyncStage />
      </Animate>
    </div>
  );
});
