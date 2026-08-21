import { useLayoutEffect, useMemo, useRef } from 'react';
import { AnimateVideo, Animate, Position, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import './DemoVideoScene.css';

/**
 * Demo · 滚动驱动视频(时光副标题版,2026-07-14)
 *
 * center-lock 接管镜。标题快速入场后,视频与副标题并行、同刻收束:
 *   - 视频(demo-video):随滚动逐帧擦洗
 *   - 副标题(demo-subtitle):电影衬线,逐行由 Animate blur→清晰,逐字暖色只读
 *     同一条 timeline MotionValue 做不受框架支持的 background-image 投影
 */

/** 主标题在 `|` 处分成两段,主句 + 强调追问(斜体点题)。 */
function VideoTitle({ text }: { text: string }): JSX.Element {
  const [head, tail] = text.split('|');
  // 英文 head 以字母/数字结尾需补空格(Perhaps it…);中文 head 以「，」结尾则不加。
  const needSpace = /[A-Za-z0-9]$/.test(head ?? '');
  return (
    <h2 className="demo-video__title">
      <span className="demo-video__title-head">{head}</span>
      {/* ⚠️ em 的 children 必须是**单个字符串**（条件空格并入 tail），不能用
          `{needSpace ? ' ' : ''}` + `{tail}` 两个并列文本表达式——并列文本在
          中英切换（''↔' '）时参与 fiber reconcile，曾触发 React 18 的
          insertBefore NotFoundError（2026-08-19 用户真机报障，首屏运行时切语言
          崩 VideoTitle <Text> placement）。单字符串恒 1 个 text fiber，
          语言切换只剩文本更新，无 placement/delete。 */}
      {tail ? <em className="demo-video__title-tail">{(needSpace ? ' ' : '') + tail}</em> : null}
    </h2>
  );
}

/**
 * 沿整句位置 t(0→1)取暖色 [r,g,b]。色带:琥珀金 → 暖橘 → 玫瑰陶土(hue 40→14),
 * 中等饱和 → 相邻位置平滑衔接,连成流过整句的一条暖色带。
 */
function warmAt(t: number): [number, number, number] {
  const tc = Math.min(1, Math.max(0, t));
  /* 2026-08-14(审计 act4-1):起点 hue 40→36(金→偏杏)——首屏 LUT[0] 回奶白桃
   * (#fcede4,hue≈24)后,40 起点在色带 0.55-0.7 段(陶土橙,hue≈28 底)上偏「黄金」;
   * 36 让逐字渐变起点与本幕底色 hue 差收窄,中段仍到 14 玫瑰陶土(不变)。 */
  const hue = 36 - tc * 22; // 36(杏) → 14(陶土)
  const sat = 46 + Math.sin(tc * Math.PI) * 10; // 中段略饱和
  const light = 50 - tc * 5;
  const s = sat / 100;
  const l = light / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g2 = 0;
  let b = 0;
  if (hp < 1) [r, g2, b] = [c, x, 0];
  else if (hp < 2) [r, g2, b] = [x, c, 0];
  else [r, g2, b] = [0, c, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g2 + m) * 255), Math.round((b + m) * 255)];
}

/** 每个字的固定参数(渲染一次时算好,之后每帧只读不算)。 */
interface CharMeta {
  start: number; // 错峰起点(progress 轴)
  w1: [number, number, number]; // 渐变左端定形暖色
  w2: [number, number, number]; // 渐变右端定形暖色
}

interface LineMeta {
  chars: Array<{ char: string; index: number }>;
  revealStart: number;
  revealEnd: number;
}

const INK: [number, number, number] = [26, 23, 19]; // 墨色起点(非纯黑)
const SUBTITLE_DURATION_MS = 4000;
const SUBTITLE_BLUR = 'blur(0.555556vw)'; // 8 design px at the 1440px site canvas.
/* 2026-08-14(审计 act4-2):退场尾帧 0.5556vw→0.42vw——退场是「失焦远去」不是
 * 「对焦失败」,6px@1440 让离场更快读作「暗下去」而非「又糊一遍」;入场 blur
 * 保持 0.5556vw 不动(对焦浮现是入场主角)。窗口边界 0.72/0.80/0.94/1.00
 * (2026-08-04 D2 裁决)不碰,只动尾帧深度。 */
const SUBTITLE_BLUR_EXIT = 'blur(0.42vw)';

/* ── 收束窗口(D2,2026-08-04)────────────────────────────────────────────
 * 视频、标题、副标题共用同一条 4000ms 轴(= AnimateVideo 的帧擦洗跨度)。
 * blur 不能自己占一段时间——它必须用 `times` 压在这条轴上,否则会挤掉擦洗跨度。
 *   入场:轴前 12%   虚焦 + 淡入 + scale 1.04→1(对焦浮现)
 *   收尾:轴后 12%   重新失焦 + 压到 0.85(交给第五幕黑幕吞掉,不做成硬切) */
const VIDEO_ENTER_END = 0.12;
const VIDEO_BLUR_IN = 'blur(0.9vw)';
const VIDEO_BLUR_TAIL = 'blur(0.5vw)';

/* ── 退场次序：由内向外，背景**最后**走（用户反馈：文字消失了背景还在）───────
 * 原实现让视频/scrim 收在 `opacity: 0.85`（注释写「交给第五幕黑幕吞掉」），而标题与
 * 副标题都收到 0 ⇒ 轴末画面上只剩一张没有任何文字的半亮视频，读作「背景没消失」。
 * 靠下一幕的黑幕去盖，等于把本幕的退场责任外包：两幕之间只要有一帧空隙，
 * 这张滞留的底就会露出来。
 *
 * 入场次序是 视频/scrim → 标题 → 副标题逐行；按 CLAUDE.md 规则 6 第四条，
 * 退场必须是它的**反向**：副标题逐行 → 标题 → 视频/scrim。故三档收尾窗口错开：
 *   副标题  0.86 → 0.94（末行先走，见 lineFadeStart）
 *   标题    0.90 → 0.96
 *   视频/scrim 0.94 → 1.00  ← 最后，且必须真正到 0
 * 三段有意重叠，避免读成三次独立的「啪」；但**结束点严格递增**，
 * 保证任何一帧都不会出现「字已走光、底还亮着」。 */
/* ⚠️ 这三个值同样是实测定的。标题 lane 嵌在 `demo-title` 内层，其 4000ms 轴的实际
 * 落点与副标题不重合（见 lineFadeStart 注释的实测数据）：原本 0.90→0.96 的写法
 * 实际在 f≈0.820 就归零，比副标题（f≈0.850）更早。把终点推到 1.0，
 * 标题才真正成为「最后离场的文字」，与背景同刻收束。 */
const TITLE_OUT_START = 0.94;
const TITLE_OUT_END = 1;
const BG_OUT_START = 0.94;

/** 逐行反向淡出:末行先走。返回该行开始淡出的轴位置。
 *  修 CLAUDE.md 规则 6 第四条——入场用 waitFor/times 做了级联,退场就必须有反向编排,
 *  否则入场逐行有序、退场四行同时消失(「打包回滚」),时序不对称。
 *
 *  ⚠️ 窗口值是**实测定的，不是按常量推的**。四条 lane 虽同为 4000ms 且同 waitFor，
 *  但实测（scripts/_tail.mjs 沿幕尾 0.70→1.00 密采）标题的 `demo-title-out` 在
 *  f≈0.820 就已归零，而副标题四行要到 f≈0.850 —— 标题反而先走完，次序是错的。
 *  所以副标题必须整体前移，给标题留出「最后一个文字元素」的位置。
 *  取 0.72–0.80：末行 0.72 起、首行 0.80 起，全部早于标题的实测归零点。 */
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
function TimeSubtitle({ text }: { text: string }): JSX.Element {
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
        // 反向退场:末行最早开始淡出,首行最后。fadeStart 一定 > revealEnd,
        // times 保持单调递增。
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
            timeline={{ waitFor: 'demo-title', delay: 0 }}
          >
            <span className="demo-video__subtitle-line" aria-hidden="true">
              {line.chars.map(({ char, index }) => (
                <span
                  key={index}
                  ref={(element) => (charRefs.current[index] = element)}
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

/** 从墨色按 t(0→1)混到暖色,返回 rgb() 串。 */
function mix(from: [number, number, number], to: [number, number, number], t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r},${g},${b})`;
}

export function DemoVideoScene(): JSX.Element {
  const { t, lang } = useI18n();

  return (
    <div className="demo-video" data-lang={lang}>
      {/* 铺底:全屏视频 + 4 光圈层。视频 waitFor 标题 → 标题入场后擦洗。 */}
      <div className="demo-video__stage">
        {/* enterAnimation 只作用于 AnimateVideo 的包装层视觉态;帧擦洗仍由内部
            enterProgress 驱动,两者共用同一条 duration.enter 轴,互不挤占。 */}
        <AnimateVideo
          src="/video.mp4"
          preload={false}
          aria-label={t('demoVideo.slate')}
          animateId="demo-video"
          enterAnimation={{
            /* 收尾必须真正到 opacity 0（原为 0.85），且起点晚于标题的退场终点
               ⇒ 背景是最后离场的那一层。见 BG_OUT_START 处的次序说明。 */
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
          timeline={{ waitFor: 'demo-title', delay: 0 }}
          /* 2026-08-14 掉帧修复（task-flow N2，方案 A「远离释放、靠近预热」）：
           * 播完保留的解码帧在倒回第三幕时实测掉帧（_rv-video-residency.mjs：
           * 保留 10 长帧 / 卸载 0 长帧）。releaseOnLeave 让驻留随 zone approach
           * band 释放/预热——离开超 1.5 视口释放，回程 1 视口内预热（blob 内存零网络）。 */
          releaseOnLeave
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* scrim 与视频同刻淡入/收尾:它不是 video 的后代,拿不到 video lane 的
            opacity,必须自己有一条 lane,否则视频未出时就把上下两端压成暖白接缝。 */}
        <Animate
          animateId="demo-scrim"
          enterAnimation={{
            /* 与视频同轴同刻收到 0：scrim 是压在视频上下两端的暖白纱，
               若它留在 0.85 而视频已到 0，就会单独剩一条纱挂在空场上。 */
            initial: { opacity: 0 },
            animate: {
              opacity: [0, 1, 1, 0],
              transition: { opacity: { times: [0, VIDEO_ENTER_END, BG_OUT_START, 1] } },
            },
          }}
          duration={{ enter: SUBTITLE_DURATION_MS }}
          timeline={{ waitFor: 'demo-title', delay: 0 }}
        >
          <div className="demo-video__scrim" />
        </Animate>

        {/* ⚠️ 这里**不放**收尾黑场层（2026-08-08 试过并撤销，留档避免再试）。
            幕末有约 900px 奶白空屏（ISSUE-B，实测整屏亮度 235 从 f=0.84 到 f=1.00），
            但**任何放在本 Scene 内的层都填不了它** —— 那 900px 正是本幕 sticky 壳
            向上滚出视口的行程，层跟着壳一起走：实测该层矩形从 `0..900` 移到 `-900..0`，
            f=1.0 时整个在视口之上，即使 opacity=1 也盖不住屏幕。
            （附带踩到第二个坑：给内层 div 写 CSS `opacity: 0` 会与 lane 写在**包装元素**
            上的 opacity 相乘 ⇒ 恒为 0、永不显形。`.demo-video__scrim` 也带着同样的
            `opacity: 0`，值得单独核一遍它是否真的可见。）
            正确的桥接位置在**页面级**（色带尾段调暗），见 `design/global.css` 的
            ISSUE-B 注释。 */}
      </div>

      {/* 顶部:主标题快速入场(开头即就位),收尾时最后淡出。
          两条 lane 分工:
            demo-title      —— 640ms 快速入场轴(其他 lane 靠 waitFor 挂在它后面,不可改)
            demo-title-out  —— 4000ms 收束轴(与视频/副标题同轴),只负责反向退场。
          标题是画面框架,故排在四行副标题**之后**淡出(0.95),形成由内向外的收束。 */}
      <Position at={{ anchor: 'center-x', y: 200 }}>
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
              /* 标题在 0.90→0.96 走完，早于背景（0.94→1.00）⇒ 收束由内向外。
                 原为 0.95→1.00，与背景同刻结束，读作「字和底一起硬切」。 */
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
            timeline={{ waitFor: 'demo-title', delay: 0 }}
          >
            <div className="demo-video__titleblock">
              <VideoTitle text={t('demoVideo.title')} />
            </div>
          </Animate>
        </Animate>
      </Position>

      {/* 画面正中:时光副标题(新主角),waitFor 标题 → 与视频并行、逐行显影 + 逐字暖色 */}
      <Position at={{ anchor: 'center' }}>
        <Animate
          animateId="demo-subtitle"
          enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
          duration={{ enter: SUBTITLE_DURATION_MS }}
          timeline={{ waitFor: 'demo-title', delay: 0 }}
        >
          <TimeSubtitle text={t('demoVideo.intro')} />
        </Animate>
      </Position>
    </div>
  );
}
