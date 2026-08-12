import { useEffect, useRef, type MutableRefObject } from 'react';
import { Animate, Position, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/types';
import { TimecodeAxis } from './TimecodeAxis';
import {
  IconAperture,
  IconDolly,
  IconZoomLens,
  IconFilmRoll,
  IconClapper,
  IconHandheld,
  IconFlip,
  IconElastic,
  IconBlur,
} from './CapabilityIcons';
import './CapabilityScene.css';

/**
 * 第二幕:能力展示 — 胶片带镜(v3 重做,2026-07-09)
 *
 * SHOT01 胶片带镜:标题 → 胶带从左向右铺入 → 9 预设帧格依次滚入播一次原生预设并定格,
 *        活跃帧高亮 + 联动说明/代码。链长 ≈8320ms。
 *
 * 原同文件的 SHOT02「舞台抽屉镜」已于 2026-08-04 拆除,第三幕改为推镜结构,
 * 见 `Act3DollyScene.tsx` 与 task-flow 2026-08-04-home-continuous-bg-act3-dolly.md。
 * 共用变体 riseVariant / solidVariant / SplitTitle / renderIntroLines 保留在本文件,
 * 由第三幕跨文件复用(避免重复实现)。
 *
 * 框架边界(已核实,勿越):
 *   - 支持属性全部由 Animate lane 拥有；流光位置、选中帧和文本只读 timeline
 *     MotionValue 做无 React render 的 DOM 投影。
 *   - REC、齿孔和光标常驻动效统一走 phase-gated infiniteAnimation。
 */

/* ── 自定义变体(仅白名单属性;scroll 驱动下 transition duration 置 0)── */
export function riseVariant(amplitude: string): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { y: amplitude, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 0 } },
  };
}
/**
 * 中性变体:只建立共享 timeline，不让承载内容随整段时长淡入。
 */
export function solidVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

function filmPanVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { x: '-100%', opacity: 1 },
    animate: { x: '0%', opacity: 1 },
  };
}

export function SplitTitle({
  text,
  kind = 'main',
}: {
  text: string;
  kind?: 'main' | 'header' | 'side';
}): JSX.Element {
  const [head, tail] = text.split('|');
  const cls =
    kind === 'header'
      ? 'cap-title cap-title--header'
      : kind === 'side'
        ? 'cap-title cap-title--side'
        : 'cap-title';
  return (
    <h2 className={cls}>
      {head}
      {tail ? (
        <>
          {' '}
          <em>{tail}</em>
        </>
      ) : null}
    </h2>
  );
}

/** 副标题在首个逗号(中文，/ 英文 ,)处换行,两行更均衡。 */
export function renderIntroLines(text: string): JSX.Element {
  const m = text.match(/[，,]/);
  if (!m || m.index == null) return <>{text}</>;
  const cut = m.index + 1;
  return (
    <>
      {text.slice(0, cut)}
      <br />
      {text.slice(cut)}
    </>
  );
}

/* ==================================================================
   SHOT 01 · 胶片带镜(全宽纯胶片 + 分步节奏)
   分步机制:9 帧链式 waitFor(frame-i waitFor frame-(i-1) 完成),一帧播完才轮下一帧;
   胶带 x 与各帧预设均由 framework lane 跟随滚动，选中说明只在离散帧边界投影。
   齿孔条流光随总进度流动；播完释放选中，之后悬停切换。
   ================================================================== */

const FILM_FRAMES = [
  { id: 'fadeIn', preset: 'fade-in', Icon: IconAperture },
  { id: 'slideUp', preset: 'slide-up', Icon: IconDolly },
  { id: 'zoomIn', preset: 'zoom-in', Icon: IconZoomLens },
  { id: 'rotateIn', preset: 'rotate-in', Icon: IconFilmRoll },
  { id: 'bounce', preset: 'bounce', Icon: IconClapper },
  { id: 'shake', preset: 'shake', Icon: IconHandheld },
  { id: 'flip', preset: 'flip', Icon: IconFlip },
  { id: 'elastic', preset: 'elastic', Icon: IconElastic },
  { id: 'blur', preset: 'blur-in', Icon: IconBlur },
] as const;

const N_FRAMES = FILM_FRAMES.length;

// 播放顺序倒置(frame-8 先播、frame-0 最后),配合胶带从左滑入 → "正在播的帧"就是从左边缘
// 进来的那一帧,始终可见。首帧延迟 1s 让胶带先腾出空间。每帧 1s、gapless 链 → 9s;
// 加首 1s 延迟 = 10s,与胶带 pan(10s)严格同步(预算取 max,不翻倍)。滚动平滑擦洗,不停顿,无 loop。
const FRAME_PLAY = 1000;
const INTRO_DELAY = 1000; // 首帧前的延迟:胶带先滑入腾空间
const PAN_MS = INTRO_DELAY + N_FRAMES * FRAME_PLAY; // 10000
// hold 尾段:铺满后延长锁定区,让胶带停留一下(可 hover / loop 走片)再释放到下一幕。
/* ⚠️ 2026-08-12 真机实测把 500 提到 2600。用户报「鼠标选中后 codeboard 没有出现」。
 * 探针 `scripts/rv-20260812-sweep.mjs` 的连续扫描（sweep.json）钉死了机制：
 *   y=11570 胶带 `--film-flow` 才到 100%（`state.done` 为真、hover 此刻起才被受理），
 *   而同一 y 上 `film-card-inout` 的 opacity 已经是 **0.746 并继续下落**，
 *   y=12040 归零，此后整个可 hover 的 hold 段卡片恒为 0。
 * 也就是说：选中逻辑一直是好的（探针实测 hover 能正确改写 activeCode/activeDesc），
 * 但卡片在「可以 hover」的那一刻恰好淡完了 —— 用户看到的就是「选中了但卡片不出现」。
 * 旧 HOLD_MS=500 只给了 500px 的驻留窗口，比一次滚轮轻推还短，根本不够 hover。 */
const HOLD_MS = 2600;
/* 选中切换的交叉淡入淡出窗口（C4，2026-08-10：180 → 420）。
 * 用户报「存在动画切换太快闪烁的问题」。旧值 180ms 要在一次切换里塞完
 * 「旧行淡出 + 新行淡入」，滚动快进时两者挤成一帧 ⇒ 读作「闪」。
 * 上限由相邻切换点间距定：帧间距 FRAME_PLAY=1000ms，一次切换占 2×fade，
 * 故 fade < 500ms；取 420ms，留 160ms 净空，既不重叠又明显从容。 */
const SELECTION_FADE_MS = 420;
/* 选中切换的位移量（C4）。用户裁决方向 A：**旧行下移淡出、新行从上方下落淡入**
 * （「往下走」的阅读流）。取 6 设计 px ≈ 行高的 1/3 —— 读作「换了一行」，
 * 而不是「整块往下掉」。走 y 属性（框架 10 属性白名单内），仍由 Animate lane 拥有。 */
const SELECTION_SHIFT = 6;
const SELECTION_MS = PAN_MS + HOLD_MS;

function filmSelectionVariant(kind: 'caption' | 'code'): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  const times: number[] = [0];
  const opacity: number[] = [kind === 'caption' ? 0 : 1];
  const blur = 'blur(0.833333vw)';
  const filter: string[] = [blur];
  const scale: number[] = [0.98];
  const fade = SELECTION_FADE_MS / SELECTION_MS;
  /* code 轨的位移序列（C4）。y 与 opacity 逐点对齐：
   *   at−fade  y=0        已就位、不透明
   *   at       y=+SHIFT   旧行沉到下方、opacity 0（此刻不可见）
   *   at+EPS   y=−SHIFT   趁不可见瞬移到上方，作为新行的起点
   *   at+fade  y=0        新行落回原位、不透明
   * 关键点：关键帧插值是连续的，y 不可能在同一 time 上从 +SHIFT 跳到 −SHIFT，
   * 故必须借一个极小的时间偏移 EPS 完成这次瞬移；因为整段 opacity 恒为 0，
   * 这次瞬移在视觉上不存在。EPS 取 fade/8，远小于相邻切换间距，不会打乱 times 单调性。 */
  const y: string[] = ['0px'];
  const EPS = fade / 8;
  const up = `${-SELECTION_SHIFT}px`;
  const down = `${SELECTION_SHIFT}px`;
  const switches = [
    ...Array.from(
      { length: N_FRAMES },
      (_, order) => (INTRO_DELAY + FRAME_PLAY * 0.05 + order * FRAME_PLAY) / SELECTION_MS
    ),
    PAN_MS / SELECTION_MS,
  ];

  switches.forEach((at, index) => {
    const isFirstCaption = kind === 'caption' && index === 0;
    const isFinalCaption = kind === 'caption' && index === switches.length - 1;
    if (!isFirstCaption) {
      times.push(at - fade);
      opacity.push(1);
      if (kind === 'caption') {
        filter.push('blur(0px)');
        scale.push(1);
      } else {
        y.push('0px');
      }
    }
    times.push(at);
    opacity.push(0);
    if (kind === 'caption') {
      filter.push(blur);
      scale.push(0.98);
    } else {
      y.push(down); // 旧行沉下去
    }
    if (!isFinalCaption) {
      if (kind !== 'caption') {
        // 不可见期间瞬移到上方，供新行下落
        times.push(at + EPS);
        opacity.push(0);
        y.push(up);
      }
      times.push(at + fade);
      opacity.push(1);
      if (kind === 'caption') {
        filter.push('blur(0px)');
        scale.push(1);
      } else {
        y.push('0px'); // 新行落回原位
      }
    }
  });
  times.push(1);
  opacity.push(kind === 'caption' ? 0 : 1);
  if (kind === 'caption') {
    filter.push(blur);
    scale.push(0.98);
  } else {
    y.push('0px');
  }

  return {
    initial:
      kind === 'caption'
        ? { opacity: opacity[0], filter: filter[0], scale: scale[0] }
        : { opacity: opacity[0], y: y[0] },
    animate: {
      opacity,
      ...(kind === 'caption' ? { filter, scale } : { y }),
      transition: { times },
    },
  };
}

/* ── 整卡进出场（C3，2026-08-10）────────────────────────────────────────────
 * 用户报「代码框没有入场/退场动画」。核实:旧实现里这块卡外层只有
 * `film-code-selection` 一条 lane，管的是**卡内行切换**；整卡从滚动一开始就杵在那，
 * 到整幕被切走为止 —— 入场/退场**从未被实现**（不是被改掉的）。
 *
 * 用户裁决:入场「上移 + 淡入」/ 退场「下移 + 淡出」，挂**独立短轴**（方案 B，
 * `waitFor: 'film-title'`），不跟胶带 `film-pan` 同轴 —— 独立轴的进出时长可单独调，
 * 不被胶带 10s 的 pan 拖长，进出更利落。
 *
 * 位移 32 设计 px：明显是「从下方升上来」而非漂移；且远小于外层裁切余量
 * （`.capability-full` 的 `overflow-clip-margin: 120px`，实测退场安全余量 163px）
 * ⇒ 投影在整个下移过程中都不会被切（那正是用户报的 C6 阴影截断）。
 *
 * ⚠️ 2026-08-12：整卡 lane **不再复用 `SELECTION_MS`**。旧写法 lane = PAN+HOLD = 10500、
 * 退场从 0.94 起步 = 9870ms —— 那**早于**胶带 pan 结束的 10000ms，于是退场斜坡把整个
 * hold 段（10000→10500，正是 hover 唯一生效的窗口）完全吃掉，卡片在能被 hover 时已经淡完。
 * 现在给整卡一条**独立更长的 lane**：pan(10000) + hold(2600) 全程 opacity 1，
 * 只在其后的 CARD_OUT_MS(700) 里下移淡出 ⇒ 退场严格晚于 hold，hover 窗口内卡片恒为实心。 */
const CARD_IN_MS = 700;
const CARD_OUT_MS = 700;
const CARD_LANE_MS = PAN_MS + HOLD_MS + CARD_OUT_MS;
const CARD_IN_END = CARD_IN_MS / CARD_LANE_MS;
const CARD_OUT_START = (PAN_MS + HOLD_MS) / CARD_LANE_MS;
const CARD_SHIFT = 32;

function cardInOutVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  const times = [0, CARD_IN_END, CARD_OUT_START, 1];
  return {
    initial: { opacity: 0, y: `${CARD_SHIFT}px` },
    animate: {
      opacity: [0, 1, 1, 0],
      y: [`${CARD_SHIFT}px`, '0px', '0px', `${CARD_SHIFT}px`],
      transition: { opacity: { times }, y: { times } },
    },
  };
}

const FILM_CAPTION_SELECTION = filmSelectionVariant('caption');
const FILM_CODE_SELECTION = filmSelectionVariant('code');

const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface FilmSelectionState {
  active: number;
  hovered: number | null;
  done: boolean;
  display: number | null;
}

function applyFilmSelection(scene: HTMLDivElement | null, state: FilmSelectionState): void {
  if (!scene) return;
  const display = state.hovered ?? state.active;
  if (display === state.display) return;
  state.display = display;
  scene.querySelectorAll<HTMLElement>('[data-film-index]').forEach((element) => {
    element.classList.toggle('is-active', Number(element.dataset.filmIndex) === display);
  });
}

/**
 * Film selection, flow and hover eligibility are unsupported visual projections.
 * They consume the framework MotionValue directly and only touch DOM when a discrete
 * frame boundary changes; x/opacity/scale stay owned by Animate.
 */
function FilmTimelineProjection({
  sceneRef,
  stateRef,
}: {
  sceneRef: MutableRefObject<HTMLDivElement | null>;
  stateRef: MutableRefObject<FilmSelectionState>;
}): null {
  const { progress } = useAnimateTimeline();

  useEffect(() => {
    const project = (value: number): void => {
      const p = Math.min(Math.max(value, 0), 1);
      const elapsed = p * PAN_MS;
      const done = p >= 0.9995;
      const activeElapsed = elapsed - INTRO_DELAY - FRAME_PLAY * 0.05;
      const active =
        done || activeElapsed < 0
          ? -1
          : Math.max(0, N_FRAMES - 1 - Math.floor(activeElapsed / FRAME_PLAY));
      const state = stateRef.current;
      state.active = active;
      state.done = done;
      if (!done) state.hovered = null;

      const flow = Math.min(
        100,
        Math.max(0, ((elapsed - INTRO_DELAY) / (N_FRAMES * FRAME_PLAY)) * 100)
      );
      sceneRef.current?.style.setProperty('--film-flow', `${flow}%`);
      applyFilmSelection(sceneRef.current, state);
    };

    project(progress.get());
    return progress.on('change', project);
  }, [progress, sceneRef, stateRef]);

  return null;
}

export function CapabilityFilmStripScene(): JSX.Element {
  const { t, lang } = useI18n();
  const sceneRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<FilmSelectionState>({
    active: -1,
    hovered: null,
    done: false,
    display: null,
  });

  const handleFrameEnter = (index: number): void => {
    const state = selectionRef.current;
    if (!state.done) return;
    state.hovered = index;
    sceneRef.current?.querySelector('.film-track')?.classList.add('is-paused');
    applyFilmSelection(sceneRef.current, state);
  };
  const handleFrameLeave = (): void => {
    selectionRef.current.hovered = null;
    sceneRef.current?.querySelector('.film-track')?.classList.remove('is-paused');
    applyFilmSelection(sceneRef.current, selectionRef.current);
  };

  return (
    <div ref={sceneRef} className="capability-full capability-full--film" data-lang={lang}>
      <div className="bg-grid" />
      <Animate
        animateId="film-clock"
        enterAnimation={solidVariant()}
        duration={{ enter: PAN_MS }}
        timeline={{ waitFor: 'film-title', delay: 0 }}
      >
        <TimecodeAxis shotIndex={1} seconds={10} />
      </Animate>
      <div className="cap-slate">{t('cap.shot1.slate')}</div>

      {/* 标题块(hero 风格):evocative slogan + 引介副标题 */}
      <Position at={{ anchor: 'center-x', y: 66 }}>
        <Animate
          animateId="film-title"
          enterAnimation={riseVariant('25%')}
          duration={{ enter: 640 }}
          timeline={{ delay: 0 }}
        >
          <div className="film-titleblock">
            <SplitTitle text={t('cap.shot1.title')} kind="header" />
            <p className="film-intro">{renderIntroLines(t('cap.shot1.intro'))}</p>
          </div>
        </Animate>
      </Position>

      {/* 胶带上方:活跃帧描述性标题 + 预设名标签(悬停可切换) */}
      <Position at={{ anchor: 'center-x', y: 238 }}>
        <Animate
          animateId="film-caption-selection"
          enterAnimation={FILM_CAPTION_SELECTION}
          duration={{ enter: SELECTION_MS }}
          timeline={{ waitFor: 'film-title', delay: 0 }}
        >
          <div className="film-caption-slot">
            {FILM_FRAMES.map((frame, index) => (
              <div key={frame.id} className="film-caption" data-film-index={index}>
                <span className="film-caption__title">
                  {t(`cap.shot1.preset.${frame.id}.title` as DictKey)}
                </span>
                <span className="film-caption__tag">
                  {t(`cap.shot1.preset.${frame.id}.name` as DictKey)}
                </span>
              </div>
            ))}
          </div>
        </Animate>
      </Position>

      {/* 胶卷:gate 固定可视窗(100vw),单份 track。film-pan lane 负责 x(-100%→0)。
          9 帧 gapless 倒序链。铺满后帧静止不动,齿孔条由 infinite lane 循环走片;
          鼠标悬停暂停走片并切换说明。
          hold 尾段延长锁定区,铺满后停留可 hover / 看齿孔滚动。 */}
      <Position at={{ anchor: 'center-x', y: 342 }}>
        <div className="film-gate">
          <Animate
            animateId="film-pan"
            enterAnimation={filmPanVariant()}
            duration={{ enter: PAN_MS }}
            timeline={{ waitFor: 'film-title', delay: 0 }}
            infiniteAnimation={
              PREFERS_REDUCED
                ? undefined
                : {
                    animate: {
                      '--film-perf-phase': [0, -1],
                      transition: { duration: 1, ease: 'linear', repeat: Infinity },
                    },
                  }
            }
          >
            <div className="film-track">
              <FilmTimelineProjection sceneRef={sceneRef} stateRef={selectionRef} />
              <div className="film-track__perf film-track__perf--top" />
              <div className="film-track__frames">
                {/* C8（2026-08-10 用户指令）:「胶带内的动画执行，只覆盖到图标及标题，
                    序号默认展示」+ 裁决 A「9 格序号全程常显」。
                    故序号**移出** Animate 之外、成为 slot 的直接子元素:预设动画
                    （fade/slide/zoom/rotate/bounce/shake/flip/elastic/blur）只作用在
                    图标 + 标题那一层，序号不参与任何入场，从头到尾 9 个都在。
                    ⚠️ `data-film-index` 与 hover 处理一并上提到 slot ——
                    `applyFilmSelection` 靠这个属性切 `is-active`，若留在 Animate 内层，
                    序号就拿不到选中态（CSS 侧对应改为 `.film-frame__slot.is-active`）。 */}
                {FILM_FRAMES.map((frame, index) => {
                  const { Icon } = frame;
                  return (
                    <div
                      key={frame.id}
                      className="film-frame__slot"
                      data-film-index={index}
                      onMouseEnter={() => handleFrameEnter(index)}
                      onMouseLeave={handleFrameLeave}
                    >
                      <span className="film-frame__no">{String(index + 1).padStart(2, '0')}</span>
                      <Animate
                        animateId={`film-frame-${index}`}
                        enterAnimation={frame.preset}
                        duration={{ enter: FRAME_PLAY }}
                        timeline={
                          index === N_FRAMES - 1
                            ? { waitFor: 'film-title', delay: INTRO_DELAY }
                            : { waitFor: `film-frame-${index + 1}` }
                        }
                      >
                        <div className="film-frame">
                          <div className="film-frame__card">
                            <span className="film-frame__icon">
                              <Icon />
                            </span>
                            <span className="film-frame__name">
                              {t(`cap.shot1.preset.${frame.id}.name` as DictKey)}
                            </span>
                          </div>
                        </div>
                      </Animate>
                    </div>
                  );
                })}
              </div>
              <div className="film-track__perf film-track__perf--bottom" />
            </div>
          </Animate>
        </div>
      </Position>

      {/* hold 尾段:铺满后延长锁定区,让胶带停留可 hover / loop 走片(不立即下滑到下一幕) */}
      <div className="cap-probes" aria-hidden="true">
        <Animate
          animateId="film-hold"
          enterAnimation="fade-in"
          duration={{ enter: HOLD_MS }}
          timeline={{ waitFor: 'film-frame-0', delay: 0 }}
        >
          <span />
        </Animate>
      </div>

      {/* 胶带下方:代码卡片 —— code 行 + 一句话描述,随展示帧联动(与胶带拉开间距) */}
      <Position at={{ anchor: 'center-x', y: 636 }}>
        {/* 两条 lane 分层，各管一件事，不能合并到一个元素上（会互相覆盖同名属性）：
              film-card-inout   —— 整卡进出场（上移淡入 / 下移淡出），C3
              film-code-selection —— 卡内 code/desc 行随选中帧切换，C4 */}
        <Animate
          animateId="film-card-inout"
          enterAnimation={cardInOutVariant()}
          duration={{ enter: CARD_LANE_MS }}
          timeline={{ waitFor: 'film-title', delay: 0 }}
        >
          <Animate
            animateId="film-code-selection"
            enterAnimation={FILM_CODE_SELECTION}
            duration={{ enter: SELECTION_MS }}
            timeline={{ waitFor: 'film-title', delay: 0 }}
          >
            <div className="film-codecard">
              <div className="film-codecard__bar">
                <span className="film-codecard__dot" />
                <span className="film-codecard__dot" />
                <span className="film-codecard__dot" />
                <span className="film-codecard__file">Scene.tsx</span>
              </div>
              <div className="film-codecard__body">
                <div className="film-codecard__head">
                  <span className="film-codecard__prompt">&gt;</span>
                  <span className="film-codecard__code-slot">
                    {FILM_FRAMES.map((frame, index) => (
                      <code key={frame.id} className="film-codecard__code" data-film-index={index}>
                        {t(`cap.shot1.preset.${frame.id}.code` as DictKey)}
                      </code>
                    ))}
                    <code className="film-codecard__code is-active" data-film-index={-1}>
                      {'<Animate enterAnimation={…} />'}
                    </code>
                  </span>
                </div>
                <span className="film-codecard__desc-slot">
                  {FILM_FRAMES.map((frame, index) => (
                    <span key={frame.id} className="film-codecard__desc" data-film-index={index}>
                      {t(`cap.shot1.preset.${frame.id}.desc` as DictKey)}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </Animate>
        </Animate>
      </Position>
    </div>
  );
}
