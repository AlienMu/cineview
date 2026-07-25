import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Animate, Position } from 'cineview';
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
 * 第二幕:能力展示 — 胶片带 + 舞台抽屉(v3 重做,2026-07-09)
 *
 * 两镜结构(task-flow 2026-07-09-act2-cinema-rewrite.md,规格冻结):
 *   SHOT01 胶片带镜:标题 → 胶带从左向右生长(render-prop 手写 width) → 6 预设帧格
 *           依次滚入播一次原生预设并定格,活跃帧高亮 + 联动说明/代码。链长 ≈8320ms。
 *   SHOT02 舞台抽屉镜:中央舞台三面板(waitFor 树 / stagger 方块 / Position 坐标卡)
 *           依次播放,播完各自用 exitAnimation 飞入左侧抽屉堆叠;全部收纳后右侧
 *           出现标题+总结。链长 =15000ms。
 *
 * 框架边界(已核实,勿越):
 *   - 自定义 variant 只有 opacity/x/y/scale/rotate/rotateX/rotateY/skewX/skewY/filter
 *     生效 — width 生长必须走 render-prop 手写 style。
 *   - render-prop children 必须搭配 enterAnimation 才注册 zone 预算。
 *   - exit 相位缺省 opacity=0,抽屉面板的 exit 必须显式写 opacity:1 才能留在抽屉可见。
 *   - REC 常驻动效走纯 CSS keyframes(TimecodeAxis),不用 infiniteAnimation。
 */

/* ── 自定义变体(仅白名单属性;scroll 驱动下 transition duration 置 0)── */
function riseVariant(amplitude: string): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { y: amplitude, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 0 } },
  };
}
/**
 * 平移驱动变体:opacity 恒 1(host 不淡入),只借它的 enterProgress 随滚动擦洗驱动 track 的
 * translateX。若用 fade-in,整条 track 会随 27s 淡入——不要。
 */
function solidVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}
/** 面板播完飞到顶部一行(上左/上中/上右),对齐上一幕胶带所在的横向位置。
 *  dx=水平列偏移(相对舞台中心);统一上移 DOCK_Y、缩小 DOCK_SCALE。opacity 显式 1(exit 缺省为 0)。 */
function panelDockRow(dx: string): { exit: Record<string, unknown> } {
  return {
    exit: { x: dx, y: DOCK_Y, scale: DOCK_SCALE, opacity: 1, transition: { duration: 0 } },
  };
}

function SplitTitle({
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
function renderIntroLines(text: string): JSX.Element {
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

/** render-prop 探针:把某条 Animate 轨道的 enterProgress 同步回 React 状态。 */
function ProgressSync({
  index,
  progress,
  onProgress,
}: {
  index: number;
  progress: number;
  onProgress: (index: number, progress: number) => void;
}): null {
  useEffect(() => {
    onProgress(index, progress);
  }, [index, progress, onProgress]);
  return null;
}

/** 单值探针:把一条轨道的 enterProgress 同步回 React 状态(用于 film-pan → REC 读数)。 */
function PanSync({
  progress,
  onProgress,
}: {
  progress: number;
  onProgress: (v: number) => void;
}): null {
  useEffect(() => {
    onProgress(progress);
  }, [progress, onProgress]);
  return null;
}

/* ==================================================================
   SHOT 01 · 胶片带镜(全宽纯胶片 + 分步节奏)
   分步机制:9 帧链式 waitFor(frame-i waitFor frame-(i-1) 完成),一帧播完才轮下一帧;
   胶带宽度不由连续 tween 驱动,而由「已完成帧数+1」的 state 决定(先露出下一格空位,
   帧再在里面播),配 CSS width 过渡形成「滚动→出格→播放→停顿→再滚动」的分步节奏。
   黑色部分(齿孔条+分隔线)色相随总进度流动;播完释放选中,之后悬停切换。
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
const HOLD_MS = 500;

export function CapabilityFilmStripScene(): JSX.Element {
  const { t, lang } = useI18n();
  const [activeFrame, setActiveFrame] = useState(-1);
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);
  const [stripHue, setStripHue] = useState(18);
  const [panProgress, setPanProgress] = useState(0);
  const [sequenceDone, setSequenceDone] = useState(false);
  const frameProgressRef = useRef<number[]>(Array(N_FRAMES).fill(0));
  const sequenceDoneRef = useRef(false);

  // film-pan 的 enterProgress(0..1 覆盖整 20s)→ 驱动 REC 读数(接管镜 DOM 高度恒为视口高,
  // 不能用 DOM 测量)。setState 用 rAF 外的 handler,由 render-prop effect 触发,避免渲染期 setState。
  const handlePanProgress = useCallback((v: number) => {
    setPanProgress((prev) => (Math.abs(prev - v) < 0.002 ? prev : v));
  }, []);

  const handleFrameProgress = useCallback((index: number, progress: number) => {
    frameProgressRef.current[index] = progress;
    // 倒序播放(8→0):已播完的帧停在 1.0,正在播的是「已启动(>0.05)里 index 最小」的那个。
    // 取最小 started index(不是最大),否则会永远卡在先播完的 frame-8。
    let next = -1;
    let allSettled = true;
    let sum = 0;
    for (let i = N_FRAMES - 1; i >= 0; i -= 1) {
      const p = frameProgressRef.current[i];
      sum += p;
      if (p > 0.05) next = i;
      if (p < 0.995) allSettled = false;
    }
    sequenceDoneRef.current = allSettled;
    setSequenceDone((prev) => (prev === allSettled ? prev : allSettled));
    // 全部播完 → 释放选中;未播完(播放中/回退)清掉 hover 残留(修回退 bug)。
    if (allSettled) next = -1;
    else setHoveredFrame((hh) => (hh == null ? hh : null));
    setActiveFrame((prev) => (prev === next ? prev : next));

    // 边框(齿孔+分隔线)色相随总进度平滑流动。平移交给 film-pan 的 enterProgress(见下),不用 state。
    const hue = Math.round(18 + (sum / N_FRAMES) * 320);
    setStripHue((prev) => (prev === hue ? prev : hue));
  }, []);

  // 悬停切换仅在整段播完后启用(运行完之前不响应 hover)。
  const handleFrameEnter = useCallback((index: number) => {
    if (sequenceDoneRef.current) setHoveredFrame(index);
  }, []);
  const handleFrameLeave = useCallback(() => setHoveredFrame(null), []);
  const displayFrame = hoveredFrame != null ? hoveredFrame : activeFrame;
  // 铺满且未悬停 → CSS marquee 走片;悬停即暂停并展示该帧。
  const rolling = sequenceDone && hoveredFrame == null;

  // 流光：暖陶土主题渐变(不再全色相旋转跑偏)，随滚动进度平移一道高光。
  // stripHue 复用为 0..338 的滚动进度信号 → 归一成 0..100% 的流光位置。
  const flow = Math.round(((stripHue - 18) / 320) * 100);
  const filmVars = {
    '--film-flow': `${flow}%`,
  } as CSSProperties;

  return (
    <div className="capability-full capability-full--film" data-lang={lang}>
      <div className="bg-grid" />
      <TimecodeAxis shotIndex={1} seconds={10} progress={panProgress} />
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
        <div className="film-caption-slot">
          {FILM_FRAMES.map((frame, index) => (
            <div
              key={frame.id}
              className={`film-caption${displayFrame === index ? ' is-active' : ''}`}
            >
              <span className="film-caption__title">
                {t(`cap.shot1.preset.${frame.id}.title` as DictKey)}
              </span>
              <span className="film-caption__tag">
                {t(`cap.shot1.preset.${frame.id}.name` as DictKey)}
              </span>
            </div>
          ))}
        </div>
      </Position>

      {/* 胶卷:gate 固定可视窗(100vw),单份 track。film-pan 的 enterProgress 内联 translateX(-100%→0)
          从左铺入。9 帧 gapless 倒序链。铺满(sequenceDone)后帧静止不动,只有齿孔条的「点」用
          background-position 循环滚动(is-rolling),表示胶卷在转;鼠标悬停暂停(is-paused)。
          hold 尾段延长锁定区,铺满后停留可 hover / 看齿孔滚动。 */}
      <Position at={{ anchor: 'center-x', y: 342 }}>
        <div className="film-gate">
          <Animate
            animateId="film-pan"
            enterAnimation={solidVariant()}
            duration={{ enter: PAN_MS }}
            timeline={{ waitFor: 'film-title', delay: 0 }}
          >
            {({ enterProgress }) => (
              <div
                className={`film-track${rolling ? ' is-rolling' : ''}${
                  sequenceDone && hoveredFrame != null ? ' is-paused' : ''
                }`}
                style={
                  {
                    ...filmVars,
                    transform: `translateX(${(-1 + enterProgress) * 100}%)`,
                  } as CSSProperties
                }
              >
                <PanSync progress={enterProgress} onProgress={handlePanProgress} />
                <div className="film-track__perf film-track__perf--top" />
                <div className="film-track__frames">
                  {FILM_FRAMES.map((frame, index) => {
                    const { Icon } = frame;
                    return (
                      <Animate
                        key={frame.id}
                        animateId={`film-frame-${index}`}
                        enterAnimation={frame.preset}
                        duration={{ enter: FRAME_PLAY }}
                        timeline={
                          index === N_FRAMES - 1
                            ? { waitFor: 'film-title', delay: INTRO_DELAY }
                            : { waitFor: `film-frame-${index + 1}` }
                        }
                      >
                        <div
                          className={`film-frame${displayFrame === index ? ' is-active' : ''}`}
                          onMouseEnter={() => handleFrameEnter(index)}
                          onMouseLeave={handleFrameLeave}
                        >
                          <div className="film-frame__card">
                            <span className="film-frame__icon">
                              <Icon />
                            </span>
                            <span className="film-frame__name">
                              {t(`cap.shot1.preset.${frame.id}.name` as DictKey)}
                            </span>
                            <span className="film-frame__no">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                          </div>
                        </div>
                      </Animate>
                    );
                  })}
                </div>
                <div className="film-track__perf film-track__perf--bottom" />
              </div>
            )}
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
        <Animate
          animateId="film-codecard"
          enterAnimation="fade-in"
          duration={{ enter: 500 }}
          timeline={{ waitFor: 'film-title', delay: 250 }}
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
                    <code
                      key={frame.id}
                      className={`film-codecard__code${displayFrame === index ? ' is-active' : ''}`}
                    >
                      {t(`cap.shot1.preset.${frame.id}.code` as DictKey)}
                    </code>
                  ))}
                  <code className={`film-codecard__code${displayFrame === -1 ? ' is-active' : ''}`}>
                    {'<Animate enterAnimation={…} />'}
                  </code>
                </span>
              </div>
              <span className="film-codecard__desc-slot">
                {FILM_FRAMES.map((frame, index) => (
                  <span
                    key={frame.id}
                    className={`film-codecard__desc${displayFrame === index ? ' is-active' : ''}`}
                  >
                    {t(`cap.shot1.preset.${frame.id}.desc` as DictKey)}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </Animate>
      </Position>

      {/* 帧进度探针:镜像各帧时序,驱动活跃帧状态(render-prop 需搭配 enterAnimation) */}
      <div className="cap-probes" aria-hidden="true">
        {FILM_FRAMES.map((frame, index) => (
          <Animate
            key={frame.id}
            animateId={`film-probe-${index}`}
            enterAnimation="fade-in"
            duration={{ enter: FRAME_PLAY }}
            timeline={
              index === N_FRAMES - 1
                ? { waitFor: 'film-title', delay: INTRO_DELAY }
                : { waitFor: `film-frame-${index + 1}` }
            }
          >
            {({ enterProgress }) => (
              <ProgressSync
                index={index}
                progress={enterProgress}
                onProgress={handleFrameProgress}
              />
            )}
          </Animate>
        ))}
      </div>
    </div>
  );
}

/* ==================================================================
   SHOT 02 · 舞台抽屉镜(结算链重做)
   链:panel0(3200+800) → panel1(3200+800) → panel2(3200+800)
       → stage-title(400) → stage-summary(delay100+2500) = 15000ms。
   每面板播完经 exitAnimation 飞入上方三列抽屉(percent 位移随面板尺寸等比缩放)。
   ================================================================== */

// 面板 enter 3000ms:外壳前 22%(~660ms)快速铺满(面板出现快);内容在尾段 30%→92%
// (~1860ms)才慢慢播(内容慢、且面板完全展示后才播)。exit 500ms 快速飞去停靠。
const PANEL_ENTER = 3000;
const PANEL_EXIT = 500;
// REC 时钟轨总时长(≈整段预算,已去掉 hold):面板 3×(3000+500)=10500 + 标题 400 + 结语 100+900 + 打字 3600 = 15500。
const STAGE_CLOCK_MS = 15500;

// 停靠:三面板播完飞到标题正上方一行(上左/上中/上右)。DOCK_Y 上移量、DOCK_SCALE 缩放;dx 列偏移。
// 停靠飞到上方一行(top≈130 完整可见,在标题上方)的三列 x≈225/720/1215。
// 实测(scale 0.46):panel top = DOCK_Y + 180 → 取 -50 使 top≈130。
// 最终构图三层:面板行(上)→ 标题(中)→ 代码框(下),全部可见,不裁切、不藏。
const DOCK_Y = '-9.615385%';
const DOCK_SCALE = 0.46;
const STAGE_PANELS = [
  {
    id: 'chain',
    labelKey: 'cap.shot2.panel.chain.label',
    codeKey: 'cap.shot2.panel.chain.code',
    Icon: IconDolly,
    dx: '-68.333333%',
  },
  {
    id: 'stagger',
    labelKey: 'cap.shot2.panel.stagger.label',
    codeKey: 'cap.shot2.panel.stagger.code',
    Icon: IconFilmRoll,
    dx: '0%',
  },
  {
    id: 'position',
    labelKey: 'cap.shot2.panel.position.label',
    codeKey: 'cap.shot2.panel.position.code',
    Icon: IconAperture,
    dx: '68.333333%',
  },
] as const;
// 面板 enter 窗口(stageProgress 归一,总时钟 15500ms)。inner 外壳/内容由这些窗口驱动
// (确定性、单调、可逆),与退场回落的 enterProgress 解耦 —— enter 完成后外壳恒 1,
// 飞去停靠不塌。窗口 = 各面板在链上的 enter 段:panel-i enter 起点/终点 / 15500。
//   p0 [0,3000] p1 [3500,6500] p2 [7000,10000] (每段前有 500 exit 衔接)
const PANEL_ENTER_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [0 / 15500, 3000 / 15500],
  [3500 / 15500, 6500 / 15500],
  [7000 / 15500, 10000 / 15500],
];

/** Panel1 内容:waitFor 结构树(3 节点 + 2 连线),由内容进度 progress(0..1) 逐个点亮。
 *  progress 来自所属面板的 enterProgress 尾段(面板完全展示后才 >0),故内容在面板铺满后才播。 */
function ChainTreePanelBody({ progress }: { progress: number }): JSX.Element {
  const nodes = ['title', 'subtitle', 'body'];
  return (
    <div className="stage-tree">
      {nodes.map((name, index) => {
        const nodeOn = progress >= 0.15 + index * 0.28;
        const wireOn = progress >= 0.3 + index * 0.28;
        return (
          <div key={name} className="stage-tree__step">
            <div className={`stage-tree__node${nodeOn ? ' is-on' : ''}`}>
              <span className="stage-tree__dot" />
              <span className="stage-tree__name">{name}</span>
              {index > 0 ? (
                <span className="stage-tree__wait">{`waitFor: "${nodes[index - 1]}"`}</span>
              ) : null}
            </div>
            {index < nodes.length - 1 ? (
              <span className={`stage-tree__wire${wireOn ? ' is-on' : ''}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Panel2 内容:6 方块横排错峰入场,由 progress 逐个点亮(错峰)。 */
function StaggerPanelBody({ progress }: { progress: number }): JSX.Element {
  return (
    <div className="stage-squares">
      {Array.from({ length: 6 }, (_, index) => {
        const on = progress >= 0.1 + index * 0.13;
        return (
          <span key={index} className={`stage-squares__cell${on ? ' is-on' : ''}`}>
            {String(index + 1).padStart(2, '0')}
          </span>
        );
      })}
    </div>
  );
}

/** Panel3 内容:Position 单尺子坐标卡 ×3,由 progress 逐个落位。 */
const POSITION_CARDS = [
  { x: 56, y: 64, at: 0.2 },
  { x: 292, y: 148, at: 0.45 },
  { x: 150, y: 236, at: 0.7 },
] as const;

function PositionPanelBody({ progress }: { progress: number }): JSX.Element {
  return (
    <div className="stage-coords">
      <span className="stage-coords__axis stage-coords__axis--x" />
      <span className="stage-coords__axis stage-coords__axis--y" />
      {POSITION_CARDS.map((card) => (
        <div
          key={`${card.x}-${card.y}`}
          className={`stage-coords__card${progress >= card.at ? ' is-on' : ''}`}
          style={
            {
              '--stage-card-x': card.x,
              '--stage-card-y': card.y,
            } as CSSProperties
          }
        >
          <span className="stage-coords__dot" />
          <span className="stage-coords__label">{`x:${card.x} y:${card.y}`}</span>
        </div>
      ))}
    </div>
  );
}

/** 打字机代码框:三段 API 按 progress(0..1) 依次逐字敷出;当前段闪光标。 */
function TypewriterCode({ progress }: { progress: number }): JSX.Element {
  const { t } = useI18n();
  const lines = [
    t('cap.shot2.panel.chain.code' as DictKey),
    t('cap.shot2.panel.stagger.code' as DictKey),
    t('cap.shot2.panel.position.code' as DictKey),
  ];
  const total = lines.reduce((n, l) => n + l.length, 0);
  // 在 progress 0→0.85 内敷完(留 0.85→1 的短暂 in-track 停留,完整代码可见片刻),
  // 而非敷到锁定区末尾才完成、看不到全貌。非独立死段——同轨内的自然收尾。
  const typeProgress = Math.min(1, Math.max(0, progress) / 0.85);
  const typed = Math.round(typeProgress * total);
  let remaining = typed;
  // 逐行分配已敷字符数;找出"当前正在敷"的行(未敷满且已开始)挂光标。
  let activeLine = -1;
  const shown = lines.map((line, i) => {
    const take = Math.max(0, Math.min(line.length, remaining));
    remaining -= line.length;
    if (take > 0 && take < line.length && activeLine === -1) activeLine = i;
    return { full: line, visible: line.slice(0, take), started: take > 0 };
  });
  if (activeLine === -1) {
    // 无"半敷"行:取最后一个已开始且未满的,否则最后一个已开始的
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (shown[i].started) {
        activeLine = i;
        break;
      }
    }
  }
  return (
    <div className="stage-code">
      <div className="stage-code__bar">
        <span className="stage-code__dot" />
        <span className="stage-code__dot" />
        <span className="stage-code__dot" />
        <span className="stage-code__file">Scene.tsx</span>
      </div>
      <div className="stage-code__body">
        {shown.map((ln, i) => (
          <div key={i} className={`stage-code__line${ln.started ? ' is-shown' : ''}`}>
            <span className="stage-code__prompt">&gt;</span>
            <code className="stage-code__text">
              {ln.visible}
              {i === activeLine ? <span className="stage-code__cursor" /> : null}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CapabilityStageDrawerScene(): JSX.Element {
  const { t, lang } = useI18n();
  const [stageProgress, setStageProgress] = useState(0);
  const handleStageProgress = useCallback((v: number) => {
    setStageProgress((prev) => (Math.abs(prev - v) < 0.002 ? prev : v));
  }, []);

  // 内容组件:接 progress(0..1),由所属面板 enter 窗口的尾段驱动(面板铺满后才播)。
  const PanelBody = [ChainTreePanelBody, StaggerPanelBody, PositionPanelBody];

  return (
    <div className="capability-full capability-full--stage" data-lang={lang}>
      <div className="bg-grid" />
      <TimecodeAxis shotIndex={2} seconds={15} progress={stageProgress} />
      <div className="cap-slate">{t('cap.shot2.slate')}</div>

      {/* 中央舞台:三面板依次在同一位置播放;播完飞入左侧抽屉(无占位框) */}
      <Position at={{ anchor: 'center-x', y: 140 }}>
        <div className="stage-frame">
          {STAGE_PANELS.map((panel, index) => {
            const { Icon } = panel;
            return (
              <Animate
                key={panel.id}
                animateId={`stage-panel-${index}`}
                enterAnimation={solidVariant()}
                exitAnimation={panelDockRow(panel.dx)}
                duration={{ enter: PANEL_ENTER, exit: PANEL_EXIT }}
                timeline={
                  index === 0 ? { delay: 0 } : { waitFor: `stage-panel-${index - 1}`, delay: 0 }
                }
              >
                {() => {
                  // 外壳/内容由 stageProgress 的「本面板 enter 窗口」驱动(不用会退场回落的 enterProgress)。
                  // local: 本面板 enter 段内进度 0..1;<0 未轮到(隐藏),>=1 已入场完(停靠态,恒实体)。
                  const [ws, we] = PANEL_ENTER_WINDOWS[index];
                  const local = Math.min(1, Math.max(0, (stageProgress - ws) / (we - ws)));
                  // 外壳前 22% 快速 ramp(面板出现快);内容尾段 30%→92% 才播(慢,面板铺满后才出现)。
                  const shell = stageProgress < ws ? 0 : Math.min(1, local / 0.22);
                  const contentProgress = Math.min(1, Math.max(0, (local - 0.3) / 0.62));
                  const Body = PanelBody[index];
                  return (
                    <div
                      className="stage-panel"
                      style={{ opacity: shell, transform: `scale(${0.94 + shell * 0.06})` }}
                    >
                      <div className="stage-panel__bar">
                        <span className="stage-panel__icon">
                          <Icon />
                        </span>
                        <span className="stage-panel__label">{t(panel.labelKey as DictKey)}</span>
                        <span className="stage-panel__no">
                          {String(index + 1).padStart(2, '0')} / 03
                        </span>
                      </div>
                      <div className="stage-panel__body" style={{ opacity: shell >= 1 ? 1 : 0 }}>
                        <Body progress={contentProgress} />
                      </div>
                      <code className="stage-panel__code">{t(panel.codeKey as DictKey)}</code>
                    </div>
                  );
                }}
              </Animate>
            );
          })}
        </div>
      </Position>

      {/* 三面板停靠顶部后,标题+总结在中部依次出现。 */}
      <Position at={{ anchor: 'center-x', y: 400 }}>
        <Animate
          animateId="stage-title"
          enterAnimation={riseVariant('75%')}
          duration={{ enter: 400 }}
          timeline={{ waitFor: 'stage-panel-2', delay: 0 }}
        >
          <SplitTitle text={t('cap.shot2.title')} />
        </Animate>
      </Position>
      <Position at={{ anchor: 'center-x', y: 480 }}>
        <Animate
          animateId="stage-summary"
          enterAnimation={riseVariant('46%')}
          duration={{ enter: 900 }}
          timeline={{ waitFor: 'stage-title', delay: 100 }}
        >
          <p className="stage-summary stage-summary--center">{t('cap.shot2.summary')}</p>
        </Animate>
      </Position>

      {/* 代码框:三段 API 依次逐字敷出(打字机)。opacity 由 enterProgress 门控 ——
          它的相位(waitFor stage-summary)开始前进度为 0 → 框隐藏,不提前显示、不遮挡面板。 */}
      <Position at={{ anchor: 'center-x', y: 560 }}>
        <Animate
          animateId="stage-typed"
          enterAnimation={solidVariant()}
          duration={{ enter: 3600 }}
          timeline={{ waitFor: 'stage-summary', delay: 0 }}
        >
          {({ enterProgress }) => (
            <div style={{ opacity: enterProgress <= 0 ? 0 : Math.min(1, enterProgress / 0.05) }}>
              <TypewriterCode progress={enterProgress} />
            </div>
          )}
        </Animate>
      </Position>

      {/* 去掉 hold 尾段:此前敷满后延长预算是「只有背景色漂移、别无变化」的死段(背景色由全局
          LUT 按总滚动进度驱动,与本镜局部时间轴无关)。移除后代码敷满即到锁定区末尾,色变融进
          全程而非单独一截。缩短打字 stage-typed 让敷满略早于末尾,留极短余量。 */}
      <div className="cap-probes" aria-hidden="true">
        {/* 时钟轨:贯穿整段预算(无 waitFor),enterProgress 驱动 REC 读数(接管镜 DOM 高度恒为视口高,
            不能 DOM 测量;取 max 预算与其它轨一致 → 覆盖全程)。 */}
        <Animate
          animateId="stage-clock"
          enterAnimation={solidVariant()}
          duration={{ enter: STAGE_CLOCK_MS }}
          timeline={{ delay: 0 }}
        >
          {({ enterProgress }) => (
            <PanSync progress={enterProgress} onProgress={handleStageProgress} />
          )}
        </Animate>
      </div>
    </div>
  );
}
