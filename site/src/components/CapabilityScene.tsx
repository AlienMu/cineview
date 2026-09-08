import { useEffect, useRef, type MutableRefObject } from 'react';
import { Animate, Position, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
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
 * SHOT01 胶片带镜:标题 → 胶带一次轻入场 → 9 预设帧格依次入场播一次原生预设并定格,
 *        活跃帧高亮 + 联动说明/代码。九帧序列 9.4s，每帧间隔 800ms；连同标题总长 10.04s。
 *
 * 原同文件的 SHOT02「舞台抽屉镜」已于 2026-08-04 拆除,第三幕改为推镜结构,
 * 见 `Act3DollyScene.tsx` 与 task-flow 2026-08-04-home-continuous-bg-act3-dolly.md。
 * 共用变体 riseVariant / solidVariant / SplitTitle / renderIntroLines 保留在本文件,
 * 由第三幕跨文件复用(避免重复实现)。
 *
 * 框架边界(已核实,勿越):
 *   - 支持属性全部由 Animate lane 拥有；流光位置、选中帧和文本只读 timeline
 *     MotionValue 做无 React render 的 DOM 投影。
 *   - REC、齿孔和光标常驻动效统一走 phase-gated loopAnimation。
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

function filmEnterVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  /* 2026-08-29:10s 长 pan 废除,胶带只做一次轻入场(胶带不是戏,是场)。 */
  return {
    initial: { opacity: 0, y: '14px' },
    animate: { opacity: 1, y: '0px' },
  };
}

export function SplitTitle({
  text,
  kind = 'main',
}: {
  text: string;
  kind?: 'main' | 'header' | 'side';
}): import('react').JSX.Element {
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
export function renderIntroLines(text: string): import('react').JSX.Element {
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
   分步机制:9 帧链式 after(frame-i after frame-(i-1) 完成),一帧播完才轮下一帧;
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

// Nine readable intervals occupy the zone; the settled hover window stays short.
const TITLE_ENTER_MS = 640;
const TAPE_IN_MS = 700;
const FRAME_START = 1100;
const FRAME_STAGGER = 800;
const FRAME_PLAY = 1000;
const PLAY_END = FRAME_START + (N_FRAMES - 1) * FRAME_STAGGER + FRAME_PLAY;
const HOLD_MS = 900;
const SELECTION_FADE_MS = 180;
const SELECTION_MS = PLAY_END + HOLD_MS; // 9400 ms = 9400 real scroll pixels

/**
 * 胶带上方 caption（活跃帧标题 + 预设名）的切换变体。
 *
 * 每到一个切换点：`at−fade` 实心 → `at` 淡出+虚焦缩小 → `at+fade` 重新实心。
 * 切换点按帧入场节奏推出（FRAME_START + n×FRAME_STAGGER），与帧格入场一一对应。
 *
 * ⚠️ 2026-08-12 两处修正，都源于「锚点用被改动的时长做分母」这类错误：
 *   1. 末帧**不再淡出**。原实现在最后一次切换后收到 opacity 0 并保持到 lane 末尾；
 *      `HOLD_MS` 500→2600 让该锚点从 0.952 掉到 0.794，caption 恰好在胶带跑完、
 *      hover 刚生效那一刻消失（用户报「胶带上面的标题 hover 不出现了」）。
 *      caption 正是 hover 要改写的对象，必须在整个驻留段可见。
 *   2. 末次切换不再跳过「淡入恢复」段，否则末帧的实心会从 0 硬跳上来。
 *
 * 卡内 code 行的位移轨（原 `kind: 'code'`）已整条移除 —— 用户裁决「代码框里面的
 * 内容不要有动画」。函数因此收窄为 caption 专用，原双分支死码一并删除。
 */
function filmSelectionVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  /* 2026-08-14(审计 act2-3):blur 0.833vw→0.55vw(12px→8px@1440)——谷底 opacity 0
   * + 12px 虚焦读作「失焦融化」,与整幕「定格逐帧」机械语汇不符;8px 保持
   * 「换帧闪一下」的打孔感。420ms 窗口(SELECTION_FADE_MS,08-10 C4 防闪裁决)不动。 */
  const blur = 'blur(0.55vw)';
  const times: number[] = [0];
  const opacity: number[] = [0];
  const filter: string[] = [blur];
  const scale: number[] = [0.98];
  const fade = SELECTION_FADE_MS / SELECTION_MS;
  /* 正序波浪:切换点 = 对应帧开始播放的时刻（提前 40ms，让 caption 在帧格
   * 起跳前完成虚化）。末切换点 ≈ (5860-600-2400+40)/5860，远离 lane 尾端，
   * 2026-08-12「末锚触底导致 caption 在 hover 开放瞬间不可见」的坑在结构上消失。 */
  const switches = Array.from(
    { length: N_FRAMES },
    (_, order) => (FRAME_START - 40 + order * FRAME_STAGGER) / SELECTION_MS
  );

  const pushSolid = (at: number): void => {
    times.push(at);
    opacity.push(1);
    filter.push('blur(0px)');
    scale.push(1);
  };
  const pushFaded = (at: number): void => {
    times.push(at);
    opacity.push(0);
    filter.push(blur);
    scale.push(0.98);
  };

  switches.forEach((at, index) => {
    // 首个切换点之前 caption 还没出现过，没有「淡出前的实心态」可言。
    if (index > 0) pushSolid(at - fade);
    pushFaded(at);
    pushSolid(at + fade);
  });
  // 末帧保持实心：驻留段全程有标题可供 hover 改写。
  times.push(1);
  opacity.push(1);
  filter.push('blur(0px)');
  scale.push(1);

  return {
    initial: { opacity: opacity[0], filter: filter[0], scale: scale[0] },
    animate: {
      opacity,
      filter,
      scale,
      transition: { duration: 0, opacity: { times }, filter: { times }, scale: { times } },
    },
  };
}

const FILM_CAPTION_SELECTION = filmSelectionVariant();

/* ── 整卡进出场（`film-card-inout`）────────────────────────────────────────
 * 挂独立短轴（`after: 'film-title'`），不跟胶带入场轴绑定 —— 独立轴的
 * 进场时长可单独调。
 *
 * ⚠️ 2026-08-12 两处真机修正：
 *   1. 旧写法退场从 lane 的 0.94 起步 —— 早于胶带播完，退场斜坡把整个可 hover 的
 *      hold 段吃掉，卡片在能被 hover 时已经淡完（用户报「选中后 codeboard 没出现」）。
 *   2. **不要退场动画**（用户裁决）。用户在驻留段稍一滚动就撞进那条斜坡，
 *      看到的是「半透明的代码框」—— 那不是设计，是退场播到一半。
 * 现在：入场占 lane 的前 `CARD_IN_END`，其后**恒为实心**直到整幕被切走，没有退场段。
 * lane 时长与 `film-caption-selection` 同为 `SELECTION_MS`（播完 + HOLD），两者对齐。
 *
 * 位移 32 设计 px：明显是「从下方升上来」而非漂移；且远小于外层裁切余量
 * （`.capability-full` 的 `overflow-clip-margin: 120px`）⇒ 投影不会被切。 */
const CARD_IN_MS = 700;
const CARD_IN_END = CARD_IN_MS / SELECTION_MS;
const CARD_SHIFT = 32;

function cardInOutVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, y: `${CARD_SHIFT}px` },
    animate: {
      opacity: [0, 1, 1],
      y: [`${CARD_SHIFT}px`, '0px', '0px'],
      transition: {
        duration: 0,
        opacity: { times: [0, CARD_IN_END, 1] },
        y: { times: [0, CARD_IN_END, 1] },
      },
    },
  };
}

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
  scene.style.setProperty(
    '--film-frame-offset',
    `${(-Math.min(6, Math.max(0, display - 1)) * 100) / N_FRAMES}%`
  );
  scene.querySelectorAll<HTMLElement>('[data-film-index]').forEach((element) => {
    element.classList.toggle('is-active', Number(element.dataset.filmIndex) === display);
  });
}

/**
 * Film selection, flow and hover eligibility are unsupported visual projections.
 * They consume the framework MotionValue directly and only touch DOM when a discrete
 * frame boundary changes. The mobile strip follows selection; preset transforms remain owned by Animate.
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
      const elapsed = p * SELECTION_MS;
      /* done 在「播完」即真（不是 lane 走完）：hold 段全程可 hover。 */
      const done = elapsed >= PLAY_END;
      const active =
        elapsed < FRAME_START || done
          ? -1
          : Math.min(N_FRAMES - 1, Math.floor((elapsed - FRAME_START) / FRAME_STAGGER));
      const state = stateRef.current;
      state.active = active;
      state.done = done;
      if (!done) state.hovered = null;

      const flow = Math.min(
        100,
        Math.max(0, ((elapsed - FRAME_START) / (PLAY_END - FRAME_START)) * 100)
      );
      sceneRef.current?.style.setProperty('--film-flow', `${flow}%`);
      applyFilmSelection(sceneRef.current, state);
    };

    project(progress.get());
    return progress.on('change', project);
  }, [progress, sceneRef, stateRef]);

  return null;
}

export function CapabilityFilmStripScene(): import('react').JSX.Element {
  const reduced = usePrefersReducedMotion();
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
        duration={{ enter: SELECTION_MS }}
        timeline={{ after: 'film-title', delay: 0 }}
      >
        {/* 时间投影必须挂在 SELECTION_MS 轴上（film-clock），不能挂在 700ms 的
            胶带入场轴上 —— elapsed = p * SELECTION_MS，轴时长错则整个投影失准。 */}
        <FilmTimelineProjection sceneRef={sceneRef} stateRef={selectionRef} />
        <TimecodeAxis shotIndex={1} seconds={(TITLE_ENTER_MS + SELECTION_MS) / 1000} />
      </Animate>
      <div className="cap-slate">{t('cap.shot1.slate')}</div>

      {/* 标题块(hero 风格):evocative slogan + 引介副标题 */}
      <Position at={{ anchor: 'center-x', y: 66 }} className="film-layout-title">
        <Animate
          animateId="film-title"
          enterAnimation={riseVariant('25%')}
          duration={{ enter: TITLE_ENTER_MS }}
          timeline={{ delay: 0 }}
        >
          <div className="film-titleblock">
            <SplitTitle text={t('cap.shot1.title')} kind="header" />
            <p className="film-intro">{renderIntroLines(t('cap.shot1.intro'))}</p>
          </div>
        </Animate>
      </Position>

      {/* 胶带上方:活跃帧描述性标题 + 预设名标签(悬停可切换) */}
      <Position at={{ anchor: 'center-x', y: 238 }} className="film-layout-caption">
        <Animate
          animateId="film-caption-selection"
          enterAnimation={FILM_CAPTION_SELECTION}
          duration={{ enter: SELECTION_MS }}
          timeline={{ after: 'film-title', delay: 0 }}
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

      {/* 胶卷:gate 固定可视窗(100vw),单份 track。film-pan lane 只做一次轻入场。
          9 帧按 FRAME_STAGGER 依次入场播一次预设并定格;齿孔条由 infinite lane 循环走片;
          鼠标悬停暂停走片并切换说明。
          hold 尾段延长锁定区,悬停互动都落在 hold 段。 */}
      <Position at={{ anchor: 'center-x', y: 342 }} className="film-layout-strip">
        <div className="film-gate">
          <Animate
            animateId="film-pan"
            enterAnimation={filmEnterVariant()}
            duration={{ enter: TAPE_IN_MS }}
            timeline={{ after: 'film-title', delay: 0 }}
            loopAnimation={
              reduced
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
                        timeline={{
                          after: 'film-title',
                          delay: FRAME_START + index * FRAME_STAGGER,
                        }}
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
          timeline={{ after: `film-frame-${N_FRAMES - 1}`, delay: 0 }}
        >
          <span />
        </Animate>
      </div>

      {/* 胶带下方:代码卡片 —— code 行 + 一句话描述,随展示帧联动(与胶带拉开间距) */}
      <Position at={{ anchor: 'center-x', y: 636 }} className="film-layout-code">
        {/* 只剩一条 lane：`film-card-inout` 管整卡入场（上移淡入，无退场）。
              卡内 code/desc 行的切换已改为无动画的内容替换（用户裁决），
              原 `film-code-selection` 位移轨整条移除。 */}
        <Animate
          animateId="film-card-inout"
          enterAnimation={cardInOutVariant()}
          duration={{ enter: SELECTION_MS }}
          timeline={{ after: 'film-title', delay: 0 }}
        >
          {/* 卡内内容**无动画**（2026-08-12 用户裁决：「代码框里面的内容不要有动画，
              只有代码框在真正的切换」）。原 `film-code-selection` lane 的逐行
              下沉/上落/模糊/缩放已整条移除，行切换退化为纯粹的内容替换。 */}
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
      </Position>
    </div>
  );
}
